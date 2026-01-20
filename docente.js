import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs,
  query, where,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpcM4OGMnyJZT7r_6XYldAJAyLpajP33I",
  authDomain: "calificaciones-imbili.firebaseapp.com",
  projectId: "calificaciones-imbili",
  storageBucket: "calificaciones-imbili.firebasestorage.app",
  messagingSenderId: "1027786450920",
  appId: "1:1027786450920:web:9517539adbb1ea06e5665d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById("year").textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const docenteNameEl = document.getElementById("docenteName");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");

const selCurso = document.getElementById("selCurso");
const selPeriodo = document.getElementById("selPeriodo");
const selMateria = document.getElementById("selMateria");

const btnBack = document.getElementById("btnBack");
const btnCargar = document.getElementById("btnCargar");
const btnAddAct = document.getElementById("btnAddAct");
const btnGuardar = document.getElementById("btnGuardar");

const msgTop = document.getElementById("msgTop");
const msgBottom = document.getElementById("msgBottom");

const studentsEl = document.getElementById("students");
const totalEstEl = document.getElementById("totalEst");

/* =========================
   Helpers UI
   ========================= */
function setMsg(el, text, type=""){
  el.className = "msg " + (type||"");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function normalizeRole(r){ return String(r||"").trim().toLowerCase(); }

btnBack.addEventListener("click", () => window.location.href = "app.html");

/* =========================
   Global state
   ========================= */
let CFG = { añoLectivo: 2025, periodos: 4, institucion: "Institución Educativa Imbilí Carretera" };
let PROFILE = null;

let cursos = [];       // [{id, grado, añoLectivo, jornada, nombre}]
let materias = [];     // [{id, grado, nombre, activa}]
let actividades = [];  // [{id, titulo}]

let estudiantes = [];  // [{documento, nombres, apellidos, curso}]
let notasCache = {};   // { documento: { actividades: { actId: {nota, obs} } } }

function getSelected(){
  const cursoId = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;
  const curso = cursos.find(c => c.id === cursoId) || null;
  const materia = materias.find(m => m.id === materiaId) || null;
  return { cursoId, periodo, materiaId, curso, materia };
}

function actDocId(){
  const { cursoId, periodo, materiaId } = getSelected();
  return `${CFG.añoLectivo}_${cursoId}_${periodo}_${materiaId}`;
}

function notaDocId(estDoc){
  const { cursoId, periodo, materiaId } = getSelected();
  return `${CFG.añoLectivo}_${cursoId}_${periodo}_${materiaId}_${estDoc}`;
}

/* =========================
   Load config + profile
   ========================= */
async function loadConfig(){
  const snap = await getDoc(doc(db,"config","general"));
  if(snap.exists()){
    CFG = { ...CFG, ...snap.data() };
  }
  instNameEl.textContent = CFG.institucion || "Institución Educativa Imbilí Carretera";
  anioEl.textContent = String(CFG.añoLectivo ?? "…");
  periodosEl.textContent = String(CFG.periodos ?? "…");

  // Periodos select
  selPeriodo.innerHTML = "";
  const n = Number(CFG.periodos || 4);
  for(let i=1;i<=n;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    selPeriodo.appendChild(opt);
  }
}

async function loadProfile(uid){
  const snap = await getDoc(doc(db,"usuarios",uid));
  return snap.exists() ? snap.data() : null;
}

/* =========================
   Load cursos
   ========================= */
async function loadCursos(){
  const snap = await getDocs(collection(db,"cursos"));
  cursos = [];
  snap.forEach(d => {
    const x = d.data();
    // esperamos: añoLectivo, grado, nombre (ej 11A), jornada
    cursos.push({
      id: d.id,
      ...x
    });
  });

  // filtrar por añoLectivo si existe
  const anio = Number(CFG.añoLectivo || 0);
  const filtered = cursos.filter(c => Number(c.añoLectivo || anio) === anio);
  const list = filtered.length ? filtered : cursos;

  selCurso.innerHTML = "";
  list
    .sort((a,b)=> String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)))
    .forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre || c.id;
      selCurso.appendChild(opt);
    });

  // Guardar solo lista final
  cursos = list;
}

/* =========================
   Load materias by grado
   ========================= */
async function loadMateriasForCurso(){
  setMsg(msgTop,"","");

  const { curso } = getSelected();
  if(!curso){
    selMateria.innerHTML = `<option value="">Selecciona un curso primero…</option>`;
    return;
  }

  const grado = Number(curso.grado); // importante
  selMateria.innerHTML = `<option value="">Cargando materias…</option>`;

  // Evitamos índices compuestos: traemos todas y filtramos cliente (pocas materias)
  const snap = await getDocs(collection(db,"materias"));
  materias = [];
  snap.forEach(d=>{
    const x = d.data();
    materias.push({ id:d.id, ...x });
  });

  const list = materias
    .filter(m => Number(m.grado) === grado && (m.activa === true || m.activa === undefined))
    .sort((a,b)=> String(a.nombre||"").localeCompare(String(b.nombre||"")));

  selMateria.innerHTML = `<option value="">Selecciona…</option>`;
  if(list.length === 0){
    selMateria.innerHTML = `<option value="">(No hay materias para grado ${grado})</option>`;
    setMsg(msgTop, `No se encontraron materias para el grado ${grado}. Revisa Firestore: materias (grado=${grado}, activa=true).`, "warn");
    return;
  }

  list.forEach(m=>{
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.nombre || "(Sin nombre)";
    selMateria.appendChild(opt);
  });

  // Guardamos solo las del grado para lookup
  materias = list;
}

/* =========================
   Actividades (por curso+periodo+materia)
   ========================= */
async function loadActividades(){
  actividades = [];
  const id = actDocId();
  const snap = await getDoc(doc(db,"actividades",id));
  if(snap.exists()){
    const data = snap.data();
    actividades = Array.isArray(data.items) ? data.items : [];
  }else{
    // crear doc vacío (para que exista)
    await setDoc(doc(db,"actividades",id), {
      añoLectivo: Number(CFG.añoLectivo || 0),
      curso: getSelected().cursoId,
      periodo: Number(getSelected().periodo || 1),
      materiaId: getSelected().materiaId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      items: []
    }, { merge:true });
    actividades = [];
  }
}

async function addActividad(){
  const { cursoId, periodo, materiaId } = getSelected();
  if(!cursoId || !periodo || !materiaId){
    return setMsg(msgTop,"Selecciona curso, período y materia primero.","warn");
  }

  const titulo = prompt("Nombre de la actividad (ej: Taller 1, Quiz, Exposición):");
  if(!titulo) return;

  const id = "A" + Math.random().toString(16).slice(2,10);
  const item = { id, titulo: titulo.trim() };

  const docRef = doc(db,"actividades", actDocId());
  await loadActividades();
  const next = [...actividades, item];

  await updateDoc(docRef, {
    items: next,
    updatedAt: serverTimestamp()
  });

  actividades = next;
  renderStudents(); // refrescar UI
  setMsg(msgTop, "Actividad agregada.", "ok");
}

/* =========================
   Estudiantes + notas existentes
   ========================= */
async function loadEstudiantes(){
  const { cursoId } = getSelected();
  const q = query(collection(db,"estudiantes"), where("curso","==",cursoId));
  const snap = await getDocs(q);

  estudiantes = [];
  snap.forEach(d=>{
    const x = d.data();
    estudiantes.push({
      documento: x.documento || d.id,
      nombres: x.nombres || "",
      apellidos: x.apellidos || "",
      curso: x.curso || cursoId,
      activo: x.activo !== false
    });
  });

  estudiantes = estudiantes.filter(e => e.activo !== false)
    .sort((a,b)=> (a.apellidos+a.nombres).localeCompare(b.apellidos+b.nombres));

  totalEstEl.textContent = String(estudiantes.length);
}

async function loadNotasExistentes(){
  notasCache = {};
  // Para no hacer query compuesta, leemos por ID determinístico (una lectura por estudiante)
  const promises = estudiantes.map(async (e)=>{
    const snap = await getDoc(doc(db,"notas", notaDocId(e.documento)));
    if(snap.exists()){
      notasCache[e.documento] = snap.data();
    }
  });
  await Promise.all(promises);
}

/* =========================
   UI Render estudiantes
   ========================= */
function calcPromedioFor(estDoc){
  const data = notasCache[estDoc] || {};
  const acts = data.actividades || {};
  const nums = [];

  for(const act of actividades){
    const v = acts?.[act.id]?.nota;
    const n = Number(v);
    if(!isNaN(n) && n >= 0 && n <= 5) nums.push(n);
  }
  if(nums.length === 0) return "";
  const avg = nums.reduce((a,b)=>a+b,0) / nums.length;
  return avg.toFixed(2);
}

function renderStudents(){
  studentsEl.innerHTML = "";

  const { materia } = getSelected();
  if(!materia){
    setMsg(msgBottom,"Selecciona una materia.","warn");
    return;
  }
  setMsg(msgBottom,"","");

  if(estudiantes.length === 0){
    setMsg(msgBottom,"No hay estudiantes en este curso (o no están activos).","warn");
    return;
  }

  // Si no hay actividades aún, lo informamos pero igual mostramos tarjetas
  if(actividades.length === 0){
    setMsg(msgTop,"No hay actividades creadas aún. Usa “+ Agregar actividad”.","warn");
  }

  estudiantes.forEach(e=>{
    const card = document.createElement("div");
    card.className = "student-card";

    const fullName = `${e.apellidos} ${e.nombres}`.trim().replace(/\s+/g," ");

    // aseguramos estructura cache
    if(!notasCache[e.documento]) notasCache[e.documento] = { actividades: {} };
    if(!notasCache[e.documento].actividades) notasCache[e.documento].actividades = {};

    const avg = calcPromedioFor(e.documento);

    card.innerHTML = `
      <div class="student-head">
        <div class="who">
          <b>${fullName || "(Sin nombre)"}</b>
          <span>Documento: ${e.documento}</span>
        </div>
        <div class="avg">
          <b>Definitiva: <span id="avg_${e.documento}">${avg || "—"}</span></b>
          <div class="small">Promedio actividades</div>
        </div>
      </div>

      <div style="padding:10px 12px;">
        <table class="activity-table">
          <thead>
            <tr>
              <th style="width:34%">Actividad</th>
              <th style="width:12%">Nota (0-5)</th>
              <th>Observación / Evidencia</th>
            </tr>
          </thead>
          <tbody id="tbody_${e.documento}">
          </tbody>
        </table>
      </div>
    `;

    const tbody = card.querySelector(`#tbody_${CSS.escape(e.documento)}`);

    if(actividades.length === 0){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3" class="small">Aún no hay actividades creadas.</td>`;
      tbody.appendChild(tr);
    }else{
      actividades.forEach(act=>{
        const stored = notasCache[e.documento].actividades[act.id] || {};
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>
            <div class="activity-name">${act.titulo}</div>
            <div class="small">ID: ${act.id}</div>
          </td>
          <td>
            <input class="note-input" type="number" step="0.1" min="0" max="5"
              placeholder="0.0"
              value="${stored.nota ?? ""}"
              data-doc="${e.documento}"
              data-act="${act.id}"
              data-kind="nota"
            />
          </td>
          <td>
            <textarea
              placeholder="Ej: Taller sobre fracciones, participación, etc."
              data-doc="${e.documento}"
              data-act="${act.id}"
              data-kind="obs"
            >${stored.obs ?? ""}</textarea>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    studentsEl.appendChild(card);
  });

  // listeners para actualizar cache + promedio
  studentsEl.querySelectorAll("input[data-kind='nota']").forEach(inp=>{
    inp.addEventListener("input", () => {
      const docId = inp.dataset.doc;
      const actId = inp.dataset.act;

      const v = inp.value;
      const n = Number(v);
      if(!notasCache[docId]) notasCache[docId] = { actividades:{} };
      if(!notasCache[docId].actividades) notasCache[docId].actividades = {};
      if(!notasCache[docId].actividades[actId]) notasCache[docId].actividades[actId] = {};

      notasCache[docId].actividades[actId].nota = v === "" ? "" : n;

      const avg = calcPromedioFor(docId);
      const el = document.getElementById(`avg_${docId}`);
      if(el) el.textContent = avg || "—";
    });
  });

  studentsEl.querySelectorAll("textarea[data-kind='obs']").forEach(tx=>{
    tx.addEventListener("input", () => {
      const docId = tx.dataset.doc;
      const actId = tx.dataset.act;

      if(!notasCache[docId]) notasCache[docId] = { actividades:{} };
      if(!notasCache[docId].actividades) notasCache[docId].actividades = {};
      if(!notasCache[docId].actividades[actId]) notasCache[docId].actividades[actId] = {};

      notasCache[docId].actividades[actId].obs = tx.value || "";
    });
  });
}

/* =========================
   Guardar notas
   ========================= */
async function guardarNotas(){
  const { cursoId, periodo, materiaId, materia } = getSelected();
  if(!cursoId || !periodo || !materiaId){
    return setMsg(msgTop, "Selecciona curso, período y materia.", "warn");
  }
  if(estudiantes.length === 0) return setMsg(msgTop, "No hay estudiantes cargados.", "warn");

  const batch = writeBatch(db);

  estudiantes.forEach(e=>{
    const docId = e.documento;
    const avg = calcPromedioFor(docId);
    const payload = {
      añoLectivo: Number(CFG.añoLectivo || 0),
      curso: cursoId,
      periodo: Number(periodo),
      materiaId: materiaId,
      materiaNombre: materia?.nombre || "",
      estudianteDoc: docId,
      estudianteNombre: `${e.apellidos} ${e.nombres}`.trim(),
      actividades: (notasCache[docId]?.actividades) || {},
      definitiva: avg ? Number(avg) : null,
      updatedAt: serverTimestamp(),
      updatedByUid: auth.currentUser?.uid || ""
    };

    batch.set(doc(db,"notas", notaDocId(docId)), payload, { merge:true });
  });

  await batch.commit();
  setMsg(msgTop, "✅ Notas guardadas correctamente.", "ok");
}

/* =========================
   Events
   ========================= */
selCurso.addEventListener("change", async () => {
  await loadMateriasForCurso();
});

btnCargar.addEventListener("click", async () => {
  try{
    setMsg(msgTop,"",""); setMsg(msgBottom,"","");

    const { cursoId, periodo, materiaId } = getSelected();
    if(!cursoId || !periodo || !materiaId){
      return setMsg(msgTop, "Selecciona curso, período y materia.", "warn");
    }

    await loadActividades();
    await loadEstudiantes();
    await loadNotasExistentes();
    renderStudents();

    setMsg(msgTop, `Listo. Estudiantes cargados del curso ${cursoId}.`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgTop, "❌ Error cargando estudiantes/materias. Revisa permisos y consola.", "err");
  }
});

btnAddAct.addEventListener("click", async () => {
  try{
    await addActividad();
  }catch(e){
    console.error(e);
    setMsg(msgTop, "❌ No se pudo agregar actividad. Revisa permisos/reglas.", "err");
  }
});

btnGuardar.addEventListener("click", async () => {
  try{
    await guardarNotas();
  }catch(e){
    console.error(e);
    setMsg(msgTop, "❌ No se pudo guardar. Revisa permisos/reglas.", "err");
  }
});

/* =========================
   Auth guard
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if(!user) return (window.location.href="index.html");

  try{
    await loadConfig();

    PROFILE = await loadProfile(user.uid);
    if(!PROFILE){
      alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
      await signOut(auth);
      return (window.location.href="index.html");
    }
    if(PROFILE.activo !== true){
      alert("Usuario inactivo.");
      await signOut(auth);
      return (window.location.href="index.html");
    }

    const role = normalizeRole(PROFILE.rol);
    const okRole = ["docente","soporte","rector","rectora","coordinador","coordinador academico","coordinador académico"].includes(role);
    if(!okRole){
      alert("No tienes permisos para el módulo docente.");
      window.location.href = "app.html";
      return;
    }

    docenteNameEl.textContent = PROFILE.nombre || "(Sin nombre)";

    await loadCursos();
    await loadMateriasForCurso();

  }catch(e){
    console.error(e);
    setMsg(msgTop, "Error inicializando. Revisa consola.", "err");
  }
});

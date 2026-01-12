import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* =========================
   Firebase config (calificaciones-imbili)
   ========================= */
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

/* =========================
   UI refs
   ========================= */
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");

const selCurso = document.getElementById("selCurso");
const selPeriodo = document.getElementById("selPeriodo");
const selMateria = document.getElementById("selMateria");

const btnCargar = document.getElementById("btnCargar");
const btnGuardar = document.getElementById("btnGuardar");
const btnAgregarActividad = document.getElementById("btnAgregarActividad");
const btnVolver = document.getElementById("btnVolver");

const msgEl = document.getElementById("msg");
const studentsWrap = document.getElementById("studentsWrap");
const infoFiltro = document.getElementById("infoFiltro");
const countEst = document.getElementById("countEst");

/* =========================
   State
   ========================= */
let CFG = { institucion: "", añoLectivo: 2025, periodos: 4 };
let PROFILE = null;

let cursosCache = [];          // [{id:"11A", grado:11, jornada:"Mañana", nombre:"11A"}]
let estudiantesCache = [];     // [{id, documento, nombreCompleto}]
let materiasCache = [];        // [{id, nombre, grado}]
let actividades = [];          // [{id, nombre}]
let notasByEst = new Map();    // estId -> { actividades: {actId:{nota,obs}} }

/* =========================
   Helpers
   ========================= */
function showMsg(text, type="ok"){
  msgEl.style.display = text ? "block" : "none";
  msgEl.className = "msg " + (type || "");
  msgEl.textContent = text || "";
}
function normalizeRole(r){
  return String(r || "").trim().toLowerCase();
}
function pad2(n){ return String(n).padStart(2,"0"); }

function slugId(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function getCursoSelected(){
  const cursoId = selCurso.value;
  const curso = cursosCache.find(c => c.id === cursoId) || null;
  return curso;
}

function materiaLabel(m){
  return m?.nombre || "(Sin materia)";
}

/* =========================
   Cargar config + perfil
   ========================= */
async function loadConfigGeneral(){
  const snap = await getDoc(doc(db, "config", "general"));
  if(snap.exists()){
    CFG = snap.data();
    if(CFG?.institucion) instNameEl.textContent = CFG.institucion;
    if(CFG?.añoLectivo != null) anioEl.textContent = String(CFG.añoLectivo);
    if(CFG?.periodos != null) periodosEl.textContent = String(CFG.periodos);
  }
}

async function loadUserProfile(uid){
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? snap.data() : null;
}

/* =========================
   Cursos
   ========================= */
async function loadCursos(){
  selCurso.innerHTML = `<option value="">Cargando cursos...</option>`;

  const snap = await getDocs(collection(db, "cursos"));
  const list = [];

  snap.forEach(d => {
    const x = d.data() || {};
    // d.id es "11A" etc.
    list.push({
      id: d.id,
      nombre: x.nombre || d.id,
      grado: (typeof x.grado === "number") ? x.grado : Number(x.grado),
      jornada: x.jornada || "",
      añoLectivo: x.añoLectivo ?? CFG.añoLectivo
    });
  });

  // Ordenar local (sin orderBy para evitar índices)
  list.sort((a,b) => (a.grado - b.grado) || (a.id.localeCompare(b.id)));
  cursosCache = list;

  selCurso.innerHTML = `<option value="">Selecciona...</option>` +
    list.map(c => `<option value="${c.id}">${c.id} (${c.jornada || "Jornada"})</option>`).join("");
}

/* =========================
   Materias por grado (desde Firestore)
   ========================= */
async function loadMateriasByGrado(grado){
  selMateria.innerHTML = `<option value="">Cargando materias...</option>`;
  materiasCache = [];

  try{
    // IMPORTANTE: sin orderBy (evita índice). Luego ordenamos aquí.
    const q = query(
      collection(db, "materias"),
      where("activa", "==", true),
      where("grado", "==", Number(grado))
    );

    const snap = await getDocs(q);
    const list = [];

    snap.forEach(d => {
      const x = d.data() || {};
      list.push({
        id: d.id,
        nombre: x.nombre || "(Sin nombre)",
        grado: x.grado
      });
    });

    list.sort((a,b)=> String(a.nombre).localeCompare(String(b.nombre)));
    materiasCache = list;

    selMateria.innerHTML =
      `<option value="">Selecciona...</option>` +
      list.map(m => `<option value="${m.id}">${m.nombre}</option>`).join("");

    if(list.length === 0){
      selMateria.innerHTML = `<option value="">No hay materias para grado ${grado}</option>`;
    }
  }catch(e){
    console.error("Error materias:", e);
    selMateria.innerHTML = `<option value="">-- Error cargando materias --</option>`;
    showMsg("❌ No se pudieron cargar materias. Revisa que en Firestore exista la colección 'materias' con campos: activa=true, grado (número), nombre.", "err");
  }
}

/* =========================
   Estudiantes del curso
   ========================= */
async function loadEstudiantesDelCurso(cursoId){
  // Consulta en estudiantes por curso
  // OJO: para escalar, lo ideal es usar 'matriculas'. Por ahora lo dejamos simple.
  const q = query(collection(db, "estudiantes"), where("curso", "==", cursoId));
  const snap = await getDocs(q);

  const list = [];
  snap.forEach(d => {
    const x = d.data() || {};
    const nombres = String(x.nombres || "").trim();
    const apellidos = String(x.apellidos || "").trim();
    const full = `${nombres} ${apellidos}`.trim() || "(Sin nombre)";
    list.push({
      id: d.id, // docId = documento (en tu sistema)
      documento: x.documento || d.id,
      nombre: full.toUpperCase()
    });
  });

  list.sort((a,b)=> a.nombre.localeCompare(b.nombre));
  estudiantesCache = list;
  return list;
}

/* =========================
   Notas (por curso/periodo/materia)
   Estructura:
   notas/{docId} -> {anioLectivo, cursoId, periodo, materiaId, materiaNombre, actividades:[{id,nombre}], updatedAt}
   notas/{docId}/estudiantes/{estId} -> {documento, nombre, actividades:{actId:{nota,obs}}, definitiva, updatedAt}
   ========================= */
function notasDocId({anioLectivo, cursoId, periodo, materiaId}){
  return `${anioLectivo}_${cursoId}_P${periodo}_${materiaId}`;
}

async function loadNotasAndActividades({anioLectivo, cursoId, periodo, materiaId}){
  const id = notasDocId({anioLectivo, cursoId, periodo, materiaId});

  // reset
  actividades = [];
  notasByEst = new Map();

  const mainSnap = await getDoc(doc(db, "notas", id));
  if(mainSnap.exists()){
    const data = mainSnap.data() || {};
    actividades = Array.isArray(data.actividades) ? data.actividades : [];
  } else {
    // si no existe, al menos 1 actividad por defecto
    actividades = [{ id: slugId(), nombre: "Actividad 1" }];
  }

  // cargar notas por estudiante (subcollection)
  const subSnap = await getDocs(collection(db, "notas", id, "estudiantes"));
  subSnap.forEach(d=>{
    const x = d.data() || {};
    const acts = x.actividades || {};
    notasByEst.set(d.id, { actividades: acts });
  });

  return { id, actividades };
}

function calcDefinitiva(actMap){
  const vals = [];
  Object.values(actMap || {}).forEach(v=>{
    const n = Number(v?.nota);
    if(!isNaN(n)) vals.push(n);
  });
  if(vals.length === 0) return "";
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  return Math.round(avg*100)/100;
}

/* =========================
   Render
   ========================= */
function renderStudents(){
  studentsWrap.innerHTML = "";
  countEst.textContent = String(estudiantesCache.length);

  if(estudiantesCache.length === 0){
    studentsWrap.innerHTML = `<div class="muted">No hay estudiantes en este curso.</div>`;
    return;
  }

  estudiantesCache.forEach(est=>{
    const saved = notasByEst.get(est.id) || { actividades: {} };

    // asegurar que existan keys para todas las actividades
    const actState = { ...(saved.actividades || {}) };
    actividades.forEach(a=>{
      if(!actState[a.id]) actState[a.id] = { nota: "", obs: "" };
    });

    const definitiva = calcDefinitiva(actState);

    const card = document.createElement("div");
    card.className = "student-card";
    card.dataset.est = est.id;

    const actsHtml = actividades.map((a, idx)=>{
      const v = actState[a.id] || { nota:"", obs:"" };
      return `
        <div class="act-row" data-act="${a.id}">
          <div class="act-name">
            <div class="muted">Actividad ${idx+1}</div>
            <div class="act-title">${a.nombre}</div>
          </div>

          <div class="act-inputs">
            <div class="field small">
              <label>Nota (0-5)</label>
              <input class="inp nota" type="number" min="0" max="5" step="0.1" value="${v.nota ?? ""}" placeholder="0.0" />
            </div>
            <div class="field small">
              <label>Observación</label>
              <input class="inp obs" type="text" value="${(v.obs ?? "")}" placeholder="Ej: Taller, examen, quiz..." />
            </div>
          </div>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="student-head">
        <div>
          <div class="student-name">${est.nombre}</div>
          <div class="muted">Documento: ${est.documento}</div>
        </div>
        <div class="def-box">
          <div class="muted">Definitiva</div>
          <div class="def-val">${definitiva === "" ? "--" : definitiva}</div>
        </div>
      </div>

      <div class="act-list">
        ${actsHtml}
      </div>
    `;

    // listeners para recalcular definitiva en vivo
    card.querySelectorAll("input.nota").forEach(inp=>{
      inp.addEventListener("input", ()=>{
        const st = readStudentCardState(est.id);
        const def = calcDefinitiva(st.actividades);
        card.querySelector(".def-val").textContent = (def === "" ? "--" : def);
      });
    });

    studentsWrap.appendChild(card);
  });
}

function readStudentCardState(estId){
  const card = studentsWrap.querySelector(`.student-card[data-est="${CSS.escape(estId)}"]`);
  const actMap = {};

  if(!card) return { actividades: actMap };

  card.querySelectorAll(".act-row").forEach(row=>{
    const actId = row.dataset.act;
    const nota = row.querySelector("input.nota")?.value ?? "";
    const obs = row.querySelector("input.obs")?.value ?? "";
    actMap[actId] = {
      nota: (nota === "" ? "" : Number(nota)),
      obs: String(obs || "").trim()
    };
  });

  return { actividades: actMap };
}

/* =========================
   Acciones
   ========================= */
btnVolver.addEventListener("click", ()=>{
  window.location.href = "app.html";
});

selCurso.addEventListener("change", async ()=>{
  showMsg("", "");
  studentsWrap.innerHTML = "";
  countEst.textContent = "0";
  infoFiltro.textContent = "Selecciona filtros y pulsa “Cargar estudiantes”.";

  const curso = getCursoSelected();
  if(!curso){
    selMateria.innerHTML = `<option value="">Selecciona un curso primero...</option>`;
    return;
  }
  await loadMateriasByGrado(curso.grado);
});

btnAgregarActividad.addEventListener("click", ()=>{
  if(estudiantesCache.length === 0){
    showMsg("Primero carga estudiantes.", "warn");
    return;
  }
  const nombre = prompt("Nombre de la actividad (Ej: Taller 1, Examen, Quiz):");
  if(!nombre) return;

  actividades.push({ id: slugId(), nombre: nombre.trim() });
  renderStudents();
  showMsg("✅ Actividad agregada. Recuerda guardar notas.", "ok");
});

btnCargar.addEventListener("click", async ()=>{
  try{
    showMsg("", "");
    const curso = getCursoSelected();
    const cursoId = curso?.id || "";
    const periodo = Number(selPeriodo.value);
    const materiaId = selMateria.value;

    if(!cursoId){ showMsg("Selecciona un curso.", "warn"); return; }
    if(!materiaId){ showMsg("Selecciona una materia.", "warn"); return; }

    const materia = materiasCache.find(m=>m.id===materiaId) || null;

    infoFiltro.textContent = `Curso: ${cursoId} • Período: ${periodo} • Materia: ${materiaLabel(materia)}`;

    // 1) cargar estudiantes
    await loadEstudiantesDelCurso(cursoId);

    // 2) cargar notas existentes + actividades
    await loadNotasAndActividades({
      anioLectivo: CFG.añoLectivo || 2025,
      cursoId,
      periodo,
      materiaId
    });

    renderStudents();
    showMsg(`✅ Listo. Estudiantes cargados del curso ${cursoId}.`, "ok");
  }catch(e){
    console.error(e);
    showMsg("❌ Error cargando estudiantes/notas. Revisa consola.", "err");
  }
});

btnGuardar.addEventListener("click", async ()=>{
  try{
    showMsg("", "");
    const curso = getCursoSelected();
    const cursoId = curso?.id || "";
    const periodo = Number(selPeriodo.value);
    const materiaId = selMateria.value;

    if(!cursoId){ showMsg("Selecciona un curso.", "warn"); return; }
    if(!materiaId){ showMsg("Selecciona una materia.", "warn"); return; }
    if(estudiantesCache.length === 0){ showMsg("No hay estudiantes cargados.", "warn"); return; }

    const materia = materiasCache.find(m=>m.id===materiaId) || null;

    const anioLectivo = CFG.añoLectivo || 2025;
    const mainId = notasDocId({anioLectivo, cursoId, periodo, materiaId});

    // guardar doc principal (actividades)
    await setDoc(doc(db, "notas", mainId), {
      anioLectivo,
      cursoId,
      periodo,
      materiaId,
      materiaNombre: materia?.nombre || "",
      actividades,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // guardar subdocs por estudiante (batch)
    const batch = writeBatch(db);

    estudiantesCache.forEach(est=>{
      const state = readStudentCardState(est.id);
      const definitiva = calcDefinitiva(state.actividades);

      batch.set(doc(db, "notas", mainId, "estudiantes", est.id), {
        documento: est.documento,
        nombre: est.nombre,
        actividades: state.actividades,
        definitiva: (definitiva === "" ? null : definitiva),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    await batch.commit();
    showMsg("✅ Notas guardadas correctamente.", "ok");
  }catch(e){
    console.error(e);
    showMsg("❌ No se pudo guardar. Revisa permisos/reglas y consola.", "err");
  }
});

/* =========================
   Auth guard + init
   ========================= */
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = "index.html";
    return;
  }

  await loadConfigGeneral();
  PROFILE = await loadUserProfile(user.uid);

  if(!PROFILE){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if(PROFILE.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const role = normalizeRole(PROFILE.rol);
  if(role !== "docente" && role !== "soporte" && role !== "rector" && role !== "rectora" && !role.includes("coordin")){
    alert("No tienes permisos para el módulo docente.");
    window.location.href = "app.html";
    return;
  }

  userNameEl.textContent = PROFILE.nombre || "(Sin nombre)";
  userRoleEl.textContent = PROFILE.rol || "(Sin rol)";

  await loadCursos();

  // Si ya hay un curso seleccionado, carga materias
  if(selCurso.value){
    const curso = getCursoSelected();
    if(curso) await loadMateriasByGrado(curso.grado);
  }
});

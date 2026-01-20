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

document.getElementById("year").textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const secNameEl = document.getElementById("secName");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const btnBack = document.getElementById("btnBack");

btnBack.addEventListener("click", () => window.location.href = "app.html");

/* =========================
   Form refs
   ========================= */
const stTipoDoc = document.getElementById("stTipoDoc");
const stDocumento = document.getElementById("stDocumento");
const stNombres = document.getElementById("stNombres");
const stApellidos = document.getElementById("stApellidos");
const stGrado = document.getElementById("stGrado");
const stCurso = document.getElementById("stCurso");
const stJornada = document.getElementById("stJornada");
const stNacimiento = document.getElementById("stNacimiento");
const stEdad = document.getElementById("stEdad");
const stCorreo = document.getElementById("stCorreo");
const stTelefono = document.getElementById("stTelefono");
const stDireccion = document.getElementById("stDireccion");

const btnGuardar = document.getElementById("btnGuardar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnDesactivar = document.getElementById("btnDesactivar");

const msgForm = document.getElementById("msgForm");

/* CSV refs */
const csvFile = document.getElementById("csvFile");
const btnPlantilla = document.getElementById("btnPlantilla");
const btnImportar = document.getElementById("btnImportar");
const msgCSV = document.getElementById("msgCSV");

/* List refs */
const fCurso = document.getElementById("fCurso");
const fBuscar = document.getElementById("fBuscar");
const btnRefrescar = document.getElementById("btnRefrescar");
const listado = document.getElementById("listado");
const totalEstEl = document.getElementById("totalEst");
const msgList = document.getElementById("msgList");

/* =========================
   Helpers
   ========================= */
function setMsg(el, text, type=""){
  el.className = "msg " + (type||"");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function normalizeRole(r){ return String(r||"").trim().toLowerCase(); }

function sanitizeUpper(s){
  return String(s||"").trim().toUpperCase();
}

function toNumOrNull(v){
  if(v === "" || v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/* =========================
   Config + Profile
   ========================= */
let CFG = { añoLectivo: 2025, periodos: 4, institucion: "Institución Educativa Imbilí Carretera" };
let PROFILE = null;
let cursos = []; // [{id,nombre,grado,añoLectivo,jornada}]
let grados = []; // [0..11] o desde collection

async function loadConfig(){
  const snap = await getDoc(doc(db,"config","general"));
  if(snap.exists()) CFG = { ...CFG, ...snap.data() };

  instNameEl.textContent = CFG.institucion || "Institución Educativa Imbilí Carretera";
  anioEl.textContent = String(CFG.añoLectivo ?? "…");
  periodosEl.textContent = String(CFG.periodos ?? "…");
}

async function loadProfile(uid){
  const snap = await getDoc(doc(db,"usuarios",uid));
  return snap.exists() ? snap.data() : null;
}

/* =========================
   Cargar cursos y grados
   ========================= */
async function loadCursos(){
  const snap = await getDocs(collection(db,"cursos"));
  cursos = [];
  snap.forEach(d=>{
    cursos.push({ id:d.id, ...d.data() });
  });

  const anio = Number(CFG.añoLectivo || 0);
  const filtered = cursos.filter(c => Number(c.añoLectivo || anio) === anio);
  cursos = filtered.length ? filtered : cursos;

  // Grados disponibles desde cursos
  const setG = new Set();
  cursos.forEach(c=>{
    if(c.grado != null) setG.add(Number(c.grado));
  });
  grados = Array.from(setG).sort((a,b)=>a-b);

  // llenar selects
  stGrado.innerHTML = "";
  grados.forEach(g=>{
    const opt = document.createElement("option");
    opt.value = String(g);
    opt.textContent = String(g);
    stGrado.appendChild(opt);
  });

  // Cursos select (según grado)
  refreshCursosSelects();

  // filtro listado cursos (todos)
  fCurso.innerHTML = `<option value="">(Todos)</option>`;
  cursos
    .sort((a,b)=> String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)))
    .forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre || c.id;
      fCurso.appendChild(opt);
    });
}

function refreshCursosSelects(){
  const g = Number(stGrado.value || "");
  const list = cursos
    .filter(c => Number(c.grado) === g)
    .sort((a,b)=> String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)));

  stCurso.innerHTML = "";
  list.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre || c.id;
    stCurso.appendChild(opt);
  });

  if(list.length === 0){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(No hay cursos para este grado)";
    stCurso.appendChild(opt);
  }
}

stGrado.addEventListener("change", refreshCursosSelects);

/* =========================
   Form actions
   ========================= */
function limpiar(){
  stTipoDoc.value = "TI";
  stDocumento.value = "";
  stNombres.value = "";
  stApellidos.value = "";
  if(stGrado.options.length) stGrado.selectedIndex = 0;
  refreshCursosSelects();
  stJornada.value = "Mañana";
  stNacimiento.value = "";
  stEdad.value = "";
  stCorreo.value = "";
  stTelefono.value = "";
  stDireccion.value = "";
  setMsg(msgForm,"","");
}
btnLimpiar.addEventListener("click", limpiar);

async function guardarEstudiante(activo=true){
  setMsg(msgForm,"","");

  const documento = String(stDocumento.value||"").trim();
  const nombres = sanitizeUpper(stNombres.value);
  const apellidos = sanitizeUpper(stApellidos.value);
  const grado = Number(stGrado.value || "");
  const cursoId = String(stCurso.value||"").trim();

  if(!documento || !nombres || !apellidos || !cursoId || isNaN(grado)){
    setMsg(msgForm,"Faltan campos obligatorios (*).","warn");
    return;
  }

  const cursoObj = cursos.find(c=>c.id===cursoId);
  const payload = {
    tipoDoc: String(stTipoDoc.value||"TI"),
    documento,
    nombres,
    apellidos,
    grado,
    curso: cursoId,
    jornada: String(stJornada.value||cursoObj?.jornada||"Mañana"),
    nacimiento: stNacimiento.value ? String(stNacimiento.value) : "",
    edad: toNumOrNull(stEdad.value),
    correo: String(stCorreo.value||"").trim(),
    telefono: String(stTelefono.value||"").trim(),
    direccion: String(stDireccion.value||"").trim(),
    activo: !!activo,
    añoLectivo: Number(CFG.añoLectivo || 0),
    updatedAt: serverTimestamp()
  };

  await setDoc(doc(db,"estudiantes",documento), payload, { merge:true });
  setMsg(msgForm, `✅ Guardado: ${documento} - ${apellidos} ${nombres}`, "ok");

  // refrescar listado
  await refrescarListado();
}

btnGuardar.addEventListener("click", () => guardarEstudiante(true));

btnDesactivar.addEventListener("click", async () => {
  const documento = String(stDocumento.value||"").trim();
  if(!documento) return setMsg(msgForm,"Escribe un documento para desactivar.","warn");
  if(!confirm("¿Seguro que deseas desactivar este estudiante?")) return;

  try{
    await updateDoc(doc(db,"estudiantes",documento), {
      activo:false,
      updatedAt: serverTimestamp()
    });
    setMsg(msgForm, `✅ Estudiante desactivado: ${documento}`, "ok");
    await refrescarListado();
  }catch(e){
    console.error(e);
    setMsg(msgForm,"❌ No se pudo desactivar. Revisa permisos/reglas.","err");
  }
});

/* =========================
   CSV import
   ========================= */
function downloadText(filename, text){
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

btnPlantilla.addEventListener("click", () => {
  const sample =
`tipoDoc,documento,nombres,apellidos,grado,curso,jornada,edad,correo,telefono,direccion,nacimiento
TI,120012121,JULIAN,VEGA,11,11A,Mañana,16,acudiente@gmail.com,3110000000,Barrio X,2008-01-15
`;
  downloadText("plantilla_estudiantes.csv", sample);
});

function parseCSV(text){
  const sep = text.includes(";") && !text.includes(",") ? ";" : (text.includes(";") ? ";" : ",");
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep).map(c=>c.trim());
    const obj = {};
    headers.forEach((h,idx)=> obj[h] = cols[idx] ?? "");
    rows.push(obj);
  }
  return { headers, rows };
}

btnImportar.addEventListener("click", async () => {
  try{
    setMsg(msgCSV,"","");
    const file = csvFile?.files?.[0];
    if(!file) return setMsg(msgCSV,"Selecciona un CSV primero.","warn");

    const text = await file.text();
    const { rows } = parseCSV(text);
    if(rows.length === 0) return setMsg(msgCSV,"El CSV no tiene filas de datos.","warn");

    const batch = writeBatch(db);
    let ok=0, skip=0;

    rows.forEach(r=>{
      const documento = String(r.documento||"").trim();
      const nombres = sanitizeUpper(r.nombres);
      const apellidos = sanitizeUpper(r.apellidos);
      const grado = Number(String(r.grado||"").trim());
      const curso = String(r.curso||"").trim().toUpperCase();

      if(!documento || !nombres || !apellidos || isNaN(grado) || !curso){
        skip++; return;
      }

      const payload = {
        tipoDoc: String(r.tipodoc || r.tipoDoc || "TI").trim() || "TI",
        documento,
        nombres,
        apellidos,
        grado,
        curso,
        jornada: String(r.jornada||"Mañana").trim() || "Mañana",
        edad: r.edad ? Number(r.edad) : null,
        correo: String(r.correo||"").trim(),
        telefono: String(r.telefono||"").trim(),
        direccion: String(r.direccion||"").trim(),
        nacimiento: String(r.nacimiento||"").trim(),
        activo: true,
        añoLectivo: Number(CFG.añoLectivo || 0),
        updatedAt: serverTimestamp()
      };

      batch.set(doc(db,"estudiantes",documento), payload, { merge:true });
      ok++;
    });

    if(ok === 0) return setMsg(msgCSV,"No hubo filas válidas. Revisa columnas: documento,nombres,apellidos,grado,curso","warn");

    await batch.commit();
    setMsg(msgCSV, `✅ Importación lista. Guardados/actualizados: ${ok}. Omitidos: ${skip}.`, "ok");

    await refrescarListado();
  }catch(e){
    console.error(e);
    setMsg(msgCSV,"❌ Error importando CSV. Revisa consola/permisos/reglas.","err");
  }
});

/* =========================
   Listado
   ========================= */
let allStudents = [];

function renderList(){
  const cursoFilter = String(fCurso.value||"").trim();
  const qtxt = String(fBuscar.value||"").trim().toUpperCase();

  let list = [...allStudents];

  if(cursoFilter){
    list = list.filter(s => String(s.curso||"") === cursoFilter);
  }
  if(qtxt){
    list = list.filter(s => {
      const name = `${s.apellidos||""} ${s.nombres||""}`.toUpperCase();
      return String(s.documento||"").includes(qtxt) || name.includes(qtxt);
    });
  }

  totalEstEl.textContent = String(list.length);

  if(list.length === 0){
    listado.innerHTML = "";
    setMsg(msgList,"No hay resultados con ese filtro.","warn");
    return;
  }

  setMsg(msgList,"","");

  // Render como "mini-cards" usando panel
  listado.innerHTML = "";
  list.slice(0, 200).forEach(s=>{
    const div = document.createElement("div");
    div.className = "panel";
    div.style.marginBottom = "10px";

    const name = `${s.apellidos||""} ${s.nombres||""}`.trim();

    div.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div>
          <h2 style="margin:0; font-size:14px;">${name || "(Sin nombre)"} <span class="small">• ${s.documento}</span></h2>
          <p class="small">Curso: <b>${s.curso||"—"}</b> • Grado: <b>${s.grado??"—"}</b> • Jornada: <b>${s.jornada||"—"}</b> • Activo: <b>${s.activo===false ? "NO" : "SI"}</b></p>
        </div>
        <div class="btns">
          <button class="btn-ghost" data-edit="${s.documento}">Editar</button>
        </div>
      </div>
    `;

    div.querySelector(`[data-edit="${CSS.escape(s.documento)}"]`).addEventListener("click", ()=>{
      // cargar en form
      stTipoDoc.value = s.tipoDoc || "TI";
      stDocumento.value = s.documento || "";
      stNombres.value = s.nombres || "";
      stApellidos.value = s.apellidos || "";
      stGrado.value = String(s.grado ?? "");
      refreshCursosSelects();
      stCurso.value = s.curso || "";
      stJornada.value = s.jornada || "Mañana";
      stNacimiento.value = s.nacimiento || "";
      stEdad.value = s.edad ?? "";
      stCorreo.value = s.correo || "";
      stTelefono.value = s.telefono || "";
      stDireccion.value = s.direccion || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMsg(msgForm, "Editando estudiante. Ajusta y pulsa Guardar.", "ok");
    });

    listado.appendChild(div);
  });

  if(allStudents.length > 200){
    setMsg(msgList, "Mostrando solo los primeros 200 resultados. Usa filtros para encontrar más rápido.", "warn");
  }
}

async function refrescarListado(){
  try{
    setMsg(msgList,"Cargando…","warn");

    // Traemos todos (para colegios no suele ser exagerado). Si crece demasiado, lo paginamos luego.
    const snap = await getDocs(collection(db,"estudiantes"));
    allStudents = [];
    snap.forEach(d=>{
      const x = d.data();
      allStudents.push({
        documento: x.documento || d.id,
        tipoDoc: x.tipoDoc || "TI",
        nombres: x.nombres || "",
        apellidos: x.apellidos || "",
        grado: x.grado,
        curso: x.curso,
        jornada: x.jornada,
        edad: x.edad ?? null,
        nacimiento: x.nacimiento || "",
        correo: x.correo || "",
        telefono: x.telefono || "",
        direccion: x.direccion || "",
        activo: x.activo !== false
      });
    });

    // ordenar
    allStudents.sort((a,b)=> (String(a.apellidos)+String(a.nombres)).localeCompare(String(b.apellidos)+String(b.nombres)));

    setMsg(msgList,"","");

    renderList();
  }catch(e){
    console.error(e);
    setMsg(msgList,"❌ Error cargando listado. Revisa permisos/reglas.","err");
  }
}

btnRefrescar.addEventListener("click", refrescarListado);
fCurso.addEventListener("change", renderList);
fBuscar.addEventListener("input", renderList);

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
    const okRole = ["secretaria","soporte","rector","rectora","coordinador","coordinador academico","coordinador académico"].includes(role);
    if(!okRole){
      alert("No tienes permisos para el módulo Secretaría.");
      window.location.href = "app.html";
      return;
    }

    secNameEl.textContent = PROFILE.nombre || "(Sin nombre)";

    await loadCursos();

    // inicializa selects
    if(stGrado.options.length) stGrado.selectedIndex = 0;
    refreshCursosSelects();

    await refrescarListado();
    limpiar();
  }catch(e){
    console.error(e);
    setMsg(msgList,"Error inicializando. Revisa consola.","err");
  }
});

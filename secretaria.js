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
  where
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
   UI
   ========================= */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const anioEl = document.getElementById("anioLectivo");

const selCurso = document.getElementById("selCurso");
const cursoInfo = document.getElementById("cursoInfo");
const btnCargar = document.getElementById("btnCargar");
const btnReload = document.getElementById("btnReload");
const btnBack = document.getElementById("btnBack");

const msg = document.getElementById("msg");
const tbody = document.getElementById("tbody");

/* Individual */
const tipoDoc = document.getElementById("tipoDoc");
const numDoc = document.getElementById("numDoc");
const nombre = document.getElementById("nombre");
const edad = document.getElementById("edad");
const obs = document.getElementById("obs");
const activoEst = document.getElementById("activoEst");
const btnGuardarUno = document.getElementById("btnGuardarUno");

/* CSV */
const fileCsv = document.getElementById("fileCsv");
const btnImportar = document.getElementById("btnImportar");
const btnPlantillaCsv = document.getElementById("btnPlantillaCsv");

/* =========================
   Estado
   ========================= */
let currentUser = null;
let currentProfile = null;
let configGeneral = { anio: 2025, institucion: "Institución Educativa Imbilí Carretera" };

let cursosCache = []; // [{id, nombre, jornada, grado}]

/* =========================
   Helpers
   ========================= */
function setMsg(text, ok=false){
  if(!msg) return;
  msg.textContent = text || "";
  msg.className = "info " + (ok ? "ok" : "err");
}

function normRole(r){
  return (r || "").toString().trim().toLowerCase();
}

function downloadFile(filename, content, mime="text/csv;charset=utf-8"){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* CSV simple (coma o ;) */
function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if(!lines.length) return { headers: [], rows: [] };

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim());

  const rows = [];
  for(let i=1; i<lines.length; i++){
    const cols = lines[i].split(sep).map(c => c.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] ?? "").trim());
    rows.push(obj);
  }
  return { headers, rows };
}

/* =========================
   Cargar config/general
   ========================= */
async function loadConfigGeneral(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const data = snap.data();
      if(data?.institucion) configGeneral.institucion = data.institucion;

      // soporta ambos nombres (por si quedó alguno mal escrito)
      if(data?.["añoLectivoActual"] != null) configGeneral.anio = Number(data["añoLectivoActual"]) || configGeneral.anio;
      if(data?.["añoLectvoActual"] != null) configGeneral.anio = Number(data["añoLectvoActual"]) || configGeneral.anio;
    }
  }catch(e){}
  if(instNameEl) instNameEl.textContent = configGeneral.institucion;
  if(anioEl) anioEl.textContent = String(configGeneral.anio);
}

/* =========================
   Auth guard + permiso
   ========================= */
async function loadUserProfile(uid){
  const snap = await getDoc(doc(db, "usuarios", uid));
  if(!snap.exists()) return null;
  return snap.data();
}

function requireSecretariaOrSoporte(profile){
  const r = normRole(profile?.rol);
  return (r === "secretaria" || r === "soporte");
}

/* =========================
   Cursos
   ========================= */
async function loadCursos(){
  selCurso.innerHTML = "";
  cursosCache = [];

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— Selecciona —";
  selCurso.appendChild(opt0);

  const qy = query(collection(db, "cursos"), where("añoLectivo", "==", configGeneral.anio));
  const snap = await getDocs(qy);

  snap.forEach(d => {
    const data = d.data();
    cursosCache.push({
      id: d.id,
      nombre: data?.nombre || d.id,
      jornada: data?.jornada || "",
      grado: data?.grado ?? ""
    });
  });

  cursosCache.sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), "es"));

  for(const c of cursosCache){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.nombre}${c.jornada ? " — " + c.jornada : ""}`;
    selCurso.appendChild(opt);
  }
}

function updateCursoInfo(){
  const id = selCurso.value;
  const found = cursosCache.find(c => c.id === id);
  if(!found){
    cursoInfo.value = "";
    return;
  }
  cursoInfo.value = `Curso: ${found.nombre} | Jornada: ${found.jornada || "—"} | Grado: ${found.grado ?? "—"}`;
}

/* =========================
   Leer matriculados
   ========================= */
async function loadMatriculados(cursoId){
  // matriculas: { anioLectivo, cursoId, estudianteId, activo }
  const qMat = query(
    collection(db, "matriculas"),
    where("anioLectivo", "==", configGeneral.anio),
    where("cursoId", "==", cursoId),
    where("activo", "==", true)
  );

  const matSnap = await getDocs(qMat);
  const ids = [];
  matSnap.forEach(d => {
    const m = d.data();
    if(m?.estudianteId) ids.push(m.estudianteId);
  });

  // cargar estudiantes
  const students = await Promise.all(
    ids.map(async (sid) => {
      const sSnap = await getDoc(doc(db, "estudiantes", sid));
      if(!sSnap.exists()) return null;
      const s = sSnap.data();
      return {
        id: sid,
        tipoDoc: s?.tipoDoc || "",
        numDoc: s?.numDoc || sid,
        nombre: s?.nombre || "(Sin nombre)",
        edad: s?.edad ?? "",
        obs: s?.obs || "",
        activo: s?.activo === true
      };
    })
  );

  return students.filter(Boolean).sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

function renderTable(list){
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No hay estudiantes matriculados en este curso (para el año ${configGeneral.anio}).</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((s, i) => `
    <tr>
      <td>${i+1}</td>
      <td><b>${s.nombre}</b></td>
      <td>${(s.tipoDoc || "")} ${s.numDoc || ""}</td>
      <td>${s.edad ?? ""}</td>
      <td>${s.activo ? '<span class="badge">Sí</span>' : '<span class="badge">No</span>'}</td>
      <td>${s.obs || ""}</td>
    </tr>
  `).join("");
}

/* =========================
   Guardar estudiante + matrícula
   ========================= */
async function upsertEstudianteAndMatricula({
  tipoDocVal,
  numDocVal,
  nombreVal,
  edadVal,
  obsVal,
  activoVal,
  cursoId
}){
  const estudianteId = String(numDocVal).trim(); // ID fijo: documento
  if(!estudianteId) throw new Error("Documento vacío");
  if(!cursoId) throw new Error("No hay curso seleccionado");

  const estudianteData = {
    tipoDoc: (tipoDocVal || "").trim(),
    numDoc: estudianteId,
    nombre: (nombreVal || "").trim(),
    edad: (edadVal === "" || edadVal == null) ? null : Number(edadVal),
    obs: (obsVal || "").trim(),
    activo: activoVal === true
  };

  // estudiantes/{numDoc}
  await setDoc(doc(db, "estudiantes", estudianteId), estudianteData, { merge: true });

  // matriculas/{anio-curso-estudiante}
  const matriculaId = `${configGeneral.anio}-${cursoId}-${estudianteId}`;
  const matriculaData = {
    anioLectivo: configGeneral.anio,
    cursoId,
    estudianteId,
    activo: true,
    updatedAt: Date.now()
  };
  await setDoc(doc(db, "matriculas", matriculaId), matriculaData, { merge: true });

  return estudianteId;
}

/* =========================
   Eventos
   ========================= */
btnBack?.addEventListener("click", () => window.location.href = "app.html");
btnReload?.addEventListener("click", async () => {
  setMsg("Recargando cursos...", true);
  await loadCursos();
  updateCursoInfo();
  setMsg("Cursos listos.", true);
});

selCurso?.addEventListener("change", () => updateCursoInfo());

btnCargar?.addEventListener("click", async () => {
  const cursoId = selCurso.value;
  if(!cursoId){
    setMsg("Selecciona un curso.", false);
    return;
  }
  setMsg("Cargando estudiantes matriculados...", true);
  try{
    const list = await loadMatriculados(cursoId);
    renderTable(list);
    setMsg(`Listo. Matriculados en ${cursoId}: ${list.length}`, true);
  }catch(e){
    console.error(e);
    setMsg("No se pudo cargar. Revisa conexión o permisos.", false);
  }
});

btnGuardarUno?.addEventListener("click", async () => {
  const cursoId = selCurso.value;
  if(!cursoId){
    setMsg("Selecciona un curso antes de guardar.", false);
    return;
  }

  const num = (numDoc.value || "").trim();
  const nom = (nombre.value || "").trim();

  if(!num || !nom){
    setMsg("Documento y nombre son obligatorios.", false);
    return;
  }

  setMsg("Guardando estudiante y matrícula...", true);

  try{
    await upsertEstudianteAndMatricula({
      tipoDocVal: tipoDoc.value,
      numDocVal: num,
      nombreVal: nom,
      edadVal: (edad.value || "").trim(),
      obsVal: (obs.value || "").trim(),
      activoVal: (activoEst.value === "true"),
      cursoId
    });

    // limpiar
    // (dejamos tipoDoc y activo como están)
    numDoc.value = "";
    nombre.value = "";
    edad.value = "";
    obs.value = "";

    // refrescar tabla
    const list = await loadMatriculados(cursoId);
    renderTable(list);

    setMsg("Guardado y matriculado correctamente.", true);
  }catch(e){
    console.error(e);
    setMsg("Error guardando. Verifica datos o permisos.", false);
  }
});

btnPlantillaCsv?.addEventListener("click", () => {
  const csv = [
    "tipoDoc,numDoc,nombre,edad,obs,activo",
    "TI,12345,María López,9,,true",
    "TI,67890,Carlos Ruiz,10,Acudiente: Ana,true"
  ].join("\n");
  downloadFile("plantilla_estudiantes.csv", csv);
});

btnImportar?.addEventListener("click", async () => {
  const cursoId = selCurso.value;
  if(!cursoId){
    setMsg("Selecciona un curso antes de importar.", false);
    return;
  }
  const f = fileCsv.files?.[0];
  if(!f){
    setMsg("Selecciona un archivo CSV.", false);
    return;
  }

  setMsg("Leyendo CSV...", true);

  try{
    const text = await f.text();
    const { headers, rows } = parseCSV(text);

    const needed = ["tipodoc","numdoc","nombre","edad","obs","activo"];
    const headersNorm = headers.map(h => h.toLowerCase());
    for(const n of needed){
      if(!headersNorm.includes(n)){
        setMsg(`Falta columna "${n}" en el CSV. Descarga la plantilla y usa ese formato.`, false);
        return;
      }
    }

    let okCount = 0;
    let failCount = 0;

    for(const r of rows){
      const tipoDocVal = (r.tipoDoc || r.TIPODOC || r.tipodoc || "").trim();
      const numDocVal = (r.numDoc || r.NUMDOC || r.numdoc || "").trim();
      const nombreVal = (r.nombre || r.NOMBRE || "").trim();
      const edadVal = (r.edad || r.EDAD || "").trim();
      const obsVal = (r.obs || r.OBS || "").trim();
      const activoRaw = (r.activo || r.ACTIVO || "true").toString().trim().toLowerCase();
      const activoVal = (activoRaw === "true" || activoRaw === "1" || activoRaw === "si" || activoRaw === "sí");

      if(!numDocVal || !nombreVal){
        failCount++;
        continue;
      }

      try{
        await upsertEstudianteAndMatricula({
          tipoDocVal,
          numDocVal,
          nombreVal,
          edadVal,
          obsVal,
          activoVal,
          cursoId
        });
        okCount++;
      }catch(e){
        failCount++;
      }
    }

    // refrescar tabla
    const list = await loadMatriculados(cursoId);
    renderTable(list);

    setMsg(`Importación finalizada. OK: ${okCount} · Fallas: ${failCount}`, failCount === 0);
  }catch(e){
    console.error(e);
    setMsg("No se pudo importar. Verifica el archivo CSV.", false);
  }
});

/* =========================
   Inicio
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  await loadConfigGeneral();

  const profile = await loadUserProfile(user.uid);
  currentProfile = profile;

  if(!profile){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if(profile.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if(!requireSecretariaOrSoporte(profile)){
    alert("No tienes permisos para Secretaría. Contacta a soporte.");
    window.location.href = "app.html";
    return;
  }

  // cargar cursos al entrar
  setMsg("Cargando cursos...", true);
  await loadCursos();
  updateCursoInfo();
  setMsg("Listo. Selecciona un curso y carga matriculados.", true);
});

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
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp
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
const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const yearEl = document.getElementById("year");

const btnLogout = document.getElementById("btnLogout");
const btnBack = document.getElementById("btnBack");

const selCurso = document.getElementById("selCurso");
const selPeriodo = document.getElementById("selPeriodo");
const selMateria = document.getElementById("selMateria");

const btnCargar = document.getElementById("btnCargar");
const btnGuardar = document.getElementById("btnGuardar");
const btnPlantilla = document.getElementById("btnPlantilla");
const btnConsolidado = document.getElementById("btnConsolidado");

const tbody = document.getElementById("tbody");
const msg = document.getElementById("msg");

if (yearEl) yearEl.textContent = new Date().getFullYear();

/* =========================
   Estado
   ========================= */
let currentUser = null;
let profile = null;
let configGeneral = { anio: 2025, periodos: 4, institucion: "Institución Educativa Imbilí Carretera" };

let currentRows = []; 
// Cada row: { idx, estudianteId, nombre, doc, nota, notaDocId? }

/* =========================
   Utilidades
   ========================= */
function setMsg(text, ok = false){
  msg.textContent = text || "";
  msg.className = "info " + (ok ? "ok" : "err");
}

function normalizeRole(r){
  return String(r || "").trim().toLowerCase();
}

function toCSV(rows){
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  return rows.map(r => r.map(esc).join(",")).join("\n");
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

/* =========================
   Cargar config/general
   ========================= */
async function loadConfigGeneral(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const data = snap.data();
      if(data?.institucion) configGeneral.institucion = data.institucion;
      if(data?.periodos != null) configGeneral.periodos = Number(data.periodos) || 4;
      if(data?.["añoLectvoActual"] != null) configGeneral.anio = Number(data["añoLectvoActual"]) || configGeneral.anio;
      // OJO: en tu base veo "añoLectvoActual" (sin i). Si lo tienes como "añoLectivoActual", cámbialo aquí:
      if(data?.["añoLectivoActual"] != null) configGeneral.anio = Number(data["añoLectivoActual"]) || configGeneral.anio;
    }
  }catch(e){}
  if(instNameEl) instNameEl.textContent = configGeneral.institucion;
  if(anioEl) anioEl.textContent = String(configGeneral.anio);
  if(periodosEl) periodosEl.textContent = String(configGeneral.periodos);
}

/* =========================
   Materias (por ahora lista fija)
   ========================= */
const MATERIAS_DEFAULT = [
  "Matemáticas",
  "Lengua Castellana",
  "Ciencias Naturales",
  "Ciencias Sociales",
  "Inglés",
  "Educación Física",
  "Artística",
  "Ética y Valores",
  "Religión",
  "Tecnología"
];

function loadMaterias(){
  selMateria.innerHTML = "";
  for(const m of MATERIAS_DEFAULT){
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    selMateria.appendChild(opt);
  }
}

/* =========================
   Cargar cursos del año
   ========================= */
async function loadCursos(){
  selCurso.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— Selecciona —";
  selCurso.appendChild(opt0);

  // cursos: { añoLectivo, grado, jornada, nombre }
  // Traemos por añoLectivo
  const q = query(collection(db, "cursos"), where("añoLectivo", "==", configGeneral.anio));
  const snap = await getDocs(q);

  const list = [];
  snap.forEach(d => {
    const data = d.data();
    const nombre = data?.nombre || d.id;
    const grado = data?.grado ?? "";
    const jornada = data?.jornada ?? "";
    list.push({ id: d.id, nombre, grado, jornada });
  });

  // Ordenar en cliente
  list.sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), "es"));

  for(const c of list){
    const opt = document.createElement("option");
    opt.value = c.id; // usaremos el ID del doc como cursoId
    opt.textContent = `${c.nombre} ${c.jornada ? "— " + c.jornada : ""}`;
    selCurso.appendChild(opt);
  }

  // Si tienes hash #listados o #consolidado, no cambia nada
}

/* =========================
   Cargar estudiantes (matriculas + estudiantes)
   ========================= */
async function loadEstudiantesDelCurso(cursoId){
  // matriculas: { anioLectivo, cursoId, estudianteId, activo }
  const qMat = query(
    collection(db, "matriculas"),
    where("anioLectivo", "==", configGeneral.anio),
    where("cursoId", "==", cursoId),
    where("activo", "==", true)
  );

  const matSnap = await getDocs(qMat);
  const estudianteIds = [];
  matSnap.forEach(d => {
    const m = d.data();
    if(m?.estudianteId) estudianteIds.push(m.estudianteId);
  });

  // Cargar estudiantes
  const students = await Promise.all(
    estudianteIds.map(async (sid) => {
      const sSnap = await getDoc(doc(db, "estudiantes", sid));
      if(!sSnap.exists()) return null;
      const s = sSnap.data();
      return {
        estudianteId: sid,
        nombre: s?.nombre || "(Sin nombre)",
        doc: s?.doc || ""
      };
    })
  );

  return students.filter(Boolean).sort((a,b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

/* =========================
   Cargar notas existentes (para curso/periodo/materia)
   ========================= */
async function loadNotasMap(cursoId, periodo, materia){
  // notas: {anioLectivo, periodo, cursoId, estudianteId, materia, nota, docenteUid}
  // NOTA: este query puede pedir índice compuesto. Si Firebase te muestra "Create index", lo creas y listo.
  const qNotas = query(
    collection(db, "notas"),
    where("anioLectivo", "==", configGeneral.anio),
    where("cursoId", "==", cursoId),
    where("periodo", "==", Number(periodo)),
    where("materia", "==", materia)
  );

  const snap = await getDocs(qNotas);
  const map = new Map(); // estudianteId -> {nota, docId}
  snap.forEach(d => {
    const n = d.data();
    if(n?.estudianteId){
      map.set(n.estudianteId, { nota: n?.nota ?? "", docId: d.id });
    }
  });
  return map;
}

/* =========================
   Render tabla
   ========================= */
function renderTable(students, notasMap){
  currentRows = [];

  if(!students.length){
    tbody.innerHTML = `<tr><td colspan="5" class="muted">No hay estudiantes matriculados en este curso (o no existen matrículas activas).</td></tr>`;
    return;
  }

  const rowsHtml = [];
  students.forEach((s, i) => {
    const found = notasMap.get(s.estudianteId);
    const notaVal = found ? found.nota : "";
    const estado = (notaVal === "" || notaVal === null || typeof notaVal === "undefined") ? "Sin nota" : "Registrada";

    currentRows.push({
      idx: i+1,
      estudianteId: s.estudianteId,
      nombre: s.nombre,
      doc: s.doc,
      nota: notaVal,
      notaDocId: found ? found.docId : null
    });

    rowsHtml.push(`
      <tr data-estudiante="${s.estudianteId}">
        <td>${String(i+1).padStart(2,"0")}</td>
        <td>${s.nombre}</td>
        <td>${s.doc || ""}</td>
        <td>
          <input class="noteInput" type="number" step="0.1" min="0" max="5"
            value="${notaVal !== null && typeof notaVal !== "undefined" ? notaVal : ""}"
            placeholder="0.0 - 5.0"/>
        </td>
        <td class="muted statusCell">${estado}</td>
      </tr>
    `);
  });

  tbody.innerHTML = rowsHtml.join("");

  // listeners
  tbody.querySelectorAll("tr").forEach(tr => {
    const input = tr.querySelector(".noteInput");
    const statusCell = tr.querySelector(".statusCell");
    input.addEventListener("input", () => {
      const v = input.value;
      statusCell.textContent = (v === "" ? "Sin nota" : "Editada");
    });
  });
}

/* =========================
   Guardar notas (batch)
   ========================= */
async function saveNotas(){
  const cursoId = selCurso.value;
  const periodo = Number(selPeriodo.value);
  const materia = selMateria.value;

  if(!cursoId){
    setMsg("Selecciona un curso.", false);
    return;
  }
  if(!materia){
    setMsg("Selecciona una materia.", false);
    return;
  }

  const trs = Array.from(tbody.querySelectorAll("tr[data-estudiante]"));
  if(!trs.length){
    setMsg("No hay estudiantes para guardar.", false);
    return;
  }

  const batch = writeBatch(db);

  let writes = 0;
  trs.forEach(tr => {
    const estudianteId = tr.getAttribute("data-estudiante");
    const input = tr.querySelector(".noteInput");
    const raw = input.value;

    // Si está vacío, NO guardamos (y tampoco borramos por ahora)
    if(raw === "") return;

    const nota = Number(raw);
    if(Number.isNaN(nota) || nota < 0 || nota > 5){
      // marca el input
      input.style.borderColor = "rgba(255,77,109,.9)";
      return;
    }else{
      input.style.borderColor = "rgba(255,255,255,.14)";
    }

    // Buscar si ya existía doc
    const row = currentRows.find(r => r.estudianteId === estudianteId);
    const docId = row?.notaDocId;

    let ref;
    if(docId){
      ref = doc(db, "notas", docId);
    }else{
      ref = doc(collection(db, "notas"));
    }

    batch.set(ref, {
      anioLectivo: configGeneral.anio,
      periodo,
      cursoId,
      estudianteId,
      materia,
      nota,
      docenteUid: currentUser.uid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    writes++;
  });

  if(writes === 0){
    setMsg("No hay cambios válidos para guardar (revisa notas vacías o fuera de rango).", false);
    return;
  }

  await batch.commit();
  setMsg(`Listo ✅ Guardadas/actualizadas: ${writes} notas.`, true);

  // Recargar para obtener docIds reales de nuevas notas
  await handleCargar(true);
}

/* =========================
   Descargas
   ========================= */
async function downloadPlantilla(){
  const cursoId = selCurso.value;
  if(!cursoId){ setMsg("Selecciona un curso.", false); return; }

  const students = await loadEstudiantesDelCurso(cursoId);

  const header = ["anioLectivo","cursoId","estudianteId","documento","nombre","materia","periodo","nota"];
  const rows = [header];

  const periodo = Number(selPeriodo.value);
  const materia = selMateria.value;

  students.forEach(s => {
    rows.push([configGeneral.anio, cursoId, s.estudianteId, s.doc || "", s.nombre, materia, periodo, ""]);
  });

  const csv = toCSV(rows);
  downloadFile(`plantilla_${cursoId}_P${periodo}_${materia}.csv`, csv);
  setMsg("Plantilla descargada ✅", true);
}

async function downloadConsolidado(){
  const cursoId = selCurso.value;
  const periodo = Number(selPeriodo.value);
  const materia = selMateria.value;
  if(!cursoId){ setMsg("Selecciona un curso.", false); return; }
  if(!materia){ setMsg("Selecciona una materia.", false); return; }

  // Cargar estudiantes + notas y generar CSV con nota actual
  const students = await loadEstudiantesDelCurso(cursoId);
  const notasMap = await loadNotasMap(cursoId, periodo, materia);

  const header = ["anioLectivo","cursoId","periodo","materia","estudianteId","documento","nombre","nota"];
  const rows = [header];

  students.forEach(s => {
    const found = notasMap.get(s.estudianteId);
    const nota = found ? found.nota : "";
    rows.push([configGeneral.anio, cursoId, periodo, materia, s.estudianteId, s.doc || "", s.nombre, nota]);
  });

  const csv = toCSV(rows);
  downloadFile(`consolidado_${cursoId}_P${periodo}_${materia}.csv`, csv);
  setMsg("Consolidado descargado ✅", true);
}

/* =========================
   Flujo cargar
   ========================= */
async function handleCargar(silent=false){
  const cursoId = selCurso.value;
  const periodo = Number(selPeriodo.value);
  const materia = selMateria.value;

  if(!cursoId){
    if(!silent) setMsg("Selecciona un curso.", false);
    return;
  }

  try{
    if(!silent) setMsg("Cargando estudiantes y notas...", true);

    const students = await loadEstudiantesDelCurso(cursoId);
    const notasMap = await loadNotasMap(cursoId, periodo, materia);

    renderTable(students, notasMap);

    if(!silent) setMsg(`Listo ✅ Estudiantes: ${students.length}.`, true);
  }catch(e){
    console.error(e);
    setMsg("Error cargando. Si Firebase te pide crear un índice, créalo y vuelve a intentar.", false);
  }
}

/* =========================
   Auth Guard
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  await loadConfigGeneral();

  // Perfil
  const pSnap = await getDoc(doc(db, "usuarios", user.uid));
  if(!pSnap.exists()){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  profile = pSnap.data();
  if(profile.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const rol = normalizeRole(profile.rol);
  if(rol !== "docente"){
    alert("Este módulo es solo para Docentes.");
    window.location.href = "app.html";
    return;
  }

  if(userNameEl) userNameEl.textContent = profile.nombre || "(Sin nombre)";
  if(userRoleEl) userRoleEl.textContent = profile.rol || "(Sin rol)";

  loadMaterias();
  await loadCursos();

  setMsg("Selecciona curso, período y materia, luego pulsa “Cargar estudiantes”.", true);
});

/* =========================
   Events
   ========================= */
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

btnBack?.addEventListener("click", () => {
  window.location.href = "app.html";
});

btnCargar?.addEventListener("click", () => handleCargar(false));
btnGuardar?.addEventListener("click", () => saveNotas());
btnPlantilla?.addEventListener("click", () => downloadPlantilla());
btnConsolidado?.addEventListener("click", () => downloadConsolidado());


import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
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
  orderBy,
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
   UI
   ========================= */
const selCurso = document.getElementById("selCurso");
const selPeriodo = document.getElementById("selPeriodo");
const selMateria = document.getElementById("selMateria");

const btnCargar = document.getElementById("btnCargar");
const btnAgregarActividad = document.getElementById("btnAgregarActividad");
const btnGuardar = document.getElementById("btnGuardar");
const btnDescargarCSV = document.getElementById("btnDescargarCSV");

const studentsList = document.getElementById("studentsList");
const countStudents = document.getElementById("countStudents");
const msg = document.getElementById("msg");

/* =========================
   Estado
   ========================= */
let currentUser = null;
let currentProfile = null;

let configGeneral = { añoLectivo: 2025, periodos: 4, institucion: "" };

let materiasCache = [];     // [{id, nombre, grado}]
let planActividades = [];   // [{id, nombre}]
let estudiantes = [];       // [{documento,nombres,apellidos,curso,grado}]
let notasLocal = {};        // { [docEst]: { actividades: { [actId]: {nota, obs} } } }

/* =========================
   Helpers UI
   ========================= */
function showMsg(text, type="") {
  msg.style.display = text ? "block" : "none";
  msg.className = "msg " + (type || "");
  msg.textContent = text || "";
}

function escapeCSV(v){
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"','""')}"`;
  }
  return s;
}

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

function courseToGrade(courseName){
  // "11A" -> 11, "0A" -> 0
  const m = String(courseName || "").match(/^\d+/);
  return m ? Number(m[0]) : null;
}

function makeId(prefix="act"){
  return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

function calcDefinitiva(actMap){
  // promedio de notas válidas
  const notas = Object.values(actMap || {})
    .map(x => Number(x?.nota))
    .filter(n => !Number.isNaN(n) && n >= 0 && n <= 5);

  if (!notas.length) return null;
  const avg = notas.reduce((a,b)=>a+b,0) / notas.length;
  return Math.round(avg * 100) / 100; // 2 dec
}

function setLocalNota(docEst, actId, nota){
  if(!notasLocal[docEst]) notasLocal[docEst] = { actividades: {} };
  if(!notasLocal[docEst].actividades[actId]) notasLocal[docEst].actividades[actId] = { nota:"", obs:"" };
  notasLocal[docEst].actividades[actId].nota = nota;
}

function setLocalObs(docEst, actId, obs){
  if(!notasLocal[docEst]) notasLocal[docEst] = { actividades: {} };
  if(!notasLocal[docEst].actividades[actId]) notasLocal[docEst].actividades[actId] = { nota:"", obs:"" };
  notasLocal[docEst].actividades[actId].obs = obs;
}

/* =========================
   Cargar config general + cursos
   ========================= */
async function loadConfig(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      configGeneral = { ...configGeneral, ...snap.data() };
    }
  }catch(e){
    // no pasa nada
  }
}

async function loadCursos(){
  // carga todos los cursos de la colección "cursos"
  // si tienes añoLectivo como campo, lo filtramos
  const cursos = [];
  const qy = query(collection(db, "cursos"), orderBy("nombre"));
  const snap = await getDocs(qy);
  snap.forEach(d => {
    const data = d.data();
    // si manejas añoLectivo, respétalo
    if(data?.añoLectivo && configGeneral?.añoLectivo && Number(data.añoLectivo) !== Number(configGeneral.añoLectivo)) return;
    cursos.push({ id: d.id, ...data });
  });

  // si en tu colección el "nombre" es "11A", úsalo
  cursos.sort((a,b)=> String(a.nombre||a.id).localeCompare(String(b.nombre||b.id), "es"));

  selCurso.innerHTML = "";
  cursos.forEach(c => {
    const opt = document.createElement("option");
    opt.value = String(c.nombre || c.id);
    opt.textContent = String(c.nombre || c.id);
    selCurso.appendChild(opt);
  });

  if (!selCurso.value && cursos.length) selCurso.value = String(cursos[0].nombre || cursos[0].id);
}

function fillPeriodos(){
  const p = Number(configGeneral?.periodos || 4);
  selPeriodo.innerHTML = "";
  for(let i=1;i<=p;i++){
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    selPeriodo.appendChild(opt);
  }
}

/* =========================
   Materias (desde Firestore)
   ========================= */
async function loadMateriasForGrade(grado){
  selMateria.innerHTML = `<option value="">Cargando materias...</option>`;
  materiasCache = [];

  try{
    // OJO: tú tienes campo "activa: true" (según tu captura)
    // pero por si acaso manejamos "activo" también.
    const q1 = query(
      collection(db, "materias"),
      where("grado", "==", Number(grado))
    );

    const snap = await getDocs(q1);
    snap.forEach(d => {
      const data = d.data();
      const isActive = (data?.activa === true) || (data?.activo === true) || (data?.activa == null && data?.activo == null);
      if(!isActive) return;

      materiasCache.push({
        id: d.id,
        nombre: data?.nombre || d.id,
        grado: data?.grado
      });
    });

    materiasCache.sort((a,b)=> String(a.nombre).localeCompare(String(b.nombre), "es"));

    selMateria.innerHTML = "";
    if(!materiasCache.length){
      selMateria.innerHTML = `<option value="">(No hay materias activas para grado ${grado})</option>`;
      return;
    }

    selMateria.appendChild(new Option("Selecciona materia...", ""));
    materiasCache.forEach(m => {
      selMateria.appendChild(new Option(m.nombre, m.id));
    });

  }catch(e){
    console.error(e);
    selMateria.innerHTML = `<option value="">-- Error cargando materias --</option>`;
    showMsg("❌ Error cargando materias. Revisa permisos/reglas o conexión.", "err");
  }
}

/* =========================
   Plan de actividades (por curso+periodo+materia)
   Guardamos lista en: planesNotas/{anio}_{curso}_{periodo}_{materiaId}
   ========================= */
function planDocId(){
  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;
  const anio = Number(configGeneral?.añoLectivo || 2025);
  return `${anio}_${curso}_${periodo}_${materiaId}`;
}

async function loadPlanActividades(){
  planActividades = [];
  const materiaId = selMateria.value;
  if(!materiaId) return;

  try{
    const snap = await getDoc(doc(db, "planesNotas", planDocId()));
    if(snap.exists()){
      const data = snap.data();
      if(Array.isArray(data?.actividades)){
        planActividades = data.actividades
          .filter(a => a && a.id && a.nombre)
          .map(a => ({ id: a.id, nombre: a.nombre }));
      }
    }
  }catch(e){
    console.error(e);
  }
}

async function savePlanActividades(){
  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;

  const grado = courseToGrade(curso);

  await setDoc(doc(db, "planesNotas", planDocId()), {
    añoLectivo: Number(configGeneral?.añoLectivo || 2025),
    curso,
    grado,
    periodo: Number(periodo),
    materiaId,
    actividades: planActividades,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser?.uid || ""
  }, { merge: true });
}

/* =========================
   Estudiantes + notas
   ========================= */
function notaDocIdForStudent(docEst){
  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;
  const anio = Number(configGeneral?.añoLectivo || 2025);
  return `${anio}_${curso}_${periodo}_${materiaId}_${docEst}`;
}

async function loadEstudiantes(){
  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;

  if(!curso || !periodo || !materiaId){
    showMsg("Completa Curso, Período y Materia.", "warn");
    return;
  }

  showMsg("Cargando estudiantes...", "");
  studentsList.innerHTML = `<div class="muted">Cargando...</div>`;
  countStudents.textContent = "0";

  estudiantes = [];
  notasLocal = {};

  try{
    // Estudiantes por curso
    const qy = query(
      collection(db, "estudiantes"),
      where("curso", "==", String(curso).toUpperCase()),
      where("activo", "==", true)
    );

    const snap = await getDocs(qy);
    snap.forEach(d => {
      const data = d.data();
      estudiantes.push({
        documento: data?.documento || d.id,
        nombres: data?.nombres || "",
        apellidos: data?.apellidos || "",
        curso: data?.curso || curso,
        grado: data?.grado ?? courseToGrade(curso)
      });
    });

    estudiantes.sort((a,b)=> `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, "es"));

    countStudents.textContent = String(estudiantes.length);

    // Cargar plan actividades
    await loadPlanActividades();

    // Cargar notas existentes por estudiante (una por una, para mantenerlo simple)
    for(const st of estudiantes){
      const noteSnap = await getDoc(doc(db, "notas", notaDocIdForStudent(st.documento)));
      if(noteSnap.exists()){
        const data = noteSnap.data();
        const actividades = data?.actividades || {};
        notasLocal[st.documento] = { actividades: {} };

        for(const [actId, v] of Object.entries(actividades)){
          notasLocal[st.documento].actividades[actId] = {
            nota: (v?.nota ?? ""),
            obs: (v?.obs ?? "")
          };
        }
      }else{
        notasLocal[st.documento] = { actividades: {} };
      }
    }

    renderStudents();
    showMsg(`✅ Listo. Estudiantes cargados del curso ${curso}.`, "ok");

  }catch(e){
    console.error(e);
    studentsList.innerHTML = `<div class="muted">No se pudieron cargar estudiantes.</div>`;
    showMsg("❌ Error cargando estudiantes. Revisa permisos/reglas o conexión.", "err");
  }
}

/* =========================
   Render
   ========================= */
function renderStudents(){
  if(!estudiantes.length){
    studentsList.innerHTML = `<div class="muted">No hay estudiantes activos en este curso.</div>`;
    return;
  }

  const actCols = planActividades.length;

  studentsList.innerHTML = "";

  estudiantes.forEach(st => {
    const fullName = `${st.apellidos} ${st.nombres}`.trim() || "(Sin nombre)";
    const actMap = (notasLocal[st.documento]?.actividades) || {};
    const definitiva = calcDefinitiva(actMap);

    const card = document.createElement("div");
    card.className = "student-card";

    const header = document.createElement("div");
    header.className = "student-head";
    header.innerHTML = `
      <div>
        <div class="student-name">${fullName}</div>
        <div class="student-meta">Documento: <b>${st.documento}</b> • Curso: <b>${String(st.curso).toUpperCase()}</b></div>
      </div>
      <div class="student-def">
        <div class="muted">Definitiva</div>
        <div class="def-num">${definitiva == null ? "—" : definitiva.toFixed(2)}</div>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "student-body";

    // Si no hay actividades, mostrar aviso
    if(actCols === 0){
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Aún no hay actividades. Pulsa “+ Agregar actividad”.";
      body.appendChild(empty);
    }else{
      const grid = document.createElement("div");
      grid.className = "acts-grid";

      planActividades.forEach(act => {
        const v = actMap?.[act.id] || { nota:"", obs:"" };

        const box = document.createElement("div");
        box.className = "act-box";

        box.innerHTML = `
          <div class="act-title">${act.nombre}</div>
          <label class="act-label">Nota (0 a 5)</label>
          <input class="act-input" type="number" min="0" max="5" step="0.1" value="${v.nota ?? ""}" placeholder="Ej: 4.5"/>
          <label class="act-label">Observación / Actividad</label>
          <textarea class="act-obs" rows="2" placeholder="Ej: Taller #1, Quiz, Exposición...">${v.obs ?? ""}</textarea>
        `;

        const inputNota = box.querySelector(".act-input");
        const inputObs = box.querySelector(".act-obs");

        inputNota.addEventListener("input", () => {
          setLocalNota(st.documento, act.id, inputNota.value);
          // recalcular definitiva en vivo
          const newDef = calcDefinitiva(notasLocal[st.documento].actividades);
          card.querySelector(".def-num").textContent = (newDef == null) ? "—" : newDef.toFixed(2);
        });

        inputObs.addEventListener("input", () => {
          setLocalObs(st.documento, act.id, inputObs.value);
        });

        grid.appendChild(box);
      });

      body.appendChild(grid);
    }

    card.appendChild(header);
    card.appendChild(body);
    studentsList.appendChild(card);
  });
}

/* =========================
   Guardar notas
   ========================= */
async function saveNotas(){
  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;

  if(!curso || !periodo || !materiaId){
    showMsg("Completa Curso, Período y Materia.", "warn");
    return;
  }
  if(!estudiantes.length){
    showMsg("Primero carga estudiantes.", "warn");
    return;
  }

  showMsg("Guardando notas...", "");

  try{
    const anio = Number(configGeneral?.añoLectivo || 2025);
    const grado = courseToGrade(curso);
    const materiaNombre = materiasCache.find(m => m.id === materiaId)?.nombre || "";

    // Guardamos doc por estudiante
    for(const st of estudiantes){
      const docEst = st.documento;
      const acts = notasLocal?.[docEst]?.actividades || {};

      // normalizar notas a number cuando aplique
      const cleaned = {};
      for(const [actId, v] of Object.entries(acts)){
        const notaNum = (v?.nota === "" || v?.nota == null) ? "" : Number(v.nota);
        cleaned[actId] = {
          nota: (notaNum === "" || Number.isNaN(notaNum)) ? "" : notaNum,
          obs: String(v?.obs || "").trim(),
          updatedAt: serverTimestamp()
        };
      }

      const definitiva = calcDefinitiva(cleaned);

      await setDoc(doc(db, "notas", notaDocIdForStudent(docEst)), {
        añoLectivo: anio,
        grado,
        curso: String(curso).toUpperCase(),
        periodo: Number(periodo),
        materiaId,
        materiaNombre,
        estudianteDoc: docEst,
        estudianteNombre: `${st.apellidos} ${st.nombres}`.trim(),
        actividades: cleaned,
        definitiva: (definitiva == null ? null : definitiva),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || ""
      }, { merge: true });
    }

    showMsg("✅ Notas guardadas correctamente.", "ok");
  }catch(e){
    console.error(e);
    showMsg("❌ Error guardando notas. Revisa permisos/reglas o conexión.", "err");
  }
}

/* =========================
   Agregar actividad
   ========================= */
async function addActividad(){
  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;

  if(!curso || !periodo || !materiaId){
    showMsg("Completa Curso, Período y Materia antes de agregar actividad.", "warn");
    return;
  }

  const nombre = prompt("Nombre de la actividad (Ej: Quiz 1, Taller 2, Exposición):");
  if(!nombre) return;

  planActividades.push({ id: makeId("act"), nombre: nombre.trim() });
  await savePlanActividades();

  // re-render estudiantes con la nueva actividad
  renderStudents();
  showMsg("✅ Actividad agregada.", "ok");
}

/* =========================
   Descargar CSV consolidado
   ========================= */
function downloadCSV(){
  if(!estudiantes.length){
    showMsg("Primero carga estudiantes.", "warn");
    return;
  }

  const curso = selCurso.value;
  const periodo = selPeriodo.value;
  const materiaId = selMateria.value;
  const materiaNombre = materiasCache.find(m => m.id === materiaId)?.nombre || "";

  // Encabezados: Documento, Nombre, Definitiva, y por cada actividad: Nota + Observación
  const headers = ["Documento","Nombre","Curso","Periodo","Materia","Definitiva"];
  planActividades.forEach(a => {
    headers.push(`Nota - ${a.nombre}`);
    headers.push(`Obs - ${a.nombre}`);
  });

  const rows = [];
  rows.push(headers.map(escapeCSV).join(","));

  estudiantes.forEach(st => {
    const fullName = `${st.apellidos} ${st.nombres}`.trim();
    const actMap = notasLocal?.[st.documento]?.actividades || {};
    const def = calcDefinitiva(actMap);

    const row = [
      st.documento,
      fullName,
      String(selCurso.value).toUpperCase(),
      selPeriodo.value,
      materiaNombre,
      (def == null ? "" : def.toFixed(2))
    ];

    planActividades.forEach(a => {
      const v = actMap?.[a.id] || { nota:"", obs:"" };
      row.push(v?.nota ?? "");
      row.push(v?.obs ?? "");
    });

    rows.push(row.map(escapeCSV).join(","));
  });

  const csv = rows.join("\n");
  downloadText(`consolidado_${selCurso.value}_P${selPeriodo.value}_${materiaNombre || "materia"}.csv`, csv);
}

/* =========================
   Eventos UI
   ========================= */
selCurso.addEventListener("change", async () => {
  const grado = courseToGrade(selCurso.value);
  await loadMateriasForGrade(grado);
});

btnCargar.addEventListener("click", loadEstudiantes);
btnAgregarActividad.addEventListener("click", addActividad);
btnGuardar.addEventListener("click", saveNotas);
btnDescargarCSV.addEventListener("click", downloadCSV);

// si cambia materia o periodo, limpiamos estudiantes en pantalla (para evitar confusiones)
selPeriodo.addEventListener("change", () => {
  estudiantes = [];
  notasLocal = {};
  studentsList.innerHTML = `<div class="muted">Cambia filtros y pulsa “Cargar estudiantes”.</div>`;
  countStudents.textContent = "0";
});
selMateria.addEventListener("change", () => {
  estudiantes = [];
  notasLocal = {};
  studentsList.innerHTML = `<div class="muted">Cambia filtros y pulsa “Cargar estudiantes”.</div>`;
  countStudents.textContent = "0";
});

/* =========================
   Auth guard + init
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }
  currentUser = user;

  await loadConfig();
  fillPeriodos();
  await loadCursos();

  // cargar materias para el curso inicial
  const grado = courseToGrade(selCurso.value);
  await loadMateriasForGrade(grado);

  showMsg("", "");
});

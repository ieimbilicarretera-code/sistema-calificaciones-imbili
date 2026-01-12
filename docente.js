import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
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

const btnBack = document.getElementById("btnBack");

const slCurso = document.getElementById("slCurso");
const slPeriodo = document.getElementById("slPeriodo");
const slMateria = document.getElementById("slMateria");

const btnCargar = document.getElementById("btnCargar");
const btnGuardar = document.getElementById("btnGuardar");
const btnAddActividad = document.getElementById("btnAddActividad");

const msgOk = document.getElementById("msgOk");
const msgWarn = document.getElementById("msgWarn");
const msgErr = document.getElementById("msgErr");

const tableWrap = document.getElementById("tableWrap");
const countEst = document.getElementById("countEst");

/* =========================
   Helpers
   ========================= */
function showMsg(el, text) {
  [msgOk, msgWarn, msgErr].forEach(x => { if (x) x.style.display = "none"; });
  if (!el) return;
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function normalizeRole(r) {
  return String(r || "").trim().toLowerCase();
}

function cursoToGradoNumber(cursoStr) {
  // "11A" -> 11, "0A" -> 0
  const m = String(cursoStr || "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function clampNota(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  if (Number.isNaN(n)) return null;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return Math.round(n * 100) / 100;
}

function calcDefinitiva(acts) {
  const vals = acts
    .map(a => a.nota)
    .filter(n => typeof n === "number" && !Number.isNaN(n));
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg * 100) / 100;
}

/* =========================
   Estado en memoria
   ========================= */
let currentUser = null;
let currentProfile = null;
let estudiantes = []; // [{documento, nombres, apellidos, ...}]
let actividades = [
  { id: "act1", nombre: "Actividad 1" },
  { id: "act2", nombre: "Actividad 2" },
  { id: "act3", nombre: "Actividad 3" }
];

// notasPorEstudiante[documento] = { actividades: [{id,nombre,nota,obs}], definitiva }
let notasPorEstudiante = {};

// materia seleccionada
let selectedMateria = null; // {id, nombre, grado}

/* =========================
   Cargar config general
   ========================= */
async function loadConfigGeneral() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const cfg = snap.data();
      if (cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if (cfg?.añoLectivo != null) anioEl.textContent = String(cfg.añoLectivo);
      if (cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
    }
  } catch (e) {
    // ignore
  }
}

/* =========================
   Cargar perfil usuario
   ========================= */
async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return snap.data();
}

/* =========================
   Cargar cursos en select
   ========================= */
async function loadCursos() {
  slCurso.innerHTML = "";
  try {
    // cursos: docs tipo "11A", "1A", "0A"
    const qs = await getDocs(collection(db, "cursos"));
    const arr = [];
    qs.forEach(d => {
      const data = d.data();
      if (data?.nombre) arr.push(data.nombre);
      else arr.push(d.id);
    });

    // ordenar por grado y letra
    arr.sort((a, b) => {
      const ga = cursoToGradoNumber(a) ?? 999;
      const gb = cursoToGradoNumber(b) ?? 999;
      if (ga !== gb) return ga - gb;
      return String(a).localeCompare(String(b));
    });

    arr.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      slCurso.appendChild(opt);
    });

    if (!arr.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No hay cursos";
      slCurso.appendChild(opt);
    }
  } catch (e) {
    console.error(e);
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Error cargando cursos";
    slCurso.appendChild(opt);
  }
}

/* =========================
   Cargar materias según grado
   ========================= */
async function loadMateriasByCurso(cursoSel) {
  slMateria.innerHTML = `<option value="">-- Selecciona --</option>`;
  selectedMateria = null;

  const grado = cursoToGradoNumber(cursoSel);
  if (grado === null) {
    slMateria.innerHTML = `<option value="">-- Error: curso inválido --</option>`;
    return;
  }

  try {
    // materias where activa==true AND grado==numero
    const qy = query(
      collection(db, "materias"),
      where("activa", "==", true),
      where("grado", "==", grado)
    );

    const snap = await getDocs(qy);
    const mats = [];
    snap.forEach(d => {
      const data = d.data();
      mats.push({
        id: d.id,
        nombre: data?.nombre || d.id,
        grado: data?.grado
      });
    });

    mats.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

    if (!mats.length) {
      slMateria.innerHTML = `<option value="">(No hay materias activas para grado ${grado})</option>`;
      return;
    }

    mats.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.nombre;
      slMateria.appendChild(opt);
    });

  } catch (e) {
    console.error(e);
    slMateria.innerHTML = `<option value="">-- Error cargando materias --</option>`;
  }
}

/* =========================
   Render tabla (estudiantes + actividades)
   ========================= */
function renderTable() {
  if (!selectedMateria) {
    tableWrap.innerHTML = `<div class="muted">Selecciona una materia.</div>`;
    countEst.textContent = "0";
    return;
  }

  if (!estudiantes.length) {
    tableWrap.innerHTML = `<div class="muted">No hay estudiantes en este curso (o no se han cargado).</div>`;
    countEst.textContent = "0";
    return;
  }

  countEst.textContent = String(estudiantes.length);

  // header columnas
  const headActs = actividades.map(a => {
    return `
      <th class="thAct">
        <input class="actName" data-actname="${a.id}" value="${a.nombre}" />
        <div class="muted small">Nota / Observación</div>
      </th>
    `;
  }).join("");

  const rows = estudiantes.map(st => {
    const docu = st.documento;
    const estado = notasPorEstudiante[docu] || { actividades: actividades.map(a => ({...a, nota:null, obs:""})), definitiva:null };
    const def = estado.definitiva;

    const actCells = estado.actividades.map(a => {
      const notaVal = (typeof a.nota === "number") ? String(a.nota) : "";
      const obsVal = a.obs || "";
      return `
        <td class="tdAct">
          <input class="notaInput" type="number" min="0" max="5" step="0.01"
            data-doc="${docu}" data-act="${a.id}" value="${notaVal}" placeholder="0.0 - 5.0" />
          <textarea class="obsInput" rows="2"
            data-doc="${docu}" data-act="${a.id}" placeholder="Observación / actividad...">${obsVal}</textarea>
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="tdDoc">${docu}</td>
        <td class="tdName">${(st.apellidos || "").toUpperCase()} ${(st.nombres || "").toUpperCase()}</td>
        ${actCells}
        <td class="tdDef">
          <div class="defBox">${def === null ? "—" : def.toFixed(2)}</div>
        </td>
      </tr>
    `;
  }).join("");

  tableWrap.innerHTML = `
    <div class="responsiveTable">
      <table class="gradeTable">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Nombre</th>
            ${headActs}
            <th>Definitiva</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  // eventos para cambiar nombre actividad
  tableWrap.querySelectorAll(".actName").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const actId = e.target.getAttribute("data-actname");
      const act = actividades.find(x => x.id === actId);
      if (act) {
        act.nombre = String(e.target.value || "").trim() || act.nombre;
        // sincronizar nombres dentro de notasPorEstudiante
        Object.keys(notasPorEstudiante).forEach(docu => {
          notasPorEstudiante[docu].actividades.forEach(a => {
            if (a.id === actId) a.nombre = act.nombre;
          });
        });
      }
    });
  });

  // eventos de nota y observación
  tableWrap.querySelectorAll(".notaInput").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const docu = e.target.getAttribute("data-doc");
      const actId = e.target.getAttribute("data-act");
      const n = clampNota(e.target.value);

      ensureStudentState(docu);
      const act = notasPorEstudiante[docu].actividades.find(a => a.id === actId);
      if (act) act.nota = n;

      notasPorEstudiante[docu].definitiva = calcDefinitiva(notasPorEstudiante[docu].actividades);
      // refrescar solo la definitiva rápido
      renderOnlyDef(docu);
    });
  });

  tableWrap.querySelectorAll(".obsInput").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const docu = e.target.getAttribute("data-doc");
      const actId = e.target.getAttribute("data-act");
      const val = String(e.target.value || "");

      ensureStudentState(docu);
      const act = notasPorEstudiante[docu].actividades.find(a => a.id === actId);
      if (act) act.obs = val;
    });
  });
}

function renderOnlyDef(docu) {
  // re-render mínima: buscamos la fila y cambiamos el div
  const def = notasPorEstudiante[docu]?.definitiva ?? null;
  const row = tableWrap.querySelector(`input[data-doc="${docu}"]`)?.closest("tr");
  if (!row) return;
  const box = row.querySelector(".defBox");
  if (box) box.textContent = (def === null) ? "—" : def.toFixed(2);
}

function ensureStudentState(docu) {
  if (!notasPorEstudiante[docu]) {
    notasPorEstudiante[docu] = {
      actividades: actividades.map(a => ({ id: a.id, nombre: a.nombre, nota: null, obs: "" })),
      definitiva: null
    };
  } else {
    // si agregaron actividades nuevas, las anexamos
    const existingIds = new Set(notasPorEstudiante[docu].actividades.map(a => a.id));
    actividades.forEach(a => {
      if (!existingIds.has(a.id)) {
        notasPorEstudiante[docu].actividades.push({ id: a.id, nombre: a.nombre, nota: null, obs: "" });
      }
    });
    // actualizar nombres
    notasPorEstudiante[docu].actividades.forEach(a => {
      const ref = actividades.find(x => x.id === a.id);
      if (ref) a.nombre = ref.nombre;
    });
  }
}

/* =========================
   Cargar estudiantes (por curso)
   ========================= */
async function cargarEstudiantes() {
  showMsg(msgOk, "");
  showMsg(msgWarn, "");
  showMsg(msgErr, "");

  const cursoSel = slCurso.value;
  const periodoSel = slPeriodo.value;
  const materiaId = slMateria.value;

  if (!cursoSel || !periodoSel || !materiaId) {
    showMsg(msgWarn, "Selecciona curso, período y materia.");
    return;
  }

  // guardar materia seleccionada
  selectedMateria = { id: materiaId, nombre: slMateria.options[slMateria.selectedIndex]?.textContent || "", grado: cursoToGradoNumber(cursoSel) };

  try {
    // estudiantes where activo==true AND curso == cursoSel
    const qy = query(
      collection(db, "estudiantes"),
      where("activo", "==", true),
      where("curso", "==", cursoSel)
    );

    const snap = await getDocs(qy);
    estudiantes = [];
    snap.forEach(d => {
      const st = d.data();
      estudiantes.push({
        documento: st.documento || d.id,
        nombres: st.nombres || "",
        apellidos: st.apellidos || ""
      });
    });

    // ordenar por apellido/nombre
    estudiantes.sort((a,b) => {
      const aa = (a.apellidos + " " + a.nombres).toUpperCase();
      const bb = (b.apellidos + " " + b.nombres).toUpperCase();
      return aa.localeCompare(bb);
    });

    // cargar notas existentes si las hay
    await loadExistingNotas(cursoSel, periodoSel, materiaId);

    showMsg(msgOk, `Listo. Estudiantes cargados del curso ${cursoSel}.`);
    renderTable();
  } catch (e) {
    console.error(e);
    showMsg(msgErr, "No se pudieron cargar estudiantes. Revisa reglas/permisos o conexión.");
  }
}

/* =========================
   Cargar notas existentes (si ya se guardaron antes)
   ========================= */
async function loadExistingNotas(cursoSel, periodoSel, materiaId) {
  notasPorEstudiante = {};

  // estrategia simple: cada estudiante tiene doc en "notas" con id:
  // 2025_11A_2_<materiaId>_<documento>
  const anio = (anioEl?.textContent || "").trim() || "2025";

  const tasks = estudiantes.map(async (st) => {
    const id = `${anio}_${cursoSel}_${periodoSel}_${materiaId}_${st.documento}`;
    const snap = await getDoc(doc(db, "notas", id));
    if (snap.exists()) {
      const data = snap.data();
      // reconstruir actividades
      const savedActs = Array.isArray(data?.actividades) ? data.actividades : [];
      notasPorEstudiante[st.documento] = {
        actividades: savedActs.map(a => ({
          id: a.id,
          nombre: a.nombre || a.id,
          nota: (typeof a.nota === "number") ? a.nota : null,
          obs: a.obs || ""
        })),
        definitiva: (typeof data?.definitiva === "number") ? data.definitiva : null
      };

      // sincronizar lista global de actividades (por si el periodo ya tenía más)
      savedActs.forEach(a => {
        if (!actividades.find(x => x.id === a.id)) {
          actividades.push({ id: a.id, nombre: a.nombre || a.id });
        }
      });
    }
  });

  await Promise.all(tasks);

  // asegurar que todos tengan estado
  estudiantes.forEach(st => ensureStudentState(st.documento));
  // recalcular definitivas por seguridad
  estudiantes.forEach(st => {
    notasPorEstudiante[st.documento].definitiva = calcDefinitiva(notasPorEstudiante[st.documento].actividades);
  });
}

/* =========================
   Guardar notas
   ========================= */
async function guardarNotas() {
  showMsg(msgOk, "");
  showMsg(msgWarn, "");
  showMsg(msgErr, "");

  const cursoSel = slCurso.value;
  const periodoSel = slPeriodo.value;
  const materiaId = slMateria.value;

  if (!cursoSel || !periodoSel || !materiaId) {
    showMsg(msgWarn, "Selecciona curso, período y materia.");
    return;
  }
  if (!selectedMateria) {
    showMsg(msgWarn, "Selecciona una materia válida.");
    return;
  }
  if (!estudiantes.length) {
    showMsg(msgWarn, "Primero carga estudiantes.");
    return;
  }

  const anio = (anioEl?.textContent || "").trim() || "2025";

  try {
    // guardado “uno por estudiante”
    // (si luego quieres batch grande, lo optimizamos)
    for (const st of estudiantes) {
      const state = notasPorEstudiante[st.documento];
      const id = `${anio}_${cursoSel}_${periodoSel}_${materiaId}_${st.documento}`;

      const payload = {
        anio: Number(anio) || anio,
        curso: cursoSel,
        periodo: Number(periodoSel),
        materiaId,
        materiaNombre: selectedMateria.nombre,
        estudianteDocumento: st.documento,
        estudianteNombre: `${(st.apellidos||"").toUpperCase()} ${(st.nombres||"").toUpperCase()}`.trim(),
        docenteUid: currentUser.uid,
        docenteNombre: currentProfile?.nombre || "",
        actividades: (state?.actividades || []).map(a => ({
          id: a.id,
          nombre: a.nombre,
          nota: (typeof a.nota === "number") ? a.nota : null,
          obs: a.obs || ""
        })),
        definitiva: (typeof state?.definitiva === "number") ? state.definitiva : null,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "notas", id), payload, { merge: true });
    }

    showMsg(msgOk, "✅ Notas guardadas correctamente.");
  } catch (e) {
    console.error(e);
    showMsg(msgErr, "❌ No se pudieron guardar las notas. Revisa reglas/permisos o conexión.");
  }
}

/* =========================
   Agregar actividad (columna)
   ========================= */
function addActividad() {
  const next = actividades.length + 1;
  const id = `act${Date.now()}`;
  actividades.push({ id, nombre: `Actividad ${next}` });

  // agregar a cada estudiante
  estudiantes.forEach(st => {
    ensureStudentState(st.documento);
  });

  renderTable();
}

/* =========================
   Eventos UI
   ========================= */
btnBack?.addEventListener("click", () => {
  // volver al panel principal
  window.location.href = "app.html";
});

slCurso?.addEventListener("change", async () => {
  await loadMateriasByCurso(slCurso.value);

  // reset vista
  estudiantes = [];
  notasPorEstudiante = {};
  selectedMateria = null;
  tableWrap.innerHTML = `<div class="muted">Selecciona filtros y pulsa “Cargar estudiantes”.</div>`;
  countEst.textContent = "0";
});

slMateria?.addEventListener("change", () => {
  // reset tabla hasta cargar estudiantes
  estudiantes = [];
  notasPorEstudiante = {};
  selectedMateria = null;
  tableWrap.innerHTML = `<div class="muted">Selecciona filtros y pulsa “Cargar estudiantes”.</div>`;
  countEst.textContent = "0";
});

btnCargar?.addEventListener("click", cargarEstudiantes);
btnGuardar?.addEventListener("click", guardarNotas);
btnAddActividad?.addEventListener("click", addActividad);

/* =========================
   Guard de sesión
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  await loadConfigGeneral();

  const prof = await loadUserProfile(user.uid);
  if (!prof) {
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    window.location.href = "index.html";
    return;
  }
  if (prof.activo !== true) {
    alert("Usuario inactivo. Contacta a soporte.");
    window.location.href = "index.html";
    return;
  }

  currentProfile = prof;

  userNameEl.textContent = prof.nombre || "(Sin nombre)";
  userRoleEl.textContent = prof.rol || "(Sin rol)";

  const role = normalizeRole(prof.rol);
  const allowed = ["docente", "soporte", "rector", "rectora", "coordinador", "coordinador académico", "coordinador academico"];
  if (!allowed.includes(role)) {
    alert("No tienes permisos para el módulo Docente.");
    window.location.href = "app.html";
    return;
  }

  await loadCursos();
  await loadMateriasByCurso(slCurso.value);

  showMsg(msgOk, "");
  showMsg(msgWarn, "");
  showMsg(msgErr, "");
});

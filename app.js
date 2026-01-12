import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  orderBy
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
   UI refs generales
   ========================= */
const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const btnLogout = document.getElementById("btnLogout");

const viewMenu = document.getElementById("viewMenu");
const viewSecretaria = document.getElementById("viewSecretaria");
const viewDocente = document.getElementById("viewDocente");
const modulesGrid = document.getElementById("modulesGrid");

/* Volver */
document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => showView(viewMenu));
});

/* =========================
   Helpers
   ========================= */
function showView(viewEl){
  [viewMenu, viewSecretaria, viewDocente].forEach(v => v?.classList.remove("active"));
  viewEl?.classList.add("active");
}

function normalizeRole(r){
  return String(r || "").trim().toLowerCase();
}

function setMsg(el, text, type=""){
  if(!el) return;
  el.style.display = text ? "block" : "none";
  el.className = "msg " + (type || "");
  el.textContent = text || "";
}

function safeUpper(s){ return String(s||"").trim().toUpperCase(); }

function getGradoFromCurso(curso){
  // curso: "11A", "0A", "5B" => grado = 11, 0, 5
  const m = String(curso||"").trim().match(/^(\d{1,2})/);
  return m ? Number(m[1]) : null;
}

function materiaKey(nombre){
  return String(nombre||"")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_ñáéíóúü-]/gi,"");
}

async function loadConfigGeneral() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const cfg = snap.data();
      if (instNameEl && cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if (anioEl && cfg?.añoLectivo != null) anioEl.textContent = String(cfg.añoLectivo);
      if (periodosEl && cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
    }
  } catch (e) {}
}

async function loadUserProfile(uid) {
  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if (!userSnap.exists()) return null;
  return userSnap.data();
}

/* =========================
   Módulos por rol
   ========================= */
function renderModulesByRole(roleRaw){
  const role = normalizeRole(roleRaw);
  if(!modulesGrid) return;
  modulesGrid.innerHTML = "";

  const canSeeSecretaria = [
    "secretaria","soporte","rector","rectora",
    "coordinador","coordinador academico","coordinador académico"
  ].includes(role);

  const canSeeDocente = [
    "docente","soporte","rector","rectora",
    "coordinador","coordinador academico","coordinador académico"
  ].includes(role);

  const modules = [
    {
      title: "Secretaría • Estudiantes",
      desc: "Registrar estudiantes (individual o carga masiva CSV).",
      badge: "Secretaría",
      icon: "SE",
      enabled: canSeeSecretaria,
      onClick: () => showView(viewSecretaria)
    },
    {
      title: "Docente • Registro de notas",
      desc: "Ver estudiantes por curso y registrar actividades (nota + observación).",
      badge: "Docente",
      icon: "DO",
      enabled: canSeeDocente,
      onClick: async () => {
        showView(viewDocente);
        await loadCursosToSelect();
      }
    }
  ];

  modules.forEach(m => {
    const btn = document.createElement("button");
    btn.className = "module-btn";
    btn.disabled = !m.enabled;

    btn.innerHTML = `
      <div class="module-left">
        <div class="module-icon">${m.icon}</div>
        <div class="module-text">
          <h3>${m.title}</h3>
          <p>${m.desc}</p>
        </div>
      </div>
      <div class="module-right">
        <span class="badge">${m.badge}</span>
        <span class="arrow">→</span>
      </div>
    `;

    btn.addEventListener("click", async () => {
      if(!m.enabled){
        alert("No tienes permisos para este módulo.");
        return;
      }
      await m.onClick();
    });

    modulesGrid.appendChild(btn);
  });
}

/* =========================
   SECRETARÍA (igual que venías)
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

const btnGuardarEstudiante = document.getElementById("btnGuardarEstudiante");
const btnLimpiarEstudiante = document.getElementById("btnLimpiarEstudiante");

const msgSecretaria1 = document.getElementById("msgSecretaria1");
const msgSecretaria2 = document.getElementById("msgSecretaria2");

function limpiarFormEstudiante(){
  if(!stTipoDoc) return;
  stTipoDoc.value = "TI";
  stDocumento.value = "";
  stNombres.value = "";
  stApellidos.value = "";
  stGrado.value = "";
  stCurso.value = "";
  stJornada.value = "Mañana";
  stNacimiento.value = "";
  stEdad.value = "";
  stCorreo.value = "";
  stTelefono.value = "";
  stDireccion.value = "";
  setMsg(msgSecretaria1, "", "");
}
btnLimpiarEstudiante?.addEventListener("click", limpiarFormEstudiante);

btnGuardarEstudiante?.addEventListener("click", async () => {
  try{
    setMsg(msgSecretaria1, "", "");

    const documento = String(stDocumento.value || "").trim();
    const nombres = String(stNombres.value || "").trim();
    const apellidos = String(stApellidos.value || "").trim();
    const grado = String(stGrado.value || "").trim();
    const curso = safeUpper(stCurso.value || "");

    if(!documento || !nombres || !apellidos || !grado || !curso){
      setMsg(msgSecretaria1, "Faltan campos obligatorios (*).", "warn");
      return;
    }

    const payload = {
      tipoDoc: String(stTipoDoc.value || "TI"),
      documento,
      nombres,
      apellidos,
      grado: isNaN(Number(grado)) ? grado : Number(grado),
      curso,
      jornada: String(stJornada.value || "Mañana"),
      nacimiento: stNacimiento.value ? String(stNacimiento.value) : "",
      edad: stEdad.value ? Number(stEdad.value) : null,
      correo: String(stCorreo.value || "").trim(),
      telefono: String(stTelefono.value || "").trim(),
      direccion: String(stDireccion.value || "").trim(),
      activo: true,
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "estudiantes", documento), payload, { merge: true });
    setMsg(msgSecretaria1, `✅ Estudiante guardado: ${documento} - ${nombres} ${apellidos}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgSecretaria1, "❌ No se pudo guardar. Revisa permisos/reglas o conexión.", "err");
  }
});

/* CSV */
const csvFile = document.getElementById("csvFile");
const btnImportarCSV = document.getElementById("btnImportarCSV");
const btnDescargarPlantillaCSV = document.getElementById("btnDescargarPlantillaCSV");

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

btnDescargarPlantillaCSV?.addEventListener("click", () => {
  const sample =
`tipoDoc,documento,nombres,apellidos,grado,curso,jornada,edad,correo,telefono,direccion
TI,123456789,JUAN,CARLOS,11,11A,Mañana,16,acudiente@gmail.com,3110000000,Barrio X
`;
  downloadText("plantilla_estudiantes.csv", sample);
});

function parseCSV(text){
  const sep = text.includes(";") && !text.includes(",") ? ";" : (text.includes(";") ? ";" : ",");
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if(lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep).map(c => c.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] ?? "");
    rows.push(obj);
  }
  return { headers, rows };
}

btnImportarCSV?.addEventListener("click", async () => {
  try{
    setMsg(msgSecretaria2, "", "");

    const file = csvFile?.files?.[0];
    if(!file){
      setMsg(msgSecretaria2, "Selecciona un archivo CSV primero.", "warn");
      return;
    }

    const text = await file.text();
    const { rows } = parseCSV(text);

    if(rows.length === 0){
      setMsg(msgSecretaria2, "El CSV no tiene filas de datos.", "warn");
      return;
    }

    const batch = writeBatch(db);
    let okCount = 0, skipCount = 0;

    rows.forEach(r => {
      const documento = String(r.documento || "").trim();
      const nombres = String(r.nombres || "").trim();
      const apellidos = String(r.apellidos || "").trim();
      const gradoRaw = String(r.grado || "").trim();
      const curso = safeUpper(r.curso || "");

      if(!documento || !nombres || !apellidos || !gradoRaw || !curso){
        skipCount++;
        return;
      }

      const payload = {
        tipoDoc: String(r.tipodoc || r.tipoDoc || "TI").trim() || "TI",
        documento,
        nombres,
        apellidos,
        grado: isNaN(Number(gradoRaw)) ? gradoRaw : Number(gradoRaw),
        curso,
        jornada: String(r.jornada || "Mañana").trim() || "Mañana",
        edad: r.edad ? Number(r.edad) : null,
        correo: String(r.correo || "").trim(),
        telefono: String(r.telefono || "").trim(),
        direccion: String(r.direccion || "").trim(),
        activo: true,
        updatedAt: serverTimestamp()
      };

      batch.set(doc(db, "estudiantes", documento), payload, { merge: true });
      okCount++;
    });

    if(okCount === 0){
      setMsg(msgSecretaria2, "No se encontraron filas válidas. Revisa encabezados.", "warn");
      return;
    }

    await batch.commit();
    setMsg(msgSecretaria2, `✅ Importación lista. Guardados/actualizados: ${okCount}. Omitidos: ${skipCount}.`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgSecretaria2, "❌ Error importando CSV. Revisa consola/permisos/reglas.", "err");
  }
});

/* =========================
   DOCENTE: materias + actividades + definitiva
   ========================= */
const dcCurso = document.getElementById("dcCurso");
const dcPeriodo = document.getElementById("dcPeriodo");
const dcMateriaSelect = document.getElementById("dcMateriaSelect");

const btnCargarEstudiantes = document.getElementById("btnCargarEstudiantes");
const btnGuardarNotas = document.getElementById("btnGuardarNotas");
const btnAddActividad = document.getElementById("btnAddActividad");

const dcTbody = document.getElementById("dcTbody");
const dcThead = document.getElementById("dcThead");
const dcInfo = document.getElementById("dcInfo");
const msgDocente = document.getElementById("msgDocente");

let currentStudents = [];
let actividades = [
  { nombre: "Actividad 1" },
  { nombre: "Actividad 2" },
  { nombre: "Actividad 3" }
];

async function loadCursosToSelect(){
  try{
    if(!dcCurso) return;
    dcCurso.innerHTML = `<option value="">-- Selecciona --</option>`;
    const snap = await getDocs(query(collection(db, "cursos"), orderBy("nombre", "asc")));
    snap.forEach(d => {
      const c = d.data();
      const val = safeUpper(c?.nombre || d.id);
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      dcCurso.appendChild(opt);
    });
  }catch(e){ console.error(e); }
}

async function loadMateriasByCurso(curso){
  try{
    const grado = getGradoFromCurso(curso);
    if(grado === null){
      dcMateriaSelect.innerHTML = `<option value="">-- Curso inválido --</option>`;
      return;
    }

    dcMateriaSelect.innerHTML = `<option value="">Cargando materias...</option>`;

    const qy = query(
      collection(db, "materias"),
      where("grado", "==", grado),
      where("activa", "==", true),
      orderBy("nombre", "asc")
    );

    const snap = await getDocs(qy);
    const mats = [];
    snap.forEach(d => mats.push(d.data()));

    if(mats.length === 0){
      dcMateriaSelect.innerHTML = `<option value="">-- No hay materias para grado ${grado} --</option>`;
      return;
    }

    dcMateriaSelect.innerHTML = `<option value="">-- Selecciona --</option>`;
    mats.forEach(m => {
      const opt = document.createElement("option");
      opt.value = String(m.nombre || "").trim();
      opt.textContent = String(m.nombre || "").trim();
      dcMateriaSelect.appendChild(opt);
    });
  }catch(e){
    console.error(e);
    dcMateriaSelect.innerHTML = `<option value="">-- Error cargando materias --</option>`;
  }
}

dcCurso?.addEventListener("change", async () => {
  const curso = safeUpper(dcCurso.value || "");
  if(!curso){
    dcMateriaSelect.innerHTML = `<option value="">-- Selecciona curso primero --</option>`;
    return;
  }
  await loadMateriasByCurso(curso);
});

btnAddActividad?.addEventListener("click", () => {
  const n = actividades.length + 1;
  actividades.push({ nombre: `Actividad ${n}` });
  // re-render si ya hay estudiantes
  if(currentStudents.length > 0) renderStudentsTable(currentStudents);
});

function calcDefinitivaForDocumento(documento){
  // toma todos los inputs de nota del estudiante y promedia los que estén diligenciados
  const row = document.querySelector(`tr[data-doc="${documento}"]`);
  if(!row) return null;

  const notaInputs = Array.from(row.querySelectorAll("input[data-act]"));
  const vals = notaInputs
    .map(i => String(i.value || "").trim())
    .filter(v => v !== "")
    .map(v => Number(v))
    .filter(x => !Number.isNaN(x) && x >= 0 && x <= 5);

  if(vals.length === 0) return null;
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  return Math.round(avg * 100) / 100;
}

function updateDefinitivaUI(documento){
  const avg = calcDefinitivaForDocumento(documento);
  const el = document.getElementById(`def_${documento}`);
  if(!el) return;
  el.textContent = (avg === null) ? "—" : avg.toFixed(2);
}

function renderThead(){
  const base = `
    <tr>
      <th style="width:140px;">Documento</th>
      <th style="min-width:220px;">Nombre</th>
      <th style="width:110px;">Definitiva</th>
      ${actividades.map((a, idx) => `<th class="actCell">${a.nombre}</th>`).join("")}
    </tr>
  `;
  dcThead.innerHTML = base;
}

function renderStudentsTable(list){
  currentStudents = list || [];
  renderThead();

  if(!dcTbody) return;

  if(currentStudents.length === 0){
    dcTbody.innerHTML = `<tr><td colspan="${3 + actividades.length}" class="muted">No hay estudiantes para ese curso.</td></tr>`;
    if(dcInfo) dcInfo.textContent = "0 estudiantes";
    return;
  }

  if(dcInfo) dcInfo.textContent = `${currentStudents.length} estudiantes`;

  dcTbody.innerHTML = currentStudents.map(s => {
    const fullName = `${s.apellidos || ""} ${s.nombres || ""}`.trim();
    const docu = s.documento || s.id || "";

    return `
      <tr data-doc="${docu}">
        <td>${docu}</td>
        <td>${fullName}</td>
        <td class="defBox" id="def_${docu}">—</td>

        ${actividades.map((a, idx) => `
          <td class="actCell">
            <div class="actBox">
              <div class="actRow">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="0.0 - 5.0"
                  data-act="${idx}"
                  data-doc="${docu}"
                  class="notaAct"
                />
              </div>
              <textarea
                placeholder="Observación / actividad / evidencia..."
                data-obs="${idx}"
                data-doc="${docu}"
                class="obsAct"
              ></textarea>
            </div>
          </td>
        `).join("")}
      </tr>
    `;
  }).join("");

  // listeners para cálculo de definitiva en vivo
  document.querySelectorAll(".notaAct").forEach(inp => {
    inp.addEventListener("input", () => {
      const documento = inp.getAttribute("data-doc");
      updateDefinitivaUI(documento);
    });
  });

  // inicializa definitivas
  currentStudents.forEach(s => {
    const docu = s.documento || s.id || "";
    updateDefinitivaUI(docu);
  });
}

btnCargarEstudiantes?.addEventListener("click", async () => {
  try{
    setMsg(msgDocente, "", "");

    const curso = safeUpper(dcCurso.value || "");
    const periodo = String(dcPeriodo.value || "").trim();
    const materia = String(dcMateriaSelect.value || "").trim();

    if(!curso){
      setMsg(msgDocente, "Selecciona un curso.", "warn");
      return;
    }
    if(!periodo){
      setMsg(msgDocente, "Selecciona un período.", "warn");
      return;
    }
    if(!materia){
      setMsg(msgDocente, "Selecciona una materia.", "warn");
      return;
    }

    const qy = query(collection(db, "estudiantes"), where("curso", "==", curso));
    const snap = await getDocs(qy);
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    list.sort((a,b) => {
      const aa = `${a.apellidos||""} ${a.nombres||""}`.toUpperCase();
      const bb = `${b.apellidos||""} ${b.nombres||""}`.toUpperCase();
      return aa.localeCompare(bb);
    });

    renderStudentsTable(list);
    setMsg(msgDocente, `✅ Listo. Estudiantes cargados del curso ${curso}.`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgDocente, "❌ No se pudieron cargar estudiantes. Revisa permisos o conexión.", "err");
  }
});

btnGuardarNotas?.addEventListener("click", async () => {
  try{
    setMsg(msgDocente, "", "");

    const curso = safeUpper(dcCurso.value || "");
    const periodo = String(dcPeriodo.value || "").trim();
    const materia = String(dcMateriaSelect.value || "").trim();

    if(!curso || !periodo || !materia){
      setMsg(msgDocente, "Selecciona curso, período y materia.", "warn");
      return;
    }

    if(currentStudents.length === 0){
      setMsg(msgDocente, "Primero carga estudiantes del curso.", "warn");
      return;
    }

    // Validar notas y armar payload por estudiante
    const estudiantesPayload = [];

    for(const s of currentStudents){
      const documento = s.documento || s.id || "";
      const acts = [];

      for(let i=0;i<actividades.length;i++){
        const notaEl = document.querySelector(`input[data-doc="${documento}"][data-act="${i}"]`);
        const obsEl  = document.querySelector(`textarea[data-doc="${documento}"][data-obs="${i}"]`);

        const notaRaw = String(notaEl?.value || "").trim();
        const obsRaw = String(obsEl?.value || "").trim();

        let nota = null;
        if(notaRaw !== ""){
          const x = Number(notaRaw);
          if(Number.isNaN(x) || x < 0 || x > 5){
            setMsg(msgDocente, `Nota inválida (0-5) en ${documento} - ${actividades[i].nombre}`, "warn");
            return;
          }
          nota = x;
        }

        acts.push({
          nombre: actividades[i].nombre,
          nota,
          observacion: obsRaw
        });
      }

      const vals = acts.map(a => a.nota).filter(n => typeof n === "number");
      const definitiva = (vals.length === 0) ? null : Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100;

      estudiantesPayload.push({ documento, actividades: acts, definitiva });
    }

    const anio = String(anioEl?.textContent || "2025").trim();
    const docId = `${anio}_${curso}_P${periodo}_${materiaKey(materia)}`;

    // Cabecera
    await setDoc(doc(db, "notas", docId), {
      anioLectivo: Number(anio) || anio,
      curso,
      periodo: Number(periodo),
      materia,
      actividadesDef: actividades.map(a => a.nombre),
      updatedAt: serverTimestamp(),
      updatedByUid: auth.currentUser?.uid || ""
    }, { merge: true });

    // Subcolección estudiantes (batch)
    const batch = writeBatch(db);
    estudiantesPayload.forEach(p => {
      batch.set(doc(db, "notas", docId, "estudiantes", p.documento), {
        documento: p.documento,
        actividades: p.actividades,
        definitiva: p.definitiva,
        updatedAt: serverTimestamp(),
        updatedByUid: auth.currentUser?.uid || ""
      }, { merge: true });
    });

    await batch.commit();
    setMsg(msgDocente, `✅ Guardado: ${curso} • Período ${periodo} • ${materia}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgDocente, "❌ No se pudieron guardar. Revisa permisos o conexión.", "err");
  }
});

/* =========================
   Auth guard + carga inicial
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  await loadConfigGeneral();

  try {
    const profile = await loadUserProfile(user.uid);

    if (!profile) {
      alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (profile.activo !== true) {
      alert("Usuario inactivo. Contacta a soporte.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (userNameEl) userNameEl.textContent = profile.nombre || "(Sin nombre)";
    if (userRoleEl) userRoleEl.textContent = profile.rol || "(Sin rol)";

    renderModulesByRole(profile.rol);
    showView(viewMenu);

  } catch (error) {
    console.error(error);
    alert("Error cargando el panel. Revisa tu conexión o contacta a soporte.");
  }
});

/* =========================
   Logout
   ========================= */
btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

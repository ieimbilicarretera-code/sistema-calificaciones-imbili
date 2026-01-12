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
const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const btnLogout = document.getElementById("btnLogout");

const viewMenu = document.getElementById("viewMenu");
const viewSecretaria = document.getElementById("viewSecretaria");
const modulesGrid = document.getElementById("modulesGrid");

// Botones regresar
document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => showView(viewMenu));
});

/* =========================
   Helpers
   ========================= */
function showView(viewEl){
  [viewMenu, viewSecretaria].forEach(v => v?.classList.remove("active"));
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

async function loadConfigGeneral() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const cfg = snap.data();
      if (instNameEl && cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if (anioEl && cfg?.añoLectivo != null) anioEl.textContent = String(cfg.añoLectivo);
      if (periodosEl && cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
    }
  } catch (e) {
    // si falla, se queda con lo por defecto
  }
}

async function loadUserProfile(uid) {
  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if (!userSnap.exists()) return null;
  return userSnap.data();
}

/* =========================
   Render módulos por rol
   ========================= */
function renderModulesByRole(roleRaw){
  const role = normalizeRole(roleRaw);
  modulesGrid.innerHTML = "";

  const canSeeSecretaria = ["secretaria", "soporte", "rector", "rectora", "coordinador", "coordinador academico", "coordinador académico"]
    .includes(role);

  const modules = [
    // Secretaría
    {
      id: "secretaria",
      title: "Secretaría • Estudiantes",
      desc: "Registrar estudiantes (individual o carga masiva CSV).",
      badge: "Secretaría",
      icon: "SE",
      enabled: canSeeSecretaria,
      onClick: () => showView(viewSecretaria)
    },

    // Docente (por ahora solo placeholder)
    {
      id: "docente",
      title: "Docente • Registro de notas",
      desc: "Siguiente paso: cargar estudiantes por curso y registrar notas por período.",
      badge: "Docente",
      icon: "DO",
      enabled: ["docente", "soporte", "rector", "rectora", "coordinador", "coordinador academico", "coordinador académico"].includes(role),
      onClick: () => alert("Este módulo lo armamos en el siguiente paso (registro de notas).")
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

    btn.addEventListener("click", () => {
      if(!m.enabled){
        alert("No tienes permisos para este módulo.");
        return;
      }
      m.onClick();
    });

    modulesGrid.appendChild(btn);
  });
}

/* =========================
   Secretaría: guardar estudiante
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
    const curso = String(stCurso.value || "").trim();

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
      curso: curso.toUpperCase(),
      jornada: String(stJornada.value || "Mañana"),
      nacimiento: stNacimiento.value ? String(stNacimiento.value) : "",
      edad: stEdad.value ? Number(stEdad.value) : null,
      correo: String(stCorreo.value || "").trim(),
      telefono: String(stTelefono.value || "").trim(),
      direccion: String(stDireccion.value || "").trim(),
      activo: true,
      updatedAt: serverTimestamp()
    };

    // DocID = documento (recomendado)
    await setDoc(doc(db, "estudiantes", documento), payload, { merge: true });

    setMsg(msgSecretaria1, `✅ Estudiante guardado: ${documento} - ${nombres} ${apellidos}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgSecretaria1, "❌ No se pudo guardar. Revisa permisos/reglas o conexión.", "err");
  }
});

/* =========================
   Secretaría: importar CSV
   ========================= */
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
TI,123456789,JUAN,CARLOS,5,5A,Mañana,10,acudiente@gmail.com,3110000000,Barrio X
`;
  downloadText("plantilla_estudiantes.csv", sample);
});

function parseCSV(text){
  // detecta separador: ; o ,
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

    // batch por seguridad (si fueran muchísimos, luego lo partimos)
    const batch = writeBatch(db);

    let okCount = 0;
    let skipCount = 0;

    rows.forEach(r => {
      const documento = String(r.documento || "").trim();
      const nombres = String(r.nombres || "").trim();
      const apellidos = String(r.apellidos || "").trim();
      const gradoRaw = String(r.grado || "").trim();
      const curso = String(r.curso || "").trim();

      if(!documento || !nombres || !apellidos || !gradoRaw || !curso){
        skipCount++;
        return;
      }

      const payload = {
        tipoDoc: String(r.tipodoc || r.tipoDoc || r.tipodocumento || "TI").trim() || "TI",
        documento,
        nombres,
        apellidos,
        grado: isNaN(Number(gradoRaw)) ? gradoRaw : Number(gradoRaw),
        curso: curso.toUpperCase(),
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
      setMsg(msgSecretaria2, "No se encontraron filas válidas. Revisa que tenga documento,nombres,apellidos,grado,curso.", "warn");
      return;
    }

    await batch.commit();

    setMsg(
      msgSecretaria2,
      `✅ Importación lista. Guardados/actualizados: ${okCount}. Omitidos: ${skipCount}.`,
      "ok"
    );
  }catch(e){
    console.error(e);
    setMsg(msgSecretaria2, "❌ Error importando CSV. Revisa consola/permisos/reglas.", "err");
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

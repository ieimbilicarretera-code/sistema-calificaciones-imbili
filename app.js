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
  updateDoc
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
const modulesMsg = document.getElementById("modulesMsg");
const modulesGrid = document.getElementById("modulesGrid");

/* =========================
   Helpers
   ========================= */
function setModulesText(text) {
  if (modulesMsg) modulesMsg.textContent = text;
}

function clearModules(){
  if(modulesGrid) modulesGrid.innerHTML = "";
}

function addModule({title, desc, tag, onClick, ghost=false}){
  if(!modulesGrid) return;
  const card = document.createElement("div");
  card.className = "module";
  card.innerHTML = `
    <span class="tag">${tag || "Módulo"}</span>
    <h3>${title}</h3>
    <p class="desc">${desc}</p>
    <button class="btn ${ghost ? "btn-ghost" : ""}">${ghost ? "Ver" : "Abrir"}</button>
  `;
  card.querySelector("button").addEventListener("click", onClick);
  modulesGrid.appendChild(card);
}

async function loadConfigGeneral() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const cfg = snap.data();
      if (instNameEl && cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if (anioEl && cfg?.["añoLectivoActual"] != null) anioEl.textContent = String(cfg["añoLectivoActual"]);
      if (periodosEl && cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
    }
  } catch (e) {}
}

async function loadUserProfile(uid) {
  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if (!userSnap.exists()) return null;
  return userSnap.data();
}

function normalizeRole(r){
  return String(r || "").trim().toLowerCase();
}

function renderModules(role){
  clearModules();

  if(role === "docente"){
    setModulesText("Acceso Docente: Registro de notas, listados por curso, descarga de consolidado.");
    addModule({
      tag: "Docente",
      title: "Registro de notas",
      desc: "Selecciona curso, período y materia. Carga estudiantes, registra notas y guarda en Firestore.",
      onClick: () => window.location.href = "docente.html"
    });

    addModule({
      tag: "Docente",
      title: "Listados por curso",
      desc: "Descarga listado de estudiantes (plantilla) por curso para planilla manual.",
      onClick: () => window.location.href = "docente.html#listados",
      ghost: true
    });

    addModule({
      tag: "Docente",
      title: "Consolidado",
      desc: "Descarga consolidado en CSV del curso/periodo/materia seleccionados.",
      onClick: () => window.location.href = "docente.html#consolidado",
      ghost: true
    });
    return;
  }

  if(role === "secretaria"){
    setModulesText("Acceso Secretaría: Gestión de estudiantes, carga masiva, planillas, sabanas, boletines.");
    addModule({
      tag: "Administrativo",
      title: "Gestión de estudiantes",
      desc: "Registrar estudiantes (individual y masivo), matrículas por curso y listados.",
      onClick: () => alert("Módulo Secretaría: lo activamos en el siguiente paso."),
      ghost: true
    });
    return;
  }

  if(role === "rector" || role === "rectora" || role === "coordinador" || role === "coordinador académico"){
    setModulesText("Acceso Rectoría/Coordinación: Reportes generales, revisión y autorizaciones.");
    addModule({
      tag: "Directivo",
      title: "Reportes generales",
      desc: "Consolidados por curso, periodos, desempeño y exportación.",
      onClick: () => alert("Módulo directivo: lo activamos después de Docente/Secretaría."),
      ghost: true
    });
    return;
  }

  if(role === "soporte"){
    setModulesText("Acceso Soporte: Gestión de usuarios, permisos, autorizaciones y soporte del sistema.");
    addModule({
      tag: "Soporte",
      title: "Usuarios y permisos",
      desc: "Crear/editar usuarios y activar/inactivar. Asignar roles y permisos.",
      onClick: () => alert("Módulo Soporte: lo activamos luego (requiere reglas y diseño)."),
      ghost: true
    });
    return;
  }

  setModulesText("Rol no reconocido. Contacta a soporte para asignación de permisos.");
}

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

    // Si acaba de cambiar contraseña, marcamos mustChangePassword=false
    if (localStorage.getItem("justChangedPassword") === "1") {
      try {
        await updateDoc(doc(db, "usuarios", user.uid), { mustChangePassword: false });
      } catch (e) {}
      localStorage.removeItem("justChangedPassword");
    }

    const rol = normalizeRole(profile.rol);
    renderModules(rol);

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

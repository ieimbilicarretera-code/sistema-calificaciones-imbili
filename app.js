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
   UI
   ========================= */
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioLectivoEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const modulesGrid = document.getElementById("modulesGrid");
const btnLogout = document.getElementById("btnLogout");

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

function normalizeRole(r){
  const role = (r || "").toString().trim().toLowerCase();
  if(role === "docente") return "docente";
  if(role === "secretaria" || role === "secretaría") return "secretaria";
  if(role === "rectoria" || role === "rectoría" || role === "rector" || role === "rectora") return "rectoria";
  if(role === "soporte" || role === "sistemas" || role === "admin") return "soporte";
  if(role === "coordinador" || role === "coordinador académico") return "coordinador";
  return role || "sin-rol";
}

function moduleButton(tag, name, desc, onClick){
  const btn = document.createElement("button");
  btn.className = "moduleBtn";
  btn.type = "button";
  btn.innerHTML = `
    <span class="moduleTag">${tag}</span>
    <div class="moduleName">${name}</div>
    <p class="moduleDesc">${desc}</p>
  `;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderModulesByRole(role){
  modulesGrid.innerHTML = "";

  if(role === "docente"){
    modulesGrid.appendChild(moduleButton(
      "Docente",
      "Registro de notas",
      "Selecciona curso, período y materia. Registra notas y guarda en Firestore.",
      () => alert("Siguiente paso: creamos la pantalla registro-notas.html")
    ));
    modulesGrid.appendChild(moduleButton(
      "Docente",
      "Listados por curso",
      "Descarga listado de estudiantes (plantilla) por curso para planilla manual.",
      () => alert("Siguiente paso: generamos listado por curso (CSV/Excel/PDF)")
    ));
    modulesGrid.appendChild(moduleButton(
      "Docente",
      "Consolidado",
      "Descarga consolidado (CSV) del curso/período/materia seleccionados.",
      () => alert("Siguiente paso: consolidado por curso/periodo/materia")
    ));
    return;
  }

  if(role === "secretaria"){
    modulesGrid.appendChild(moduleButton(
      "Secretaría",
      "Estudiantes",
      "Registrar estudiantes individual o masivo (Excel/CSV).",
      () => alert("Siguiente paso: módulo de estudiantes (carga masiva)")
    ));
    modulesGrid.appendChild(moduleButton(
      "Secretaría",
      "Cursos y grados",
      "Crear/editar cursos, asignar director(a) de grupo y jornada.",
      () => alert("Siguiente paso: módulo cursos/grados")
    ));
    modulesGrid.appendChild(moduleButton(
      "Secretaría",
      "Planillas y sábanas",
      "Generar planillas y revisar sábanas para boletines.",
      () => alert("Siguiente paso: planillas/sábanas")
    ));
    return;
  }

  if(role === "rectoria"){
    modulesGrid.appendChild(moduleButton(
      "Rectoría",
      "Reportes",
      "Consultar avance y reportes generales por curso/periodo.",
      () => alert("Siguiente paso: reportes rectoría")
    ));
    modulesGrid.appendChild(moduleButton(
      "Rectoría",
      "Autorizaciones",
      "Autorizar solicitudes de modificación de notas (previa petición).",
      () => alert("Siguiente paso: autorizaciones")
    ));
    return;
  }

  if(role === "soporte"){
    modulesGrid.appendChild(moduleButton(
      "Soporte",
      "Usuarios",
      "Crear/modificar usuarios y asignar roles/permisos.",
      () => alert("Siguiente paso: módulo de usuarios (admin)")
    ));
    modulesGrid.appendChild(moduleButton(
      "Soporte",
      "Solicitudes",
      "Aprobar solicitudes de modificación (con autorización rectoría).",
      () => alert("Siguiente paso: solicitudes")
    ));
    modulesGrid.appendChild(moduleButton(
      "Soporte",
      "Configuración",
      "Año lectivo, períodos, parámetros del sistema.",
      () => alert("Siguiente paso: configuración")
    ));
    return;
  }

  modulesGrid.appendChild(moduleButton(
    "Sistema",
    "Sin módulos",
    "Tu rol no tiene módulos asignados. Contacta a soporte.",
    () => {}
  ));
}

/* =========================
   Load config + profile
   ========================= */
async function loadConfig(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const c = snap.data();
      if(c?.institucion) instNameEl.textContent = String(c.institucion).toUpperCase();
      if(c?.añoLectivoActual) anioLectivoEl.textContent = c.añoLectivoActual;
      if(c?.periodos) periodosEl.textContent = c.periodos;
    }
  }catch(e){
    // silencioso
  }
}

async function clearMustChangePasswordIfNeeded(uid){
  try{
    const flag = localStorage.getItem("justChangedPassword");
    if(flag === "1"){
      await updateDoc(doc(db, "usuarios", uid), { mustChangePassword: false });
      localStorage.removeItem("justChangedPassword");
    }
  }catch(e){
    // silencioso
  }
}

onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  await loadConfig();

  const uid = user.uid;

  await clearMustChangePasswordIfNeeded(uid);

  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if(!userSnap.exists()){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const profile = userSnap.data();

  if(profile.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const nombre = profile.nombre || profile.Nombre || user.email || "Usuario";
  const role = normalizeRole(profile.rol || profile.Rol || "");

  userNameEl.textContent = nombre;
  userRoleEl.textContent = role;

  renderModulesByRole(role);
});

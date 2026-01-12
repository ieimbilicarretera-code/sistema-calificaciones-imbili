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
   Firebase config
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
const instName = document.getElementById("instName");
const userName = document.getElementById("userName");
const userRole = document.getElementById("userRole");
const anioEl = document.getElementById("anio");
const periodosEl = document.getElementById("periodos");
const modulesGrid = document.getElementById("modulesGrid");
const btnLogout = document.getElementById("btnLogout");

/* =========================
   Helpers
   ========================= */
function normRole(role){
  return (role || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function moduleCard({pill, title, desc, buttonText, onClick}){
  const el = document.createElement("div");
  el.className = "module";
  el.innerHTML = `
    <div class="pill">${pill}</div>
    <div>
      <h3>${title}</h3>
      <p>${desc}</p>
    </div>
    <div class="actions">
      <button class="btn" type="button">${buttonText}</button>
    </div>
  `;
  el.querySelector("button").addEventListener("click", onClick);
  return el;
}

async function loadConfig(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const data = snap.data();
      if(data?.institucion) instName.textContent = data.institucion;
      if(data?.añoLectivoActual) anioEl.textContent = data.añoLectivoActual;
      if(data?.periodos) periodosEl.textContent = data.periodos;
    }
  }catch(e){
    // no bloquea
  }
}

function renderModulesByRole(role){
  modulesGrid.innerHTML = "";

  const r = normRole(role);

  // DOCENTE
  if(r === "docente"){
    modulesGrid.appendChild(moduleCard({
      pill: "Docente",
      title: "Registro de notas",
      desc: "Selecciona curso, período y materia. Registra notas y guarda en Firestore.",
      buttonText: "Abrir",
      onClick: () => window.location.href = "docente.html"


      {
  title:"Secretaría",
  desc:"Gestión de estudiantes: registro individual, carga masiva (CSV) y matrículas por curso.",
  tag:"Secretaría",
  enabled: canSecretaria || canSistemas,
  go: () => window.location.href = "secretaria.html"
}

    }));

    modulesGrid.appendChild(moduleCard({
      pill: "Docente",
      title: "Listados por curso",
      desc: "Descarga listado de estudiantes (plantilla) por curso para planilla manual.",
      buttonText: "Ver",
      onClick: () => alert("Este módulo se construye en el siguiente paso.")
    }));

    modulesGrid.appendChild(moduleCard({
      pill: "Docente",
      title: "Consolidado",
      desc: "Descarga consolidado (CSV/Excel/PDF) del curso/período/materia seleccionados.",
      buttonText: "Ver",
      onClick: () => alert("Este módulo se construye en el siguiente paso.")
    }));

    return;
  }

  // SECRETARÍA / RECTORÍA / COORDINADOR
  if(["secretaria","rectoria","coordinador","coordinador academico"].includes(r)){
    modulesGrid.appendChild(moduleCard({
      pill: "Administrativo",
      title: "Gestión de estudiantes",
      desc: "Registro individual y masivo (Excel/archivo plano). Organización por curso.",
      buttonText: "Abrir",
      onClick: () => alert("Este módulo se construye en el siguiente paso.")
    }));

    modulesGrid.appendChild(moduleCard({
      pill: "Administrativo",
      title: "Planillas / Sábanas",
      desc: "Genera listados de asistencia y sábanas por curso.",
      buttonText: "Abrir",
      onClick: () => alert("Este módulo se construye en el siguiente paso.")
    }));

    modulesGrid.appendChild(moduleCard({
      pill: "Administrativo",
      title: "Boletines",
      desc: "Genera boletines por estudiante y curso (PDF).",
      buttonText: "Abrir",
      onClick: () => alert("Este módulo se construye en el siguiente paso.")
    }));

    return;
  }

  // SOPORTE
  if(["soporte","admin"].includes(r)){
    modulesGrid.appendChild(moduleCard({
      pill: "Sistemas",
      title: "Usuarios y permisos",
      desc: "Crear/editar usuarios, asignar roles y autorizar solicitudes.",
      buttonText: "Abrir",
      onClick: () => alert("Este módulo se construye en el siguiente paso.")
    }));
    return;
  }

  // Sin rol
  modulesGrid.appendChild(moduleCard({
    pill: "Info",
    title: "Sin rol asignado",
    desc: "Tu usuario no tiene rol válido. Contacta a soporte para asignar permisos.",
    buttonText: "Entendido",
    onClick: () => {}
  }));
}

/* =========================
   Logout
   ========================= */
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

/* =========================
   Init
   ========================= */
loadConfig();

onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  // Cargar perfil
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if(!snap.exists()){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const profile = snap.data();
  userName.textContent = profile.nombre || user.email || "Usuario";
  userRole.textContent = (profile.rol || "sin rol").toString().toLowerCase();

  // Si venimos de cambiar contraseña, bajamos el flag mustChangePassword
  if(localStorage.getItem("justChangedPassword") === "1"){
    try{
      await updateDoc(doc(db, "usuarios", user.uid), { mustChangePassword: false });
    }catch(e){
      // si falla, lo revisamos luego
    }
    localStorage.removeItem("justChangedPassword");
  }

  renderModulesByRole(profile.rol);
});

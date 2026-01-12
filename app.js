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
   Firebase config (PROYECTO: calificaciones-imbili)
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
const anioLectivo = document.getElementById("anioLectivo");
const periodos = document.getElementById("periodos");
const btnLogout = document.getElementById("btnLogout");

const modulesGrid = document.getElementById("modulesGrid");

const viewMenu = document.getElementById("viewMenu");
const viewCalificaciones = document.getElementById("viewCalificaciones");
const viewPlanillas = document.getElementById("viewPlanillas");
const viewBoletines = document.getElementById("viewBoletines");
const viewSistemas = document.getElementById("viewSistemas");

const views = [viewMenu, viewCalificaciones, viewPlanillas, viewBoletines, viewSistemas];

/* =========================
   Helpers
   ========================= */
function showView(viewEl){
  for(const v of views){
    if(!v) continue;
    v.classList.remove("active");
  }
  if(viewEl) viewEl.classList.add("active");
}

function normRole(r){
  return (r || "").toString().trim().toLowerCase();
}

/* =========================
   Cargar config general
   ========================= */
async function loadGeneralConfig(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const data = snap.data();
      if(data?.institucion) instName.textContent = data.institucion;
      if(typeof data?.añoLectivoActual !== "undefined") anioLectivo.textContent = data.añoLectivoActual;
      if(typeof data?.periodos !== "undefined") periodos.textContent = data.periodos;
    }
  }catch(e){
    // si falla no bloquea
  }
}

/* =========================
   Render de módulos (estilo PDF)
function renderModulesByRole(role){
  const roleL = normRole(role);

  const canCalificaciones = ["docente","secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canPlanillas     = ["docente","secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canBoletines     = ["secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canSistemas      = ["soporte","admin"].includes(roleL);

  const modules = [
    { key:"calificaciones", title:"Calificaciones", desc:"Ingresar, modificar y consultar calificaciones.", badge:"Módulo", icon:"C", enabled:canCalificaciones, go:()=>showView(viewCalificaciones) },
    { key:"planillas",     title:"Planillas",      desc:"Sábanas y listados de estudiantes por curso.",     badge:"Módulo", icon:"P", enabled:canPlanillas,     go:()=>showView(viewPlanillas) },
    { key:"boletines",     title:"Boletines",      desc:"Generación de boletines (roles autorizados).",      badge:"Académico", icon:"B", enabled:canBoletines,  go:()=>showView(viewBoletines) },
    { key:"sistemas",      title:"Sistemas",       desc:"Usuarios, permisos y autorizaciones (admin).",      badge:"Admin", icon:"S", enabled:canSistemas,       go:()=>showView(viewSistemas) },
  ];

  modulesGrid.innerHTML = "";

  for(const m of modules){
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
        <span class="badge">${m.enabled ? m.badge : "Sin permiso"}</span>
        <span class="arrow">➜</span>
      </div>
    `;

    btn.addEventListener("click", () => {
      if(!m.enabled) return;
      m.go();
    });

    modulesGrid.appendChild(btn);
  }
}


  // permisos simples por rol (ajustamos después si quieres permisos por “permisos[]”)
  const canCalificaciones = ["docente","secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canPlanillas     = ["docente","secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canBoletines     = ["secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canSistemas      = ["soporte","admin"].includes(roleL);

  const modules = [
    {
      key:"calificaciones",
      title:"Calificaciones",
      desc:"Ingresar, modificar y consultar calificaciones.",
      tag:"Módulo",
      enabled: canCalificaciones,
      go: () => showView(viewCalificaciones)
    },
    {
      key:"planillas",
      title:"Planillas",
      desc:"Sábanas y listados de estudiantes por curso.",
      tag:"Módulo",
      enabled: canPlanillas,
      go: () => showView(viewPlanillas)
    },
    {
      key:"boletines",
      title:"Boletines",
      desc:"Generación de boletines (roles autorizados).",
      tag:"Módulo",
      enabled: canBoletines,
      go: () => showView(viewBoletines)
    },
    {
      key:"sistemas",
      title:"Sistemas",
      desc:"Usuarios, permisos y autorizaciones (admin/soporte).",
      tag:"Admin",
      enabled: canSistemas,
      go: () => showView(viewSistemas)
    }
  ];

  modulesGrid.innerHTML = "";

  for(const m of modules){
    const div = document.createElement("div");
    div.className = "module-tile";
    div.innerHTML = `
      <span class="tag">${m.tag}</span>
      <h3>${m.title}</h3>
      <p>${m.desc}</p>
      <div class="actions">
        <button class="btn" ${m.enabled ? "" : "disabled"}>Abrir</button>
        ${!m.enabled ? `<span style="color:rgba(234,240,255,.55);font-size:12px;">Sin permiso</span>` : ""}
      </div>
    `;

    const btn = div.querySelector("button");
    btn.addEventListener("click", () => {
      if(!m.enabled) return;
      m.go();
    });

    modulesGrid.appendChild(div);
  }
}

/* =========================
   Botones “Regresar”
   ========================= */
document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => showView(viewMenu));
});

/* =========================
   Logout
   ========================= */
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

/* =========================
   Sesión y perfil
   ========================= */
async function loadUserProfile(uid){
  const snap = await getDoc(doc(db, "usuarios", uid));
  if(!snap.exists()) return null;
  return snap.data();
}

onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  await loadGeneralConfig();

  const profile = await loadUserProfile(user.uid);
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

  // Si el usuario venía de “cambio obligatorio” (login.js pone la marca)
  const justChanged = localStorage.getItem("justChangedPassword") === "1";
  if(justChanged){
    try{
      await updateDoc(doc(db, "usuarios", user.uid), { mustChangePassword: false });
    }catch(e){
      // si falla no detenemos (luego lo arreglamos con reglas/permiso)
    }
    localStorage.removeItem("justChangedPassword");
  }

  userName.textContent = profile.nombre || user.email || "Usuario";
  userRole.textContent = (profile.rol || "sin rol").toString().toLowerCase();

  renderModulesByRole(profile.rol);

  // Entramos al menú principal
  showView(viewMenu);
});

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
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit
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
document.getElementById("yearApp").textContent = new Date().getFullYear();

const instNameApp = document.getElementById("instNameApp");
const userNameEl  = document.getElementById("userName");
const userRoleEl  = document.getElementById("userRole");
const anioEl      = document.getElementById("anioLectivo");
const periodosEl  = document.getElementById("periodos");

const btnLogout   = document.getElementById("btnLogout");
const modulesGrid = document.getElementById("modulesGrid");

const viewCalificaciones = document.getElementById("viewCalificaciones");
const viewPlanillas      = document.getElementById("viewPlanillas");
const viewBoletines      = document.getElementById("viewBoletines");
const viewSistemas       = document.getElementById("viewSistemas");

const btnBack1 = document.getElementById("btnBack1");
const btnBack2 = document.getElementById("btnBack2");
const btnBack3 = document.getElementById("btnBack3");
const btnBack4 = document.getElementById("btnBack4");

/* =========================
   Helpers
   ========================= */
function normRole(role){
  return (role || "").toString().trim().toLowerCase();
}

function hideAllViews(){
  viewCalificaciones.classList.add("hidden");
  viewPlanillas.classList.add("hidden");
  viewBoletines.classList.add("hidden");
  viewSistemas.classList.add("hidden");
}
function showView(view){
  hideAllViews();
  view.classList.remove("hidden");
  // scroll suave hacia abajo
  view.scrollIntoView({ behavior:"smooth", block:"start" });
}

btnBack1.addEventListener("click", hideAllViews);
btnBack2.addEventListener("click", hideAllViews);
btnBack3.addEventListener("click", hideAllViews);
btnBack4.addEventListener("click", hideAllViews);

async function getProfileByUidOrEmail(uid, email){
  // 1) por uid
  const snapUid = await getDoc(doc(db, "usuarios", uid));
  if(snapUid.exists()){
    return { id: uid, data: snapUid.data() };
  }

  // 2) por correo
  const q = query(
    collection(db, "usuarios"),
    where("correo", "==", email),
    limit(1)
  );
  const qs = await getDocs(q);
  if(!qs.empty){
    const d = qs.docs[0];
    return { id: d.id, data: d.data() };
  }

  return null;
}

async function loadConfigGeneral(){
  const snap = await getDoc(doc(db, "config", "general"));
  if(snap.exists()){
    const c = snap.data();
    if(c?.institucion) instNameApp.textContent = String(c.institucion).toUpperCase();
    if(c?.añoLectivoActual) anioEl.textContent = c.añoLectivoActual;
    else if(c?.anioLectivoActual) anioEl.textContent = c.anioLectivoActual;
    if(c?.periodos) periodosEl.textContent = c.periodos;
  }
}

/* =========================
   Render módulos tipo botón
   ========================= */
function renderModulesByRole(role){
  const roleL = normRole(role);

  const canCalificaciones = ["docente","secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canPlanillas     = ["docente","secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canBoletines     = ["secretaria","rectoria","coordinador","coordinador académico","coordinador academico","soporte","admin"].includes(roleL);
  const canSistemas      = ["soporte","admin"].includes(roleL);

  const modules = [
    { title:"Calificaciones", desc:"Ingresar, modificar y consultar calificaciones.", badge:"Módulo", icon:"C", enabled:canCalificaciones, go:()=>showView(viewCalificaciones) },
    { title:"Planillas",      desc:"Sábanas y listados de estudiantes por curso.",     badge:"Módulo", icon:"P", enabled:canPlanillas,     go:()=>showView(viewPlanillas) },
    { title:"Boletines",      desc:"Generación de boletines en PDF (roles autorizados).", badge:"Académico", icon:"B", enabled:canBoletines, go:()=>showView(viewBoletines) },
    { title:"Sistemas",       desc:"Usuarios, permisos y autorizaciones (admin).",     badge:"Admin", icon:"S", enabled:canSistemas,       go:()=>showView(viewSistemas) },
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

/* =========================
   Auth guard
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  try{
    await loadConfigGeneral();

    const email = user.email || "";
    const profileIdFromSession = sessionStorage.getItem("profileDocId");

    let profilePack = null;

    // Si ya guardamos el docId, intentamos con ese primero
    if(profileIdFromSession){
      const snap = await getDoc(doc(db, "usuarios", profileIdFromSession));
      if(snap.exists()){
        profilePack = { id: profileIdFromSession, data: snap.data() };
      }
    }

    // si no, buscamos por uid/correo
    if(!profilePack){
      profilePack = await getProfileByUidOrEmail(user.uid, email);
      if(profilePack) sessionStorage.setItem("profileDocId", profilePack.id);
    }

    if(!profilePack){
      alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const profile = profilePack.data;

    if(profile.activo !== true){
      alert("Usuario inactivo. Contacta a soporte.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    userNameEl.textContent = profile.nombre || profile.Nombre || "Usuario";
    userRoleEl.textContent = profile.rol || profile.Rol || "Sin rol";

    // Si venía de cambio obligatorio
    if(localStorage.getItem("justChangedPassword") === "1"){
      localStorage.removeItem("justChangedPassword");
      try{
        await updateDoc(doc(db, "usuarios", profilePack.id), { mustChangePassword:false });
      }catch(e){ /* si falla, no bloquea */ }
    }

    renderModulesByRole(profile.rol || profile.Rol);

  }catch(err){
    console.error(err);
    alert("Error cargando el panel. Revisa tu conexión o contacta a soporte.");
  }
});

/* =========================
   Logout
   ========================= */
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

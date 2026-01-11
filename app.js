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
   Pega aquí TU firebaseConfig (calificaciones-imbili)
   ========================= */
const firebaseConfig = {
  apiKey: "REEMPLAZA",
  authDomain: "REEMPLAZA",
  projectId: "REEMPLAZA"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* UI */
const instName2 = document.getElementById("instName2");
const userName = document.getElementById("userName");
const userRole = document.getElementById("userRole");
const yearNow = document.getElementById("yearNow");
const periodsNow = document.getElementById("periodsNow");

const modDocentes = document.getElementById("modDocentes");
const modDirector = document.getElementById("modDirector");
const modAdministrativos = document.getElementById("modAdministrativos");
const modSistemas = document.getElementById("modSistemas");
const btnLogout = document.getElementById("btnLogout");

function show(el){ el.classList.remove("hidden2"); }
function hide(el){ el.classList.add("hidden2"); }

async function loadConfig(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const d = snap.data();
      if(d.institucion) instName2.textContent = d.institucion;
      if(d.añoLectivoActual) yearNow.textContent = d.añoLectivoActual;
      if(d.periodos) periodsNow.textContent = d.periodos;
    }
  }catch(e){}
}
loadConfig();

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

function setModulesByRole(role){
  // ocultar todo primero
  hide(modDocentes);
  hide(modDirector);
  hide(modAdministrativos);
  hide(modSistemas);

  // roles esperados en minúscula:
  // docente, director, secretaria, rector, coordinador, soporte
  if(role === "docente") show(modDocentes);
  if(role === "director") show(modDirector);

  if(role === "secretaria" || role === "rector" || role === "coordinador"){
    show(modAdministrativos);
  }

  if(role === "soporte"){
    show(modSistemas);
    show(modAdministrativos); // opcional: soporte puede ver administrativos si quieres
  }
}

onAuthStateChanged(auth, async (user) => {
  if(!user){
    window.location.href = "index.html";
    return;
  }

  // cargar perfil
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if(!snap.exists()){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const profile = snap.data();

  if(profile.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  // si acaba de cambiar contraseña desde login.js, bajamos mustChangePassword=false
  const justChanged = localStorage.getItem("justChangedPassword") === "1";
  if(justChanged){
    try{
      await updateDoc(doc(db, "usuarios", user.uid), { mustChangePassword: false });
    }catch(e){}
    localStorage.removeItem("justChangedPassword");
  }

  userName.textContent = profile.nombre || user.email;
  const role = (profile.rol || "").toString().trim().toLowerCase();
  userRole.textContent = role || "sin rol";

  setModulesByRole(role);
});

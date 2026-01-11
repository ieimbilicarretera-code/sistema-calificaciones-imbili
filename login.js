import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* =========================
   1) Pega aquí TU config
   ========================= */
const firebaseConfig = {
  // 👇 Reemplaza TODO con el config de tu proyecto "calificaciones-imbili"
  apiKey: "REEMPLAZA",
  authDomain: "REEMPLAZA",
  projectId: "REEMPLAZA"
  // (si tu config trae otros campos, puedes agregarlos, pero estos 3 son mínimos)
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================
   UI refs
   ========================= */
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const loginView = document.getElementById("loginView");
const forgotView = document.getElementById("forgotView");
const forceChangeView = document.getElementById("forceChangeView");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");

const linkForgot = document.getElementById("linkForgot");
const forgotEmail = document.getElementById("forgotEmail");
const btnSendReset = document.getElementById("btnSendReset");
const btnBackLogin = document.getElementById("btnBackLogin");
const forgotMsg = document.getElementById("forgotMsg");

const newPass1 = document.getElementById("newPass1");
const newPass2 = document.getElementById("newPass2");
const btnUpdatePass = document.getElementById("btnUpdatePass");
const changeMsg = document.getElementById("changeMsg");

const instName = document.getElementById("instName");

/* =========================
   Helpers
   ========================= */
function show(view){
  loginView.classList.add("hidden");
  forgotView.classList.add("hidden");
  forceChangeView.classList.add("hidden");
  view.classList.remove("hidden");
}

function setMsg(el, text, ok=false){
  el.textContent = text || "";
  el.className = "info " + (ok ? "ok" : "err");
}

async function loadInstitutionName(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists()){
      const data = snap.data();
      if(data?.institucion) instName.textContent = data.institucion;
    }
  }catch(e){
    // si falla, no pasa nada; queda el texto por defecto
  }
}
loadInstitutionName();

/* =========================
   2) Login
   ========================= */
btnLogin.addEventListener("click", async () => {
  const email = (emailEl.value || "").trim();
  const pass = passEl.value || "";

  if(!email || !pass){
    alert("Por favor ingresa correo y contraseña.");
    return;
  }

  try{
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // Revisar perfil del usuario en Firestore
    const uid = cred.user.uid;
    const userSnap = await getDoc(doc(db, "usuarios", uid));

    if(!userSnap.exists()){
      alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
      return;
    }

    const profile = userSnap.data();

    if(profile.activo !== true){
      alert("Usuario inactivo. Contacta a soporte.");
      return;
    }

    // Si debe cambiar contraseña
    if(profile.mustChangePassword === true){
      show(forceChangeView);
      setMsg(changeMsg, "");
      return;
    }

    // Si todo OK -> app.html
    window.location.href = "app.html";

  }catch(err){
    console.error(err);
    alert("Error al ingresar. Verifica tu correo y contraseña.");
  }
});

/* =========================
   3) Olvidé contraseña
   ========================= */
linkForgot.addEventListener("click", (e) => {
  e.preventDefault();
  show(forgotView);
  setMsg(forgotMsg, "");
  forgotEmail.value = (emailEl.value || "").trim();
});

btnBackLogin.addEventListener("click", () => {
  show(loginView);
});

btnSendReset.addEventListener("click", async () => {
  const email = (forgotEmail.value || "").trim();
  if(!email){
    setMsg(forgotMsg, "Por favor escribe tu correo.", false);
    return;
  }

  try{
    await sendPasswordResetEmail(auth, email);
    setMsg(forgotMsg, "Listo. Se envió un enlace de recuperación a tu correo.", true);
  }catch(err){
    console.error(err);
    setMsg(forgotMsg, "No se pudo enviar el correo. Verifica el correo o contacta a soporte.", false);
  }
});

/* =========================
   4) Cambio obligatorio de contraseña
   ========================= */
btnUpdatePass.addEventListener("click", async () => {
  const p1 = newPass1.value || "";
  const p2 = newPass2.value || "";

  if(p1.length < 6){
    setMsg(changeMsg, "La contraseña debe tener mínimo 6 caracteres.", false);
    return;
  }
  if(p1 !== p2){
    setMsg(changeMsg, "Las contraseñas no coinciden.", false);
    return;
  }

  try{
    if(!auth.currentUser){
      setMsg(changeMsg, "Sesión no válida. Vuelve a iniciar sesión.", false);
      show(loginView);
      return;
    }

    await updatePassword(auth.currentUser, p1);

    // Marcar mustChangePassword=false en Firestore
    // Nota: lo haremos desde app.html para mantener simple este archivo
    setMsg(changeMsg, "Proceso exitoso. Continuando...", true);

    // Guardamos una marca local para que app.html actualice el perfil
    localStorage.setItem("justChangedPassword", "1");

    setTimeout(() => {
      window.location.href = "app.html";
    }, 800);

  }catch(err){
    console.error(err);
    setMsg(changeMsg, "No se pudo cambiar. Vuelve a iniciar sesión y reintenta.", false);
  }
});

/* =========================
   5) Si ya está logueado, re-dirigir
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if(user){
    // Si ya está logueado, lo mandamos a app
    // (pero app validará perfil y roles)
    // Solo evitamos saltar si está forzado a cambiar
    // eso se controla en el flujo de login
  }
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
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

const instName = document.getElementById("instName");

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
const btnBackLogin2 = document.getElementById("btnBackLogin2");
const changeMsg = document.getElementById("changeMsg");

function show(which){
  loginView.style.display = "none";
  forgotView.style.display = "none";
  forceChangeView.style.display = "none";
  which.style.display = "block";
}

function setMsg(el, text, type=""){
  el.className = "msg " + (type || "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

/* =========================
   Load config/general
   ========================= */
async function loadInstitution(){
  try{
    const snap = await getDoc(doc(db, "config", "general"));
    if(snap.exists() && snap.data()?.institucion){
      instName.textContent = snap.data().institucion;
    }
  }catch(e){}
}
loadInstitution();

/* =========================
   Login
   ========================= */
btnLogin.addEventListener("click", async () => {
  const email = (emailEl.value || "").trim();
  const pass = passEl.value || "";
  if(!email || !pass) return alert("Por favor ingresa correo y contraseña.");

  try{
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // Perfil en Firestore debe existir con ID = uid
    const uid = cred.user.uid;
    const userSnap = await getDoc(doc(db, "usuarios", uid));

    if(!userSnap.exists()){
      alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
      await signOut(auth);
      return;
    }

    const profile = userSnap.data();
    if(profile.activo !== true){
      alert("Usuario inactivo. Contacta a soporte.");
      await signOut(auth);
      return;
    }

    if(profile.mustChangePassword === true){
      show(forceChangeView);
      setMsg(changeMsg, "");
      return;
    }

    window.location.href = "app.html";
  }catch(err){
    console.error(err);
    alert("Error al ingresar. Verifica correo/contraseña.");
  }
});

/* =========================
   Forgot
   ========================= */
linkForgot.addEventListener("click", (e) => {
  e.preventDefault();
  show(forgotView);
  forgotEmail.value = (emailEl.value || "").trim();
  setMsg(forgotMsg, "");
});

btnBackLogin.addEventListener("click", () => show(loginView));

btnSendReset.addEventListener("click", async () => {
  const email = (forgotEmail.value || "").trim();
  if(!email) return setMsg(forgotMsg, "Escribe tu correo.", "warn");

  try{
    await sendPasswordResetEmail(auth, email);
    setMsg(forgotMsg, "Listo. Revisa tu correo para restablecer la contraseña.", "ok");
  }catch(err){
    console.error(err);
    setMsg(forgotMsg, "No se pudo enviar. Verifica el correo o contacta a soporte.", "err");
  }
});

/* =========================
   Force change password
   ========================= */
btnBackLogin2.addEventListener("click", () => show(loginView));

btnUpdatePass.addEventListener("click", async () => {
  const p1 = newPass1.value || "";
  const p2 = newPass2.value || "";

  if(p1.length < 6) return setMsg(changeMsg, "Mínimo 6 caracteres.", "warn");
  if(p1 !== p2) return setMsg(changeMsg, "Las contraseñas no coinciden.", "warn");

  try{
    if(!auth.currentUser) return setMsg(changeMsg, "Sesión inválida. Vuelve a ingresar.", "err");

    await updatePassword(auth.currentUser, p1);

    // marcar mustChangePassword=false
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
      mustChangePassword: false
    });

    setMsg(changeMsg, "Proceso exitoso. Entrando al sistema…", "ok");
    setTimeout(() => window.location.href = "app.html", 700);
  }catch(err){
    console.error(err);
    setMsg(changeMsg, "No se pudo cambiar. Vuelve a iniciar sesión e intenta.", "err");
  }
});

/* =========================
   If already logged
   ========================= */
onAuthStateChanged(auth, (user) => {
  if(user){
    // no redirecciono automático para no interrumpir cambios forzados
  }
});

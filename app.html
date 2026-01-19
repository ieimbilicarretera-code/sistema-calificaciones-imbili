import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ===== Firebase config ===== */
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

/* ===== UI ===== */
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
const btnBackLogin2 = document.getElementById("btnBackLogin2");
const changeMsg = document.getElementById("changeMsg");

function show(view){
  loginView.classList.remove("active");
  forgotView.classList.remove("active");
  forceChangeView.classList.remove("active");
  view.classList.add("active");
}
function setMsg(el, text, type=""){
  el.className = "msg " + (type || "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

/* ===== Login ===== */
btnLogin.addEventListener("click", async () => {
  const email = (emailEl.value || "").trim();
  const pass = passEl.value || "";
  if(!email || !pass) return alert("Por favor ingresa correo y contraseña.");

  try{
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // Perfil Firestore
    const uid = cred.user.uid;
    const snap = await getDoc(doc(db, "usuarios", uid));

    if(!snap.exists()){
      alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
      return;
    }
    const profile = snap.data();
    if(profile.activo !== true){
      alert("Usuario inactivo. Contacta a soporte.");
      return;
    }

    if(profile.mustChangePassword === true){
      show(forceChangeView);
      setMsg(changeMsg, "", "");
      return;
    }

    window.location.href = "app.html";
  }catch(e){
    console.error(e);
    alert("Error al ingresar. Verifica tus datos.");
  }
});

/* ===== Olvidé contraseña ===== */
linkForgot.addEventListener("click", (e) => {
  e.preventDefault();
  forgotEmail.value = (emailEl.value || "").trim();
  setMsg(forgotMsg, "", "");
  show(forgotView);
});
btnBackLogin.addEventListener("click", () => show(loginView));

btnSendReset.addEventListener("click", async () => {
  const email = (forgotEmail.value || "").trim();
  if(!email) return setMsg(forgotMsg, "Escribe tu correo.", "warn");
  try{
    await sendPasswordResetEmail(auth, email);
    setMsg(forgotMsg, "Listo. Se envió un enlace de recuperación a tu correo.", "ok");
  }catch(e){
    console.error(e);
    setMsg(forgotMsg, "No se pudo enviar. Verifica el correo o contacta a soporte.", "err");
  }
});

/* ===== Cambio obligatorio ===== */
btnBackLogin2.addEventListener("click", () => show(loginView));

btnUpdatePass.addEventListener("click", async () => {
  const p1 = newPass1.value || "";
  const p2 = newPass2.value || "";

  if(p1.length < 6) return setMsg(changeMsg, "Mínimo 6 caracteres.", "warn");
  if(p1 !== p2) return setMsg(changeMsg, "No coinciden.", "warn");

  try{
    if(!auth.currentUser){
      show(loginView);
      return setMsg(changeMsg, "Sesión inválida. Vuelve a ingresar.", "err");
    }
    await updatePassword(auth.currentUser, p1);

    // marcar mustChangePassword=false
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { mustChangePassword:false });

    setMsg(changeMsg, "Proceso exitoso. Entrando...", "ok");
    setTimeout(()=> window.location.href = "app.html", 600);
  }catch(e){
    console.error(e);
    setMsg(changeMsg, "No se pudo cambiar. Reingresa y vuelve a intentar.", "err");
  }
});

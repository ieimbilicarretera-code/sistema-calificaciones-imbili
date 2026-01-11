/*************************************************
 * FIREBASE CONFIG – CALIFICACIONES IMBILÍ
 * ESTE ARCHIVO CONTIENE TODO FIREBASE
 *************************************************/

// Importar Firebase (SDK v9 modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 🔹 CONFIGURACIÓN DEL SDK (ESTO ES LO QUE TE CONFUNDÍA)
const firebaseConfig = {
  apiKey: "AIzaSyBpcM4OGMnyJZT7r_6XYldAJAyLpajP33I",
  authDomain: "calificaciones-imbili.firebaseapp.com",
  projectId: "calificaciones-imbili",
  storageBucket: "calificaciones-imbili.firebasestorage.app",
  messagingSenderId: "1027786450920",
  appId: "1:1027786450920:web:9517539adbb1ea06e5665d"
};

// 🔹 INICIALIZAR FIREBASE
const app = initializeApp(firebaseConfig);

// 🔹 SERVICIOS
const auth = getAuth(app);
const db = getFirestore(app);

// 🔹 LOGIN BÁSICO (PRIMER MÓDULO)
const form = document.getElementById("loginForm");
const mensaje = document.getElementById("mensaje");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correo = document.getElementById("correo").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, correo, password);
    mensaje.innerText = "Ingreso exitoso";
    mensaje.style.color = "green";

    // Más adelante redirigimos según rol
    // window.location.href = "dashboard.html";

  } catch (error) {
    mensaje.innerText = "Error: " + error.message;
    mensaje.style.color = "red";
  }
});

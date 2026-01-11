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

/* =========================
   Helpers
   ========================= */
function setModulesText(text) {
  if (modulesMsg) modulesMsg.textContent = text;
}

async function loadConfigGeneral() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const cfg = snap.data();
      if (instNameEl && cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if (anioEl && cfg?.añoLectivo != null) anioEl.textContent = String(cfg.añoLectivo);
      if (periodosEl && cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
    }
  } catch (e) {
    // no pasa nada
  }
}

async function loadUserProfile(uid) {
  // OJO: el doc ID debe ser el UID
  const userSnap = await getDoc(doc(db, "usuarios", uid));
  if (!userSnap.exists()) return null;
  return userSnap.data();
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

    const rol = (profile.rol || "").toLowerCase();

    if (rol === "docente") {
      setModulesText("Acceso Docente: Registro de notas, listados por curso, descarga de consolidado.");
    } else if (rol === "secretaria") {
      setModulesText("Acceso Secretaría: Gestión de estudiantes, carga masiva, planillas, sabanas, boletines.");
    } else if (rol === "rector" || rol === "rectora") {
      setModulesText("Acceso Rectoría: Reportes generales, revisión y autorizaciones.");
    } else if (rol === "soporte") {
      setModulesText("Acceso Soporte: Gestión de usuarios, permisos, autorizaciones y soporte del sistema.");
    } else {
      setModulesText("Rol no reconocido. Contacta a soporte para asignación de permisos.");
    }

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

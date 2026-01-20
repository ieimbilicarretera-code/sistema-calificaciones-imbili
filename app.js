import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

document.getElementById("year").textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const btnLogout = document.getElementById("btnLogout");
const modulesGrid = document.getElementById("modulesGrid");
const appMsg = document.getElementById("appMsg");

function normalizeRole(r){ return String(r||"").trim().toLowerCase(); }
function setMsg(text, type=""){
  appMsg.className = "msg " + (type||"");
  appMsg.textContent = text || "";
  appMsg.style.display = text ? "block" : "none";
}

async function loadConfig(){
  try{
    const snap = await getDoc(doc(db,"config","general"));
    if(snap.exists()){
      const cfg = snap.data();
      if(cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if(cfg?.añoLectivo != null) anioEl.textContent = String(cfg.añoLectivo);
      if(cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
      return cfg;
    }
  }catch(e){}
  return null;
}

async function loadProfile(uid){
  const snap = await getDoc(doc(db,"usuarios",uid));
  return snap.exists() ? snap.data() : null;
}

function addModule({icon,title,desc,badge,href,enabled=true}){
  const btn = document.createElement("button");
  btn.className = "module-btn";
  btn.disabled = !enabled;

  btn.innerHTML = `
    <div class="module-left">
      <div class="module-icon">${icon}</div>
      <div class="module-text">
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    </div>
    <div class="module-right">
      <span class="badge">${badge}</span>
      <span class="arrow">→</span>
    </div>
  `;

  btn.addEventListener("click", () => {
    if(!enabled) return alert("No tienes permisos para este módulo.");
    window.location.href = href;
  });

  modulesGrid.appendChild(btn);
}

function renderModules(roleRaw){
  modulesGrid.innerHTML = "";
  const role = normalizeRole(roleRaw);

  const isDocente = ["docente","soporte","rector","rectora","coordinador","coordinador academico","coordinador académico"].includes(role);
  const isSecretaria = ["secretaria","soporte","rector","rectora","coordinador","coordinador academico","coordinador académico"].includes(role);

  addModule({
    icon:"SE",
    title:"Secretaría • Estudiantes",
    desc:"Registrar estudiantes (individual o carga masiva CSV).",
    badge:"Secretaría",
    href:"secretaria.html",
    enabled:isSecretaria
  });

  addModule({
    icon:"DO",
    title:"Docente • Registro de notas",
    desc:"Selecciona curso, período y materia. Actividades (nota + observación) + promedio automático.",
    badge:"Docente",
    href:"docente.html",
    enabled:isDocente
  });

    const isSoporte = (role === "soporte");

  addModule({
    icon:"AD",
    title:"Soporte • Configuración",
    desc:"Crear/editar cursos y materias desde el sistema (sin entrar a Firebase).",
    badge:"Soporte",
    href:"soporte.html",
    enabled:isSoporte
  });

}

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

onAuthStateChanged(auth, async (user) => {
  if(!user) return (window.location.href="index.html");

  await loadConfig();

  const profile = await loadProfile(user.uid);
  if(!profile){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    return (window.location.href="index.html");
  }
  if(profile.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    return (window.location.href="index.html");
  }

  userNameEl.textContent = profile.nombre || "(Sin nombre)";
  userRoleEl.textContent = profile.rol || "(Sin rol)";

  renderModules(profile.rol);
  setMsg("", "");
});

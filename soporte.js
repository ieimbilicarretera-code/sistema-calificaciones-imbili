import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc,
  collection, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* Firebase config */
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
const supNameEl = document.getElementById("supName");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
document.getElementById("btnBack").addEventListener("click", ()=> window.location.href="app.html");

/* Curso form */
const cuNombre = document.getElementById("cuNombre");
const cuGrado = document.getElementById("cuGrado");
const cuJornada = document.getElementById("cuJornada");
const cuActivo = document.getElementById("cuActivo");
const btnSaveCurso = document.getElementById("btnSaveCurso");
const btnClearCurso = document.getElementById("btnClearCurso");
const msgCurso = document.getElementById("msgCurso");

/* Materia form */
const maNombre = document.getElementById("maNombre");
const maGrado = document.getElementById("maGrado");
const maActiva = document.getElementById("maActiva");
const btnSaveMateria = document.getElementById("btnSaveMateria");
const btnClearMateria = document.getElementById("btnClearMateria");
const msgMateria = document.getElementById("msgMateria");

/* Lists */
const btnReload = document.getElementById("btnReload");
const listCursos = document.getElementById("listCursos");
const listMaterias = document.getElementById("listMaterias");
const msgList = document.getElementById("msgList");

function setMsg(el, text, type=""){
  el.className = "msg " + (type||"");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function normalizeRole(r){ return String(r||"").trim().toLowerCase(); }

let CFG = { añoLectivo: 2025, periodos: 4, institucion: "Institución Educativa Imbilí Carretera" };
let PROFILE = null;

async function loadConfig(){
  const snap = await getDoc(doc(db,"config","general"));
  if(snap.exists()) CFG = { ...CFG, ...snap.data() };
  instNameEl.textContent = CFG.institucion || "Institución Educativa Imbilí Carretera";
  anioEl.textContent = String(CFG.añoLectivo ?? "…");
  periodosEl.textContent = String(CFG.periodos ?? "…");
}

async function loadProfile(uid){
  const snap = await getDoc(doc(db,"usuarios",uid));
  return snap.exists() ? snap.data() : null;
}

/* Guardar curso */
btnSaveCurso.addEventListener("click", async ()=>{
  try{
    setMsg(msgCurso,"","");

    const nombre = String(cuNombre.value||"").trim().toUpperCase();
    const grado = Number(cuGrado.value||"");
    const jornada = String(cuJornada.value||"Mañana");
    const activo = (String(cuActivo.value) === "true");

    if(!nombre || isNaN(grado)){
      return setMsg(msgCurso,"Faltan campos obligatorios (nombre, grado).","warn");
    }

    await setDoc(doc(db,"cursos", nombre), {
      nombre,
      grado,
      jornada,
      activo,
      añoLectivo: Number(CFG.añoLectivo || 0),
      updatedAt: serverTimestamp()
    }, { merge:true });

    setMsg(msgCurso, `✅ Curso guardado: ${nombre}`, "ok");
    await refreshLists();
  }catch(e){
    console.error(e);
    setMsg(msgCurso,"❌ No se pudo guardar curso. Revisa permisos/reglas.","err");
  }
});

btnClearCurso.addEventListener("click", ()=>{
  cuNombre.value = "";
  cuGrado.value = "";
  cuJornada.value = "Mañana";
  cuActivo.value = "true";
  setMsg(msgCurso,"","");
});

/* Guardar materia */
btnSaveMateria.addEventListener("click", async ()=>{
  try{
    setMsg(msgMateria,"","");

    const nombre = String(maNombre.value||"").trim();
    const grado = Number(maGrado.value||"");
    const activa = (String(maActiva.value) === "true");

    if(!nombre || isNaN(grado)){
      return setMsg(msgMateria,"Faltan campos obligatorios (nombre, grado).","warn");
    }

    // ID = nombre + grado (para evitar duplicados). Ej: "11_MATEMATICAS"
    const id = `${grado}_${nombre}`.toUpperCase().replace(/\s+/g,"_");

    await setDoc(doc(db,"materias", id), {
      nombre,
      grado,
      activa,
      updatedAt: serverTimestamp()
    }, { merge:true });

    setMsg(msgMateria, `✅ Materia guardada: ${nombre} (grado ${grado})`, "ok");
    await refreshLists();
  }catch(e){
    console.error(e);
    setMsg(msgMateria,"❌ No se pudo guardar materia. Revisa permisos/reglas.","err");
  }
});

btnClearMateria.addEventListener("click", ()=>{
  maNombre.value = "";
  maGrado.value = "";
  maActiva.value = "true";
  setMsg(msgMateria,"","");
});

btnReload.addEventListener("click", refreshLists);

async function refreshLists(){
  try{
    setMsg(msgList,"Cargando…","warn");

    // Cursos
    const snapC = await getDocs(collection(db,"cursos"));
    const cursos = [];
    snapC.forEach(d => cursos.push({ id:d.id, ...d.data() }));
    cursos.sort((a,b)=> String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)));

    listCursos.innerHTML = "";
    if(cursos.length === 0){
      listCursos.innerHTML = `<div class="small">No hay cursos.</div>`;
    }else{
      cursos.forEach(c=>{
        const p = document.createElement("div");
        p.className = "panel";
        p.style.marginBottom = "10px";
        p.innerHTML = `
          <div class="row" style="justify-content:space-between;">
            <div>
              <h2 style="margin:0; font-size:14px;">${c.nombre || c.id} <span class="small">• grado ${c.grado ?? "—"} • ${c.jornada || "—"} • activo: ${c.activo===false?"NO":"SI"}</span></h2>
            </div>
            <div class="btns">
              <button class="btn-ghost" data-edit-curso="${c.id}">Editar</button>
            </div>
          </div>
        `;
        p.querySelector(`[data-edit-curso="${CSS.escape(c.id)}"]`).addEventListener("click", ()=>{
          cuNombre.value = (c.nombre || c.id || "").toUpperCase();
          cuGrado.value = c.grado ?? "";
          cuJornada.value = c.jornada || "Mañana";
          cuActivo.value = (c.activo===false) ? "false" : "true";
          window.scrollTo({ top: 0, behavior: "smooth" });
          setMsg(msgCurso,"Editando curso. Ajusta y guarda.","ok");
        });
        listCursos.appendChild(p);
      });
    }

    // Materias
    const snapM = await getDocs(collection(db,"materias"));
    const mats = [];
    snapM.forEach(d => mats.push({ id:d.id, ...d.data() }));
    mats.sort((a,b)=> (Number(a.grado)-Number(b.grado)) || String(a.nombre||a.id).localeCompare(String(b.nombre||b.id)));

    listMaterias.innerHTML = "";
    if(mats.length === 0){
      listMaterias.innerHTML = `<div class="small">No hay materias.</div>`;
    }else{
      mats.forEach(m=>{
        const p = document.createElement("div");
        p.className = "panel";
        p.style.marginBottom = "10px";
        p.innerHTML = `
          <div class="row" style="justify-content:space-between;">
            <div>
              <h2 style="margin:0; font-size:14px;">${m.nombre || m.id} <span class="small">• grado ${m.grado ?? "—"} • activa: ${m.activa===false?"NO":"SI"}</span></h2>
              <div class="small">ID: ${m.id}</div>
            </div>
            <div class="btns">
              <button class="btn-ghost" data-edit-mat="${m.id}">Editar</button>
            </div>
          </div>
        `;
        p.querySelector(`[data-edit-mat="${CSS.escape(m.id)}"]`).addEventListener("click", ()=>{
          maNombre.value = m.nombre || "";
          maGrado.value = m.grado ?? "";
          maActiva.value = (m.activa===false) ? "false" : "true";
          window.scrollTo({ top: 0, behavior: "smooth" });
          setMsg(msgMateria,"Editando materia. Ajusta y guarda.","ok");
        });
        listMaterias.appendChild(p);
      });
    }

    setMsg(msgList,"","");

  }catch(e){
    console.error(e);
    setMsg(msgList,"❌ Error cargando listados. Revisa permisos/reglas.","err");
  }
}

/* Auth guard */
onAuthStateChanged(auth, async (user)=>{
  if(!user) return (window.location.href="index.html");

  try{
    await loadConfig();

    PROFILE = await loadProfile(user.uid);
    if(!PROFILE){
      alert("Tu usuario no tiene perfil. Contacta a soporte.");
      await signOut(auth);
      return (window.location.href="index.html");
    }
    if(PROFILE.activo !== true){
      alert("Usuario inactivo.");
      await signOut(auth);
      return (window.location.href="index.html");
    }

    const role = normalizeRole(PROFILE.rol);
    if(role !== "soporte"){
      alert("Este módulo es solo para Soporte.");
      window.location.href = "app.html";
      return;
    }

    supNameEl.textContent = PROFILE.nombre || "(Sin nombre)";
    await refreshLists();
  }catch(e){
    console.error(e);
    setMsg(msgList,"Error inicializando. Revisa consola.","err");
  }
});

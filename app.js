import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, addDoc,
  query, where,
  serverTimestamp,
  writeBatch
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

/* ===== UI refs ===== */
const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const btnLogout = document.getElementById("btnLogout");

const viewMenu = document.getElementById("viewMenu");
const viewSecretaria = document.getElementById("viewSecretaria");
const viewDocente = document.getElementById("viewDocente");
const viewSoporte = document.getElementById("viewSoporte");

const modulesGrid = document.getElementById("modulesGrid");

document.querySelectorAll("[data-back]").forEach(b=> b.addEventListener("click", ()=> showView(viewMenu)));

/* ===== helpers ===== */
function showView(v){
  [viewMenu, viewSecretaria, viewDocente, viewSoporte].forEach(x=> x?.classList.remove("active"));
  v?.classList.add("active");
}
function normalizeRole(r){ return String(r||"").trim().toLowerCase(); }
function setMsg(el, text, type=""){
  if(!el) return;
  el.className = "msg " + (type||"");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}
function clampNote(x){
  const n = Number(x);
  if(Number.isNaN(n)) return null;
  return Math.max(0, Math.min(5, n));
}

let CFG = { añoLectivo:null, periodos:4, institucion:null };
let PROFILE = null;

/* ===== load config & user profile ===== */
async function loadConfigGeneral(){
  try{
    const snap = await getDoc(doc(db,"config","general"));
    if(snap.exists()){
      CFG = { ...CFG, ...snap.data() };
      if(CFG?.institucion) instNameEl.textContent = CFG.institucion;
      if(CFG?.añoLectivo != null) anioEl.textContent = String(CFG.añoLectivo);
      if(CFG?.periodos != null) periodosEl.textContent = String(CFG.periodos);
    }
  }catch(e){}
}

async function loadUserProfile(uid){
  const snap = await getDoc(doc(db,"usuarios", uid));
  return snap.exists() ? snap.data() : null;
}

/* ===== render modules ===== */
function renderModulesByRole(roleRaw){
  const role = normalizeRole(roleRaw);
  modulesGrid.innerHTML = "";

  const canSecretaria = ["secretaria","soporte","rector","rectora","coordinador","coordinador academico","coordinador académico"].includes(role);
  const canDocente = ["docente","soporte","rector","rectora","coordinador","coordinador academico","coordinador académico"].includes(role);
  const canSoporte = ["soporte"].includes(role);

  const modules = [
    {
      title:"Secretaría • Estudiantes",
      desc:"Registrar estudiantes (individual o carga masiva CSV).",
      badge:"Secretaría",
      icon:"SE",
      enabled: canSecretaria,
      onClick: ()=> showView(viewSecretaria)
    },
    {
      title:"Docente • Registro de notas",
      desc:"Actividades (nota + observación) y definitiva automática.",
      badge:"Docente",
      icon:"DO",
      enabled: canDocente,
      onClick: ()=> { showView(viewDocente); dcInitIfNeeded(); }
    },
    {
      title:"Soporte • Configuración",
      desc:"Crear cursos/grupos y materias sin entrar a Firebase.",
      badge:"Soporte",
      icon:"SP",
      enabled: canSoporte,
      onClick: ()=> showView(viewSoporte)
    }
  ];

  modules.forEach(m=>{
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
        <span class="badge">${m.badge}</span>
        <span class="arrow">→</span>
      </div>
    `;
    btn.addEventListener("click", ()=>{
      if(!m.enabled) return alert("No tienes permisos para este módulo.");
      m.onClick();
    });
    modulesGrid.appendChild(btn);
  });
}

/* =========================================================
   SECRETARIA (igual a lo que ya venías usando)
   ========================================================= */
const stTipoDoc = document.getElementById("stTipoDoc");
const stDocumento = document.getElementById("stDocumento");
const stNombres = document.getElementById("stNombres");
const stApellidos = document.getElementById("stApellidos");
const stGrado = document.getElementById("stGrado");
const stCurso = document.getElementById("stCurso");
const stJornada = document.getElementById("stJornada");
const stEdad = document.getElementById("stEdad");
const stCorreo = document.getElementById("stCorreo");
const stTelefono = document.getElementById("stTelefono");
const stDireccion = document.getElementById("stDireccion");

const btnGuardarEstudiante = document.getElementById("btnGuardarEstudiante");
const btnLimpiarEstudiante = document.getElementById("btnLimpiarEstudiante");
const msgSecretaria1 = document.getElementById("msgSecretaria1");
const msgSecretaria2 = document.getElementById("msgSecretaria2");

function limpiarFormEst(){
  stTipoDoc.value="TI";
  stDocumento.value="";
  stNombres.value="";
  stApellidos.value="";
  stGrado.value="";
  stCurso.value="";
  stJornada.value="Mañana";
  stEdad.value="";
  stCorreo.value="";
  stTelefono.value="";
  stDireccion.value="";
  setMsg(msgSecretaria1,"","");
}
btnLimpiarEstudiante?.addEventListener("click", limpiarFormEst);

btnGuardarEstudiante?.addEventListener("click", async ()=>{
  try{
    setMsg(msgSecretaria1,"","");
    const documento = String(stDocumento.value||"").trim();
    const nombres = String(stNombres.value||"").trim().toUpperCase();
    const apellidos = String(stApellidos.value||"").trim().toUpperCase();
    const gradoRaw = String(stGrado.value||"").trim();
    const curso = String(stCurso.value||"").trim().toUpperCase();

    if(!documento || !nombres || !apellidos || !gradoRaw || !curso){
      return setMsg(msgSecretaria1,"Faltan campos obligatorios (*).","warn");
    }
    const payload = {
      tipoDoc: String(stTipoDoc.value||"TI"),
      documento,
      nombres,
      apellidos,
      grado: isNaN(Number(gradoRaw)) ? gradoRaw : Number(gradoRaw),
      curso,
      jornada: String(stJornada.value||"Mañana"),
      edad: stEdad.value ? Number(stEdad.value) : null,
      correo: String(stCorreo.value||"").trim(),
      telefono: String(stTelefono.value||"").trim(),
      direccion: String(stDireccion.value||"").trim(),
      activo:true,
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db,"estudiantes",documento), payload, {merge:true});
    setMsg(msgSecretaria1,`✅ Guardado: ${documento} - ${nombres} ${apellidos}`,"ok");
  }catch(e){
    console.error(e);
    setMsg(msgSecretaria1,"❌ No se pudo guardar. Revisa permisos/reglas.","err");
  }
});

const csvFile = document.getElementById("csvFile");
const btnImportarCSV = document.getElementById("btnImportarCSV");
const btnDescargarPlantillaCSV = document.getElementById("btnDescargarPlantillaCSV");

function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}
btnDescargarPlantillaCSV?.addEventListener("click", ()=>{
  downloadText("plantilla_estudiantes.csv",
`tipoDoc,documento,nombres,apellidos,grado,curso,jornada,edad,correo,telefono,direccion
TI,123456789,JUAN,CARLOS,11,11A,Mañana,16,acudiente@gmail.com,3110000000,Barrio X
`);
});

function parseCSV(text){
  const sep = text.includes(";") && !text.includes(",") ? ";" : (text.includes(";") ? ";" : ",");
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<2) return {headers:[], rows:[]};
  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(sep).map(c=>c.trim());
    const obj={};
    headers.forEach((h,idx)=> obj[h]=cols[idx]??"");
    rows.push(obj);
  }
  return {headers, rows};
}

btnImportarCSV?.addEventListener("click", async ()=>{
  try{
    setMsg(msgSecretaria2,"","");
    const file = csvFile?.files?.[0];
    if(!file) return setMsg(msgSecretaria2,"Selecciona un CSV primero.","warn");
    const text = await file.text();
    const {rows} = parseCSV(text);
    if(rows.length===0) return setMsg(msgSecretaria2,"El CSV no tiene filas.","warn");

    const batch = writeBatch(db);
    let ok=0, skip=0;

    rows.forEach(r=>{
      const documento = String(r.documento||"").trim();
      const nombres = String(r.nombres||"").trim().toUpperCase();
      const apellidos = String(r.apellidos||"").trim().toUpperCase();
      const gradoRaw = String(r.grado||"").trim();
      const curso = String(r.curso||"").trim().toUpperCase();

      if(!documento || !nombres || !apellidos || !gradoRaw || !curso){ skip++; return; }

      const payload = {
        tipoDoc: String(r.tipodoc || r.tipodocumento || r.tipodoc || "TI").trim() || "TI",
        documento,
        nombres,
        apellidos,
        grado: isNaN(Number(gradoRaw)) ? gradoRaw : Number(gradoRaw),
        curso,
        jornada: String(r.jornada||"Mañana").trim() || "Mañana",
        edad: r.edad ? Number(r.edad) : null,
        correo: String(r.correo||"").trim(),
        telefono: String(r.telefono||"").trim(),
        direccion: String(r.direccion||"").trim(),
        activo:true,
        updatedAt: serverTimestamp()
      };
      batch.set(doc(db,"estudiantes",documento), payload, {merge:true});
      ok++;
    });

    if(ok===0) return setMsg(msgSecretaria2,"No hay filas válidas.","warn");
    await batch.commit();
    setMsg(msgSecretaria2,`✅ Importación lista. Guardados: ${ok}. Omitidos: ${skip}.`,"ok");
  }catch(e){
    console.error(e);
    setMsg(msgSecretaria2,"❌ Error importando CSV.","err");
  }
});

/* =========================================================
   DOCENTE (materias desplegable + actividades + obs + promedio)
   ========================================================= */
const dcCurso = document.getElementById("dcCurso");
const dcPeriodo = document.getElementById("dcPeriodo");
const dcMateria = document.getElementById("dcMateria");
const dcBtnLoad = document.getElementById("dcBtnLoad");
const dcBtnSave = document.getElementById("dcBtnSave");
const dcBtnAddAct = document.getElementById("dcBtnAddAct");
const dcMsg = document.getElementById("dcMsg");
const dcTableWrap = document.getElementById("dcTableWrap");

let DC = {
  inited:false,
  cursos:[],          // {id, grado, ...}
  materias:[],        // {id, nombre, grado, activa}
  actividades:[],     // {id, nombre}
  estudiantes:[],     // {documento,nombres,apellidos}
  notasByDoc:{},      // documento -> {actId:{nota,obs}}
  sheetKey:"",
  materiaId:"",
  cursoId:"",
  grado:null,
  periodo:1
};

function dcSheetKey(){
  return `${DC.cursoId}_${DC.periodo}_${DC.materiaId}`;
}

async function dcLoadCursos(){
  // Trae todos los cursos (sin filtros para evitar índices)
  const snap = await getDocs(collection(db,"cursos"));
  const list = [];
  snap.forEach(d=>{
    const x = d.data() || {};
    list.push({ id:d.id, ...x });
  });
  // opcional: filtrar por año lectivo si está
  const filtered = CFG?.añoLectivo ? list.filter(c => String(c.añoLectivo||"") === String(CFG.añoLectivo)) : list;

  filtered.sort((a,b)=> String(a.id).localeCompare(String(b.id)));
  DC.cursos = filtered;
  dcCurso.innerHTML = filtered.map(c=> `<option value="${c.id}">${c.id}</option>`).join("") || `<option value="">(Sin cursos)</option>`;
}

async function dcLoadMateriasByGrado(grado){
  // IMPORTANTE: NO usamos 2 where para evitar “requires index”
  const q = query(collection(db,"materias"), where("grado","==", Number(grado)));
  const snap = await getDocs(q);
  const list=[];
  snap.forEach(d=>{
    const x = d.data() || {};
    const activa = (x.activa === true) || (x.activa == null); // si no existe, la tomamos como activa
    if(activa) list.push({ id:d.id, ...x });
  });
  list.sort((a,b)=> String(a.nombre||"").localeCompare(String(b.nombre||"")));
  DC.materias = list;

  if(list.length===0){
    dcMateria.innerHTML = `<option value="">(No hay materias para grado ${grado})</option>`;
  }else{
    dcMateria.innerHTML = `<option value="">Selecciona...</option>` +
      list.map(m=> `<option value="${m.id}">${m.nombre}</option>`).join("");
  }
}

async function dcLoadPlanilla(key){
  const snap = await getDoc(doc(db,"planillas", key));
  if(!snap.exists()){
    DC.actividades = []; // vacío, el docente agrega
    return;
  }
  const data = snap.data() || {};
  DC.actividades = Array.isArray(data.actividades) ? data.actividades : [];
}

async function dcLoadEstudiantes(cursoId){
  const q = query(collection(db,"estudiantes"), where("curso","==", cursoId));
  const snap = await getDocs(q);
  const list=[];
  snap.forEach(d=>{
    const x = d.data() || {};
    if(x.activo === false) return;
    list.push({
      documento: d.id,
      nombres: (x.nombres||"").toString(),
      apellidos: (x.apellidos||"").toString()
    });
  });
  list.sort((a,b)=> (a.apellidos+a.nombres).localeCompare(b.apellidos+b.nombres));
  DC.estudiantes = list;
}

async function dcLoadNotas(key){
  const q = query(collection(db,"notas"), where("sheetKey","==", key));
  const snap = await getDocs(q);
  const map={};
  snap.forEach(d=>{
    const x = d.data() || {};
    const docu = String(x.estudianteDoc || "");
    if(!docu) return;
    map[docu] = x.actividades || {};
  });
  DC.notasByDoc = map;
}

function dcCalcDef(actsObj){
  const vals = [];
  for(const actId of DC.actividades.map(a=>a.id)){
    const n = clampNote(actsObj?.[actId]?.nota);
    if(n != null) vals.push(n);
  }
  if(vals.length===0) return null;
  const sum = vals.reduce((a,b)=>a+b,0);
  return Math.round((sum/vals.length)*100)/100;
}

function dcRenderTable(){
  if(DC.estudiantes.length===0){
    dcTableWrap.style.display="none";
    setMsg(dcMsg, "No hay estudiantes en ese curso.", "warn");
    return;
  }
  if(!DC.materiaId){
    dcTableWrap.style.display="none";
    setMsg(dcMsg, "Selecciona una materia.", "warn");
    return;
  }

  const actHeaders = DC.actividades.map(a=> `<th>${a.nombre}<br><small>(nota + obs)</small></th>`).join("");

  const rows = DC.estudiantes.map(st=>{
    const acts = DC.notasByDoc[st.documento] || {};
    const def = dcCalcDef(acts);
    const actCells = DC.actividades.map(a=>{
      const n = acts?.[a.id]?.nota ?? "";
      const o = acts?.[a.id]?.obs ?? "";
      return `
        <td>
          <div class="cellGrid">
            <input class="input note" data-doc="${st.documento}" data-act="${a.id}" data-type="nota" placeholder="0.0-5.0" value="${n}">
            <input class="input obs" data-doc="${st.documento}" data-act="${a.id}" data-type="obs" placeholder="Observación / actividad" value="${o}">
          </div>
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td>${st.documento}</td>
        <td>${st.apellidos} ${st.nombres}</td>
        <td class="kpi" data-def="${st.documento}">${def==null ? "-" : def}</td>
        ${actCells}
      </tr>
    `;
  }).join("");

  const html = `
    <table>
      <thead>
        <tr>
          <th>Documento</th>
          <th>Estudiante</th>
          <th>Definitiva</th>
          ${actHeaders}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  dcTableWrap.innerHTML = html;
  dcTableWrap.style.display="block";

  // recalcular definitiva en vivo
  dcTableWrap.querySelectorAll("input[data-type='nota']").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const docu = inp.dataset.doc;
      const act = inp.dataset.act;
      const v = clampNote(inp.value);
      DC.notasByDoc[docu] = DC.notasByDoc[docu] || {};
      DC.notasByDoc[docu][act] = DC.notasByDoc[docu][act] || {};
      DC.notasByDoc[docu][act].nota = (v==null ? "" : v);

      const def = dcCalcDef(DC.notasByDoc[docu]);
      const cell = dcTableWrap.querySelector(`[data-def='${docu}']`);
      if(cell) cell.textContent = (def==null ? "-" : def);
    });
  });

  // obs
  dcTableWrap.querySelectorAll("input[data-type='obs']").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const docu = inp.dataset.doc;
      const act = inp.dataset.act;
      DC.notasByDoc[docu] = DC.notasByDoc[docu] || {};
      DC.notasByDoc[docu][act] = DC.notasByDoc[docu][act] || {};
      DC.notasByDoc[docu][act].obs = inp.value || "";
    });
  });

  setMsg(dcMsg, `Listo. ${DC.estudiantes.length} estudiantes cargados.`, "ok");
}

async function dcInitIfNeeded(){
  if(DC.inited) return;
  DC.inited = true;

  setMsg(dcMsg,"Cargando cursos...","");

  await dcLoadCursos();

  dcCurso.addEventListener("change", async ()=>{
    const cursoId = dcCurso.value;
    const cursoObj = DC.cursos.find(c=>c.id===cursoId);
    DC.cursoId = cursoId;
    DC.grado = cursoObj?.grado ?? null;

    // cargar materias según grado del curso
    if(DC.grado == null){
      dcMateria.innerHTML = `<option value="">(El curso no tiene grado)</option>`;
      return;
    }
    try{
      setMsg(dcMsg, "Cargando materias...", "");
      await dcLoadMateriasByGrado(DC.grado);
      setMsg(dcMsg, "", "");
    }catch(e){
      console.error(e);
      dcMateria.innerHTML = `<option value="">-- Error cargando materias --</option>`;
      setMsg(dcMsg, "❌ Error cargando materias. Revisa reglas o consola.", "err");
    }
  });

  // dispara inicial
  if(dcCurso.value){
    dcCurso.dispatchEvent(new Event("change"));
  }
}

dcMateria.addEventListener("change", ()=>{
  DC.materiaId = dcMateria.value || "";
});

dcBtnLoad.addEventListener("click", async ()=>{
  try{
    setMsg(dcMsg,"","");

    DC.cursoId = dcCurso.value;
    DC.periodo = Number(dcPeriodo.value || 1);
    DC.materiaId = dcMateria.value || "";

    if(!DC.cursoId) return setMsg(dcMsg,"Selecciona un curso.","warn");
    if(!DC.materiaId) return setMsg(dcMsg,"Selecciona una materia.","warn");

    DC.sheetKey = dcSheetKey();

    setMsg(dcMsg,"Cargando planilla y estudiantes...","");

    await dcLoadPlanilla(DC.sheetKey);
    await dcLoadEstudiantes(DC.cursoId);
    await dcLoadNotas(DC.sheetKey);

    dcRenderTable();
  }catch(e){
    console.error(e);
    setMsg(dcMsg,"❌ Error cargando estudiantes/notas.","err");
  }
});

dcBtnAddAct.addEventListener("click", async ()=>{
  try{
    DC.cursoId = dcCurso.value;
    DC.periodo = Number(dcPeriodo.value || 1);
    DC.materiaId = dcMateria.value || "";
    if(!DC.cursoId || !DC.materiaId) return alert("Selecciona curso y materia primero.");

    const nombre = prompt("Nombre de la actividad (ej: Taller 1, Examen, Tarea):");
    if(!nombre) return;

    const actId = "A" + Date.now().toString(36);
    DC.actividades.push({ id: actId, nombre: nombre.trim() });

    DC.sheetKey = dcSheetKey();
    await setDoc(doc(db,"planillas", DC.sheetKey), {
      sheetKey: DC.sheetKey,
      cursoId: DC.cursoId,
      periodo: DC.periodo,
      materiaId: DC.materiaId,
      actividades: DC.actividades,
      updatedAt: serverTimestamp()
    }, {merge:true});

    // re-render si ya hay estudiantes cargados
    if(DC.estudiantes.length>0) dcRenderTable();
    setMsg(dcMsg, "✅ Actividad agregada.", "ok");
  }catch(e){
    console.error(e);
    setMsg(dcMsg,"❌ No se pudo agregar actividad.","err");
  }
});

dcBtnSave.addEventListener("click", async ()=>{
  try{
    if(!DC.sheetKey) return setMsg(dcMsg,"Primero carga estudiantes.","warn");
    if(DC.estudiantes.length===0) return setMsg(dcMsg,"No hay estudiantes.","warn");

    const batch = writeBatch(db);

    DC.estudiantes.forEach(st=>{
      const acts = DC.notasByDoc[st.documento] || {};
      const def = dcCalcDef(acts);

      const payload = {
        sheetKey: DC.sheetKey,
        cursoId: DC.cursoId,
        periodo: DC.periodo,
        materiaId: DC.materiaId,
        estudianteDoc: st.documento,
        actividades: acts,
        definitiva: def,
        updatedAt: serverTimestamp()
      };

      const docId = `${DC.sheetKey}_${st.documento}`;
      batch.set(doc(db,"notas", docId), payload, {merge:true});
    });

    await batch.commit();
    setMsg(dcMsg,"✅ Notas guardadas correctamente.","ok");
  }catch(e){
    console.error(e);
    setMsg(dcMsg,"❌ Error guardando notas.","err");
  }
});

/* =========================================================
   SOPORTE (crear cursos y materias desde el sistema)
   ========================================================= */
const spCursoId = document.getElementById("spCursoId");
const spCursoGrado = document.getElementById("spCursoGrado");
const spCursoJornada = document.getElementById("spCursoJornada");
const spCursoAnio = document.getElementById("spCursoAnio");
const spCrearCurso = document.getElementById("spCrearCurso");
const spMsgCurso = document.getElementById("spMsgCurso");

const spMatGrado = document.getElementById("spMatGrado");
const spMatNombre = document.getElementById("spMatNombre");
const spCrearMateria = document.getElementById("spCrearMateria");
const spMsgMateria = document.getElementById("spMsgMateria");

spCrearCurso.addEventListener("click", async ()=>{
  try{
    setMsg(spMsgCurso,"","");
    const id = String(spCursoId.value||"").trim().toUpperCase();
    const gradoRaw = String(spCursoGrado.value||"").trim();
    if(!id || !gradoRaw) return setMsg(spMsgCurso,"Faltan campos obligatorios (*).","warn");

    const payload = {
      nombre: id,
      grado: isNaN(Number(gradoRaw)) ? gradoRaw : Number(gradoRaw),
      jornada: String(spCursoJornada.value||"Mañana"),
      añoLectivo: spCursoAnio.value ? Number(spCursoAnio.value) : (CFG?.añoLectivo ?? null),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db,"cursos", id), payload, {merge:true});
    setMsg(spMsgCurso,`✅ Curso guardado: ${id}`,"ok");

    // refrescar cursos para docente si ya está abierto
    if(DC.inited) await dcLoadCursos();
  }catch(e){
    console.error(e);
    setMsg(spMsgCurso,"❌ No se pudo guardar el curso.","err");
  }
});

spCrearMateria.addEventListener("click", async ()=>{
  try{
    setMsg(spMsgMateria,"","");
    const gradoRaw = String(spMatGrado.value||"").trim();
    const nombre = String(spMatNombre.value||"").trim();
    if(!gradoRaw || !nombre) return setMsg(spMsgMateria,"Faltan campos obligatorios (*).","warn");

    await addDoc(collection(db,"materias"), {
      activa:true,
      grado: isNaN(Number(gradoRaw)) ? gradoRaw : Number(gradoRaw),
      nombre,
      createdAt: serverTimestamp()
    });

    setMsg(spMsgMateria,`✅ Materia creada: ${nombre}`,"ok");
  }catch(e){
    console.error(e);
    setMsg(spMsgMateria,"❌ No se pudo crear la materia.","err");
  }
});

/* ===== Auth guard ===== */
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = "index.html";
    return;
  }

  await loadConfigGeneral();

  PROFILE = await loadUserProfile(user.uid);

  if(!PROFILE){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }
  if(PROFILE.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  userNameEl.textContent = PROFILE.nombre || "(Sin nombre)";
  userRoleEl.textContent = PROFILE.rol || "(Sin rol)";
  renderModulesByRole(PROFILE.rol);
});

/* ===== logout ===== */
btnLogout.addEventListener("click", async ()=>{
  await signOut(auth);
  window.location.href = "index.html";
});

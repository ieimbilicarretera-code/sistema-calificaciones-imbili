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
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
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
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const instNameEl = document.getElementById("instName");
const userNameEl = document.getElementById("userName");
const userRoleEl = document.getElementById("userRole");
const anioEl = document.getElementById("anioLectivo");
const periodosEl = document.getElementById("periodos");
const btnLogout = document.getElementById("btnLogout");

/* =========================
   Helpers
   ========================= */
function normalizeRole(r){
  return String(r || "").trim().toLowerCase();
}

function setMsg(el, text, type=""){
  if(!el) return;
  el.style.display = text ? "block" : "none";
  el.className = "msg " + (type || "");
  el.textContent = text || "";
}

async function loadConfigGeneral() {
  try {
    const snap = await getDoc(doc(db, "config", "general"));
    if (snap.exists()) {
      const cfg = snap.data();
      if (cfg?.institucion) instNameEl.textContent = cfg.institucion;
      if (cfg?.añoLectivo != null) anioEl.textContent = String(cfg.añoLectivo);
      if (cfg?.periodos != null) periodosEl.textContent = String(cfg.periodos);
    }
  } catch (e) {}
}

async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return snap.data();
}

/* =========================
   Tabs
   ========================= */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tabview").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    const id = btn.dataset.tab;
    document.getElementById(`tab-${id}`).classList.add("active");
  });
});

/* =========================
   USUARIOS
   ========================= */
const u_uid = document.getElementById("u_uid");
const u_rol = document.getElementById("u_rol");
const u_nombre = document.getElementById("u_nombre");
const u_cedula = document.getElementById("u_cedula");
const u_correo = document.getElementById("u_correo");
const u_activo = document.getElementById("u_activo");
const u_must = document.getElementById("u_must");
const msgUsuarios = document.getElementById("msgUsuarios");

document.getElementById("btnSaveUser").addEventListener("click", async () => {
  try{
    setMsg(msgUsuarios, "", "");
    const uid = (u_uid.value || "").trim();
    if(!uid) return setMsg(msgUsuarios, "❗ Debes pegar el UID del usuario.", "warn");

    const payload = {
      nombre: (u_nombre.value || "").trim(),
      cedula: (u_cedula.value || "").trim(),
      correo: (u_correo.value || "").trim(),
      rol: (u_rol.value || "").trim(),
      activo: (u_activo.value === "true"),
      mustChangePassword: (u_must.value === "true"),
      updatedAt: serverTimestamp()
    };

    if(!payload.nombre || !payload.cedula || !payload.correo || !payload.rol){
      return setMsg(msgUsuarios, "❗ Faltan campos obligatorios.", "warn");
    }

    await setDoc(doc(db, "usuarios", uid), payload, { merge:true });
    setMsg(msgUsuarios, "✅ Perfil guardado/actualizado en Firestore.", "ok");
  }catch(e){
    console.error(e);
    setMsg(msgUsuarios, "❌ No se pudo guardar el perfil. Revisa reglas/permisos.", "err");
  }
});

document.getElementById("btnLoadUser").addEventListener("click", async () => {
  try{
    setMsg(msgUsuarios, "", "");
    const uid = (u_uid.value || "").trim();
    if(!uid) return setMsg(msgUsuarios, "Escribe/pega un UID primero.", "warn");

    const snap = await getDoc(doc(db, "usuarios", uid));
    if(!snap.exists()){
      return setMsg(msgUsuarios, "No existe perfil para ese UID.", "warn");
    }
    const d = snap.data();
    u_nombre.value = d.nombre || "";
    u_cedula.value = d.cedula || "";
    u_correo.value = d.correo || "";
    u_rol.value = (d.rol || "docente").toLowerCase();
    u_activo.value = String(!!d.activo);
    u_must.value = String(!!d.mustChangePassword);

    setMsg(msgUsuarios, "✅ Perfil cargado.", "ok");
  }catch(e){
    console.error(e);
    setMsg(msgUsuarios, "❌ Error cargando perfil.", "err");
  }
});

/* =========================
   CURSOS
   ========================= */
const c_id = document.getElementById("c_id");
const c_grado = document.getElementById("c_grado");
const c_jornada = document.getElementById("c_jornada");
const c_anio = document.getElementById("c_anio");
const c_diruid = document.getElementById("c_diruid");
const msgCursos = document.getElementById("msgCursos");
const tblCursosBody = document.querySelector("#tblCursos tbody");

document.getElementById("btnSaveCurso").addEventListener("click", async () => {
  try{
    setMsg(msgCursos, "", "");
    const id = (c_id.value || "").trim().toUpperCase();
    const grado = Number(c_grado.value);
    if(!id || Number.isNaN(grado)) return setMsg(msgCursos, "❗ Curso y grado son obligatorios.", "warn");

    const payload = {
      nombre: id,
      grado,
      jornada: (c_jornada.value || "Mañana"),
      añoLectivo: c_anio.value ? Number(c_anio.value) : null,
      directorUid: (c_diruid.value || "").trim(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "cursos", id), payload, { merge:true });
    setMsg(msgCursos, `✅ Curso guardado: ${id}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgCursos, "❌ No se pudo guardar el curso.", "err");
  }
});

document.getElementById("btnListCursos").addEventListener("click", async () => {
  try{
    setMsg(msgCursos, "", "");
    tblCursosBody.innerHTML = "";
    const qy = query(collection(db, "cursos"), orderBy("grado", "asc"), limit(200));
    const snap = await getDocs(qy);

    snap.forEach(docu => {
      const d = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.nombre || docu.id}</td>
        <td>${d.grado ?? ""}</td>
        <td>${d.jornada ?? ""}</td>
        <td>${d.añoLectivo ?? ""}</td>
        <td>${d.directorUid ?? ""}</td>
      `;
      tblCursosBody.appendChild(tr);
    });

    setMsg(msgCursos, `✅ Cursos cargados: ${snap.size}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgCursos, "❌ Error cargando cursos.", "err");
  }
});

/* =========================
   MATERIAS
   ========================= */
const m_id = document.getElementById("m_id");
const m_grado = document.getElementById("m_grado");
const m_nombre = document.getElementById("m_nombre");
const m_activa = document.getElementById("m_activa");
const msgMaterias = document.getElementById("msgMaterias");
const tblMateriasBody = document.querySelector("#tblMaterias tbody");

document.getElementById("btnSaveMateria").addEventListener("click", async () => {
  try{
    setMsg(msgMaterias, "", "");
    const grado = Number(m_grado.value);
    const nombre = (m_nombre.value || "").trim();
    const activa = (m_activa.value === "true");

    if(Number.isNaN(grado) || !nombre){
      return setMsg(msgMaterias, "❗ Grado y nombre son obligatorios.", "warn");
    }

    const payload = {
      grado,
      nombre,
      activa,
      updatedAt: serverTimestamp()
    };

    const id = (m_id.value || "").trim();
    if(id){
      await setDoc(doc(db, "materias", id), payload, { merge:true });
      setMsg(msgMaterias, `✅ Materia guardada (ID fijo): ${id}`, "ok");
    }else{
      const ref = await addDoc(collection(db, "materias"), payload);
      setMsg(msgMaterias, `✅ Materia creada (ID): ${ref.id}`, "ok");
    }
  }catch(e){
    console.error(e);
    setMsg(msgMaterias, "❌ No se pudo guardar materia.", "err");
  }
});

document.getElementById("btnListMaterias").addEventListener("click", async () => {
  try{
    setMsg(msgMaterias, "", "");
    tblMateriasBody.innerHTML = "";

    const qy = query(collection(db, "materias"), orderBy("grado", "asc"), orderBy("nombre", "asc"), limit(300));
    const snap = await getDocs(qy);

    snap.forEach(docu => {
      const d = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.nombre || ""}</td>
        <td>${d.grado ?? ""}</td>
        <td>${d.activa ? "Sí" : "No"}</td>
        <td class="mono">${docu.id}</td>
      `;
      tblMateriasBody.appendChild(tr);
    });

    setMsg(msgMaterias, `✅ Materias cargadas: ${snap.size}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgMaterias, "❌ Error cargando materias.", "err");
  }
});

/* =========================
   SOLICITUDES
   ========================= */
const msgSolicitudes = document.getElementById("msgSolicitudes");
const tblSolBody = document.querySelector("#tblSolicitudes tbody");

document.getElementById("btnListSolicitudes").addEventListener("click", async () => {
  try{
    setMsg(msgSolicitudes, "", "");
    tblSolBody.innerHTML = "";

    const qy = query(collection(db, "solicitudes"), orderBy("createdAt", "desc"), limit(200));
    const snap = await getDocs(qy);

    snap.forEach(docu => {
      const d = docu.data();
      const estado = d.status || "pendiente";
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td class="mono">${docu.id}</td>
        <td>${d.tipo || ""}</td>
        <td>${d.docenteNombre || d.docenteUid || ""}</td>
        <td>${d.descripcion || ""}</td>
        <td><span class="pill small">${estado}</span></td>
        <td>
          <button class="btn small primary" data-act="aprobar">Aprobar</button>
          <button class="btn small" data-act="rechazar">Rechazar</button>
        </td>
      `;

      tr.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", async () => {
          const act = btn.dataset.act;
          await updateDoc(doc(db, "solicitudes", docu.id), {
            status: act === "aprobar" ? "aprobada" : "rechazada",
            resolvedAt: serverTimestamp()
          });
          setMsg(msgSolicitudes, `✅ Solicitud ${docu.id} -> ${act}`, "ok");
        });
      });

      tblSolBody.appendChild(tr);
    });

    setMsg(msgSolicitudes, `✅ Solicitudes cargadas: ${snap.size}`, "ok");
  }catch(e){
    console.error(e);
    setMsg(msgSolicitudes, "❌ Error cargando solicitudes.", "err");
  }
});

/* =========================
   Auth guard + carga inicial
   ========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  await loadConfigGeneral();

  const profile = await loadUserProfile(user.uid);
  if(!profile){
    alert("Tu usuario no tiene perfil en la base de datos. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  if(profile.activo !== true){
    alert("Usuario inactivo. Contacta a soporte.");
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const role = normalizeRole(profile.rol);
  if(role !== "soporte"){
    alert("No tienes permisos para ingresar al módulo Soporte.");
    window.location.href = "app.html";
    return;
  }

  userNameEl.textContent = profile.nombre || "(Sin nombre)";
  userRoleEl.textContent = profile.rol || "soporte";
});

/* =========================
   Logout
   ========================= */
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

// teacher.js
// ATTENZIONE: qui NON dichiariamo db né auth.
// Devono essere già definiti in firebase-config.js come var db, var auth.

// -------------------------
// LISTENER UI
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn   = document.getElementById("loginBtn");
  const logoutBtn  = document.getElementById("logoutBtn");
  const createBtn  = document.getElementById("createSessionBtn");
  const deleteBtn  = document.getElementById("deleteSessionBtn");
  const startBtn   = document.getElementById("startSessionBtn");

  if (loginBtn) {
    loginBtn.addEventListener("touchstart", e => { e.preventDefault(); loginTeacher(); }, { passive: false });
    loginBtn.addEventListener("click", loginTeacher);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("touchstart", e => { e.preventDefault(); auth.signOut(); }, { passive: false });
    logoutBtn.addEventListener("click", () => auth.signOut());
  }

  if (createBtn) {
    createBtn.addEventListener("touchstart", e => { e.preventDefault(); createSession(); }, { passive: false });
    createBtn.addEventListener("click", createSession);
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("touchstart", e => { e.preventDefault(); deleteSession(); }, { passive: false });
    deleteBtn.addEventListener("click", deleteSession);
  }

  if (startBtn) {
    startBtn.addEventListener("touchstart", e => { e.preventDefault(); startSession(); }, { passive: false });
    startBtn.addEventListener("click", startSession);
  }
});

// -------------------------
// GESTIONE LISTENER FIREBASE
// -------------------------
let teacherListeners = [];

function addTeacherListener(ref, event, callback) {
  ref.on(event, callback);
  teacherListeners.push({ ref, event, callback });
}

function removeTeacherListeners() {
  teacherListeners.forEach(l => l.ref.off(l.event, l.callback));
  teacherListeners = [];
}

// -------------------------
// LOGIN / LOGOUT DOCENTE
// -------------------------
function loginTeacher() {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById("loginForm").style.display   = "none";
      document.getElementById("teacherPanel").style.display = "block";
      loadSessionStatus();
    })
    .catch(err => {
      console.error("Errore login:", err);
      document.getElementById("loginError").textContent = "Credenziali errate";
    });
}

auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById("teacherPanel").style.display = "none";
    document.getElementById("loginForm").style.display    = "block";
  }
});

// -------------------------
// SESSIONE: CREA / ELIMINA / AVVIA
// -------------------------
function createSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  if (!sessionId) return;

  db.ref(`sessions/${sessionId}`).set({
    status: "waiting",
    players: {}
  });

  loadSessionStatus();
}

function deleteSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  if (!sessionId) return;

  db.ref(`sessions/${sessionId}`).remove();
  loadSessionStatus();
}

function startSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  if (!sessionId) return;

  db.ref(`sessions/${sessionId}/status`).set("started");
}

// -------------------------
// CARICA STATO SESSIONE
// -------------------------
function loadSessionStatus() {
  const sessionId  = document.getElementById("sessionId").value.trim();
  const statusBox  = document.getElementById("sessionStatus");
  const activeBox  = document.getElementById("activeSessionBox");
  const startBox   = document.getElementById("startSessionBox");
  const deleteBtn  = document.getElementById("deleteSessionBtn");

  // Nessun codice sessione → UI pulita
  if (!sessionId) {
    statusBox.textContent      = "Nessuna sessione";
    activeBox.style.display    = "none";
    startBox.style.display     = "none";
    deleteBtn.style.display    = "none";
    removeTeacherListeners();
    return;
  }

  // Rimuovi listener precedenti
  removeTeacherListeners();

  // Listener principale sulla sessione
  addTeacherListener(
    db.ref(`sessions/${sessionId}`),
    "value",
    snap => {
      if (!snap.exists()) {
        statusBox.textContent   = "Nessuna sessione attiva";
        activeBox.style.display = "none";
        startBox.style.display  = "none";
        deleteBtn.style.display = "none";
        return;
      }

      const data = snap.val();

      statusBox.textContent   = "Sessione attiva";
      deleteBtn.style.display = "block";

      if (data.status === "waiting") {
        startBox.style.display = "block";
      } else {
        startBox.style.display = "none";
      }

      activeBox.style.display = "block";
      document.getElementById("activeSessionLabel").textContent =
        "Sessione: " + sessionId;

      updatePlayersList(sessionId);
      updateScores(sessionId);
      updateQuestionsInfo(sessionId);
    }
  );
}

// -------------------------
// LISTA STUDENTI
// -------------------------
function updatePlayersList(sessionId) {
  const list = document.getElementById("playersList");
  list.innerHTML = "<ul></ul>";
  const ul = list.querySelector("ul");

  addTeacherListener(
    db.ref(`sessions/${sessionId}/players`),
    "value",
    snap => {
      ul.innerHTML = "";
      snap.forEach(child => {
        const player = child.val();
        const li = document.createElement("li");
        li.textContent = player.name || "(senza nome)";
        if (player.leftEarly) {
          label += " (uscito prima)";
        }

        ul.appendChild(li);
      });
    }
  );
}

// -------------------------
// PUNTEGGI
// -------------------------
function updateScores(sessionId) {
  const scoresBox = document.getElementById("scores");
  scoresBox.innerHTML = "<ol></ol>";
  const ol = scoresBox.querySelector("ol");

  addTeacherListener(
    db.ref(`sessions/${sessionId}/players`),
    "value",
    snap => {
      ol.innerHTML = "";
      snap.forEach(child => {
        const player = child.val();
        const li = document.createElement("li");
        li.textContent = `${player.name || "(senza nome)"} – ${player.score || 0}`;
        ol.appendChild(li);
      });
    }
  );
}

// -------------------------
// EXCEL: CARICA / ELIMINA
// -------------------------
const excelInput     = document.getElementById("excelFile");
const uploadBtn      = document.getElementById("uploadExcelBtn");
const excelStatus    = document.getElementById("excelStatus");
const deleteExcelBtn = document.getElementById("deleteExcelBtn");

if (uploadBtn) {
  uploadBtn.addEventListener("click", handleExcelUpload);
}

function handleExcelUpload() {
  const file      = excelInput.files[0];
  const sessionId = document.getElementById("sessionId").value.trim();

  if (!sessionId) {
    excelStatus.textContent = "Crea o seleziona una sessione prima di caricare il file.";
    return;
  }

  if (!file) {
    excelStatus.textContent = "Seleziona un file Excel.";
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    const data     = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const cleaned = rows.filter(r => r.length >= 3);

    const questionsRef = db.ref(`sessions/${sessionId}/questions`);
    questionsRef.set({}); // reset

    cleaned.forEach((row, index) => {
      if (index === 0) return; // intestazione
      const [id, text, basket] = row;
      questionsRef.child(id).set({ id, text, basket });
    });

    excelStatus.textContent = "File caricato correttamente.";
    updateQuestionsInfo(sessionId);
    deleteExcelBtn.style.display = "block";
    updateStartButtonVisibility(sessionId);
  };

  reader.readAsArrayBuffer(file);
}

if (deleteExcelBtn) {
  deleteExcelBtn.addEventListener("click", () => {
    const sessionId = document.getElementById("sessionId").value.trim();
    if (!sessionId) return;

    db.ref(`sessions/${sessionId}/questions`).remove();
    excelStatus.textContent = "File eliminato.";
    updateQuestionsInfo(sessionId);
    deleteExcelBtn.style.display = "none";
    updateStartButtonVisibility(sessionId);
  });
}

function updateStartButtonVisibility(sessionId) {
  const startBox = document.getElementById("startSessionBox");
  db.ref(`sessions/${sessionId}/questions`).once("value", snap => {
    startBox.style.display = snap.exists() ? "block" : "none";
  });
}

// -------------------------
// INFO QUESITI
// -------------------------
function updateQuestionsInfo(sessionId) {
  const box       = document.getElementById("questionsInfo");
  const countSpan = document.getElementById("qCount");
  const basketsSpan = document.getElementById("qBaskets");

  db.ref(`sessions/${sessionId}/questions`).once("value", snap => {
    if (!snap.exists()) {
      box.style.display = "none";
      return;
    }

    const data  = snap.val();
    const keys  = Object.keys(data);
    const count = keys.length;
    const baskets = [...new Set(keys.map(k => data[k].basket))];

    countSpan.textContent   = count;
    basketsSpan.textContent = baskets.join(", ");
    box.style.display       = "block";
  });
}

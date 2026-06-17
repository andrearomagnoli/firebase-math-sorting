// teacher.js (inizio)

// Firebase è inizializzato in firebase-config.js
// Usa le istanze già create lì, evita di ridefinirle qui.

const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
const db = (typeof window !== 'undefined' && typeof window.db !== 'undefined') ? window.db : (typeof firebase !== 'undefined' ? firebase.database() : null);

if (!db) {
  console.error("Firebase DB non inizializzato. Controlla firebase-config.js e l'ordine degli script.");
  document.getElementById && (document.getElementById("status") && (document.getElementById("status").textContent = "Errore Firebase: controlla la configurazione."));
}

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const createBtn = document.getElementById("createSessionBtn");
  const deleteBtn = document.getElementById("deleteSessionBtn");
  const startBtn = document.getElementById("startSessionBtn");

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

let teacherListeners = [];
function addTeacherListener(ref, event, callback) {
  ref.on(event, callback);
  teacherListeners.push({ ref, event, callback });
}
function removeTeacherListeners() {
  teacherListeners.forEach(l => l.ref.off(l.event, l.callback));
  teacherListeners = [];
}

// LOGIN DOCENTE
function loginTeacher() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("teacherPanel").style.display = "block";
      loadSessionStatus();
    })
    .catch(err => {
      document.getElementById("loginError").textContent = "Credenziali errate";
    });
}

// LOGOUT
auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById("teacherPanel").style.display = "none";
    document.getElementById("loginForm").style.display = "block";
  }
});

// CREA SESSIONE
function createSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  if (!sessionId) return;

  db.ref(`sessions/${sessionId}`).set({
    status: "waiting",
    players: {}
  });

  loadSessionStatus();
}

// ELIMINA SESSIONE
function deleteSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  if (!sessionId) return;

  db.ref(`sessions/${sessionId}`).remove();
  loadSessionStatus();
}

// AVVIA PARTITA
function startSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  if (!sessionId) return;

  db.ref(`sessions/${sessionId}/status`).set("started");
}

// CARICA STATO SESSIONE
function loadSessionStatus() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const statusBox = document.getElementById("sessionStatus");
  const activeBox = document.getElementById("activeSessionBox");
  const startBox = document.getElementById("startSessionBox");
  const deleteBtn = document.getElementById("deleteSessionBtn");

  // Se non c’è sessionId, UI pulita
  if (!sessionId) {
    statusBox.textContent = "Nessuna sessione";
    activeBox.style.display = "none";
    startBox.style.display = "none";
    deleteBtn.style.display = "none";
    return;
  }

  // Rimuove eventuali listener precedenti
  if (window.teacherListeners) {
    window.teacherListeners.forEach(l => l.ref.off(l.event, l.callback));
  }
  window.teacherListeners = [];

  function addTeacherListener(ref, event, callback) {
    ref.on(event, callback);
    window.teacherListeners.push({ ref, event, callback });
  }

  // Listener principale sulla sessione
  addTeacherListener(
    db.ref(`sessions/${sessionId}`),
    "value",
    snap => {

      // Caso: sessione eliminata
      if (!snap.exists()) {
        statusBox.textContent = "Nessuna sessione attiva";
        activeBox.style.display = "none";
        startBox.style.display = "none";
        deleteBtn.style.display = "none";
        return;
      }

      // Caso: sessione esiste
      const data = snap.val();

      statusBox.textContent = "Sessione attiva";
      deleteBtn.style.display = "block"; // Mostra sempre elimina sessione

      // Mostra o nasconde il pulsante "Avvia partita"
      if (data.status === "waiting") {
        startBox.style.display = "block";
      } else {
        startBox.style.display = "none";
      }

      // Mantieni visibile il box sessione attiva
      activeBox.style.display = "block";

      // Aggiorna etichetta sessione
      document.getElementById("activeSessionLabel").textContent =
        "Sessione: " + sessionId;

      // Aggiorna lista studenti e punteggi
      updatePlayersList(sessionId);
      updateScores(sessionId);
      updateQuestionsInfo(sessionId);
    }
  );
}

// AGGIORNA LISTA STUDENTI
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

        ul.appendChild(li);
      });
    }
  );
}

// AGGIORNA PUNTEGGI
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


// -----------------------------
// GESTIONE FILE EXCEL (3 colonne)
// -----------------------------

const excelInput = document.getElementById("excelFile");
const uploadBtn = document.getElementById("uploadExcelBtn");
const excelStatus = document.getElementById("excelStatus");
const deleteExcelBtn = document.getElementById("deleteExcelBtn");

// Carica Excel
if (uploadBtn) {
  uploadBtn.addEventListener("click", handleExcelUpload);
}

function handleExcelUpload() {
  const file = excelInput.files[0];
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
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Filtra righe con almeno 3 colonne
    const cleaned = rows.filter(r => r.length >= 3);

    const questionsRef = db.ref(`sessions/${sessionId}/questions`);
    questionsRef.set({}); // reset totale

    cleaned.forEach((row, index) => {
      if (index === 0) return; // salta intestazione

      const [id, text, basket] = row;

      questionsRef.child(id).set({
        id,
        text,
        basket
      });
    });

    excelStatus.textContent = "File caricato correttamente.";
    updateQuestionsInfo(sessionId);

    deleteExcelBtn.style.display = "block";
    updateStartButtonVisibility(sessionId);
  };

  reader.readAsArrayBuffer(file);
}

// Elimina file caricato
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

// Mostra/nasconde il pulsante Avvia partita
function updateStartButtonVisibility(sessionId) {
  const startBox = document.getElementById("startSessionBox");

  db.ref(`sessions/${sessionId}/questions`).once("value", snap => {
    if (snap.exists()) {
      startBox.style.display = "block";
    } else {
      startBox.style.display = "none";
    }
  });
}


// -----------------------------
// INFO SINTETICHE QUESITI
// -----------------------------

function updateQuestionsInfo(sessionId) {
  const box = document.getElementById("questionsInfo");
  const countSpan = document.getElementById("qCount");
  const basketsSpan = document.getElementById("qBaskets");

  db.ref(`sessions/${sessionId}/questions`).once("value", snap => {
    if (!snap.exists()) {
      box.style.display = "none";
      return;
    }

    const data = snap.val();
    const keys = Object.keys(data);

    // Numero quesiti
    const count = keys.length;

    // Ceste uniche
    const baskets = [...new Set(keys.map(k => data[k].basket))];

    // Aggiorna UI
    countSpan.textContent = count;
    basketsSpan.textContent = baskets.join(", ");

    box.style.display = "block";
  });
}

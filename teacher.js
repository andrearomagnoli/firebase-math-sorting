// =====================================
// Variabili globali
// =====================================

const auth = firebase.auth();
const db = firebase.database();

let currentSessionId = null;

// =====================================
// Login / Logout docente
// =====================================

auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("teacherPanel").style.display = "none";
    return;
  }

  const uid = user.uid;

  // Verifica che sia un docente approvato
  db.ref("teachers/" + uid).once("value").then(snap => {
    if (!snap.exists()) {
      auth.signOut();
      return;
    }

    document.getElementById("loginForm").style.display = "none";
    document.getElementById("teacherPanel").style.display = "block";

    // Recupera sessione attiva
    db.ref("teacherSessions/" + uid).once("value").then(snap => {
      if (snap.exists()) {
        currentSessionId = snap.val().sessionId;
        localStorage.setItem("currentSessionId", currentSessionId);
        loadLobby();
      } else {
        currentSessionId = null;
        localStorage.removeItem("currentSessionId");
      }

      updateSessionUI();
    });
  });
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentSessionId");
  auth.signOut();
});

// =====================================
// Login docente
// =====================================

function loginTeacher() {
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("loginError");

  errorEl.textContent = "";

  if (!email || !pass) {
    errorEl.textContent = "Inserisci email e password.";
    return;
  }

  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => {
      errorEl.textContent = err.message;
    });
}

// =====================================
// UI dinamica sessione
// =====================================

function updateSessionUI() {
  const createBox = document.getElementById("createSessionBox");
  const activeBox = document.getElementById("activeSessionBox");
  const label = document.getElementById("activeSessionLabel");
  const status = document.getElementById("sessionStatus");

  if (currentSessionId) {
    createBox.style.display = "none";
    activeBox.style.display = "block";
    label.textContent = "Sessione attiva: " + currentSessionId;
    status.textContent = "Sessione attiva: " + currentSessionId;
  } else {
    createBox.style.display = "block";
    activeBox.style.display = "none";
    status.textContent = "Nessuna sessione attiva";
  }
}

// =====================================
// Creazione sessione
// =====================================

function createSession() {
  const sessionIdInput = document.getElementById("sessionId");
  const sessionId = sessionIdInput.value.trim();
  const uid = auth.currentUser.uid;

  if (!sessionId) {
    document.getElementById("sessionStatus").textContent = "Inserisci un ID sessione.";
    return;
  }

  // Controlla se esiste già una sessione
  db.ref("teacherSessions/" + uid).once("value").then(snap => {
    if (snap.exists()) {
      document.getElementById("sessionStatus").textContent =
        "Hai già una sessione attiva: " + snap.val().sessionId;
      return;
    }

    // Crea sessione
    db.ref("sessions/" + sessionId).set({
      status: "waiting",
      teacherId: uid
    })
    .then(() => db.ref("teacherSessions/" + uid).set({ sessionId }))
    .then(() => {
      currentSessionId = sessionId;
      localStorage.setItem("currentSessionId", sessionId);
      updateSessionUI();
      loadLobby();
    });
  });
}

// =====================================
// Eliminazione sessione
// =====================================

function deleteSession() {
  const uid = auth.currentUser.uid;

  if (!currentSessionId) return;

  db.ref("sessions/" + currentSessionId).remove()
    .then(() => db.ref("teacherSessions/" + uid).remove())
    .then(() => {
      localStorage.removeItem("currentSessionId");
      currentSessionId = null;

      document.getElementById("playersList").innerHTML = "";
      document.getElementById("scores").innerHTML = "";

      updateSessionUI();
    });
}

function updateStartButton(players) {
  const startBox = document.getElementById("startSessionBox");

  if (currentSessionId && Object.keys(players).length > 0) {
    startBox.style.display = "block";
  } else {
    startBox.style.display = "none";
  }
}

// =====================================
// Lobby
// =====================================

function loadLobby() {
  if (!currentSessionId) return;
  watchLobby();
  watchScores();
}

function watchLobby() {
  const playersListEl = document.getElementById("playersList");

  db.ref(`sessions/${currentSessionId}/players`).on("value", snap => {
    const players = snap.val() || {};

    updateStartButton(players);

    if (Object.keys(players).length === 0) {
      playersListEl.innerHTML = "Nessuno studente collegato";
      return;
    }

    let html = "<ul>";
    for (const [uid, p] of Object.entries(players)) {
      html += `<li>${p.displayName} – ${p.status}</li>`;
    }
    html += "</ul>";

    playersListEl.innerHTML = html;
  });
}

// =====================================
// Punteggi
// =====================================

function watchScores() {
  const scoresEl = document.getElementById("scores");

  db.ref(`sessions/${currentSessionId}/players`).on("value", snap => {
    const players = snap.val() || {};

    if (Object.keys(players).length === 0) {
      scoresEl.innerHTML = "Nessun punteggio ancora";
      return;
    }

    const sorted = Object.entries(players)
      .sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

    let html = "<ol>";
    sorted.forEach(([uid, p]) => {
      html += `<li>${p.displayName}: ${p.score || 0} punti</li>`;
    });
    html += "</ol>";

    scoresEl.innerHTML = html;
  });
}

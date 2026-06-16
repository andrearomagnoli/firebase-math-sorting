// =====================================
// Firebase
// =====================================
const auth = firebase.auth();
const db = firebase.database();

let currentSessionId = null;

// =====================================
// Mobile integration
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn")?.addEventListener("click", loginTeacher);
  document.getElementById("createSessionBtn")?.addEventListener("click", createSession);
  document.getElementById("deleteSessionBtn")?.addEventListener("click", deleteSession);
  document.getElementById("startSessionBtn")?.addEventListener("click", startSession);
  document.getElementById("logoutBtn")?.addEventListener("click", () => auth.signOut());
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn")?.addEventListener("touchstart", loginTeacher);
  document.getElementById("createSessionBtn")?.addEventListener("touchstart", createSession);
  document.getElementById("deleteSessionBtn")?.addEventListener("touchstart", deleteSession);
  document.getElementById("startSessionBtn")?.addEventListener("touchstart", startSession);
  document.getElementById("logoutBtn")?.addEventListener("touchstart", () => auth.signOut());
});

// =====================================
// Login / Logout
// =====================================

auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("teacherPanel").style.display = "none";
    return;
  }

  const uid = user.uid;

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
        loadLobby();
      } else {
        currentSessionId = null;
      }

      updateSessionUI();
    });
  });
});

document.getElementById("logoutBtn").onclick = () => {
  auth.signOut();
};

// =====================================
// Login docente
// =====================================

function loginTeacher() {
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();

  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => document.getElementById("loginError").textContent = err.message);
}

// =====================================
// UI dinamica
// =====================================

function updateSessionUI() {
  const createBox = document.getElementById("createSessionBox");
  const activeBox = document.getElementById("activeSessionBox");
  const startBox = document.getElementById("startSessionBox");
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
    startBox.style.display = "none";
    status.textContent = "Nessuna sessione attiva";
  }
}

// =====================================
// Creazione sessione
// =====================================

function createSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const uid = auth.currentUser.uid;

  if (!sessionId) return;

  db.ref("teacherSessions/" + uid).once("value").then(snap => {
    if (snap.exists()) return;

    db.ref("sessions/" + sessionId).set({
      status: "waiting",
      teacherId: uid
    })
    .then(() => db.ref("teacherSessions/" + uid).set({ sessionId }))
    .then(() => {
      currentSessionId = sessionId;
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

  db.ref("sessions/" + currentSessionId).remove()
    .then(() => db.ref("teacherSessions/" + uid).remove())
    .then(() => {
      currentSessionId = null;
      document.getElementById("playersList").innerHTML = "";
      document.getElementById("scores").innerHTML = "";
      updateSessionUI();
    });
}

// =====================================
// Lobby
// =====================================

function loadLobby() {
  watchLobby();
  watchScores();
}

function watchLobby() {
  db.ref(`sessions/${currentSessionId}/players`).on("value", snap => {
    const players = snap.val() || {};

    updateStartButton(players);

    const list = document.getElementById("playersList");

    if (Object.keys(players).length === 0) {
      list.innerHTML = "Nessuno studente collegato";
      return;
    }

    let html = "<ul>";
    for (const p of Object.values(players)) {
      html += `<li>${p.displayName} – ${p.status}</li>`;
    }
    html += "</ul>";

    list.innerHTML = html;
  });
}

// =====================================
// Pulsante avvio
// =====================================

function updateStartButton(players) {
  const startBox = document.getElementById("startSessionBox");

  if (currentSessionId && Object.keys(players).length > 0) {
    startBox.style.display = "block";
  } else {
    startBox.style.display = "none";
  }
}

function startSession() {
  db.ref(`sessions/${currentSessionId}/status`).set("running");
}

// =====================================
// Punteggi
// =====================================

function watchScores() {
  db.ref(`sessions/${currentSessionId}/players`).on("value", snap => {
    const players = snap.val() || {};
    const scoresEl = document.getElementById("scores");

    if (Object.keys(players).length === 0) {
      scoresEl.innerHTML = "Nessun punteggio ancora";
      return;
    }

    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));

    let html = "<ol>";
    for (const p of sorted) {
      html += `<li>${p.displayName}: ${p.score || 0} punti</li>`;
    }
    html += "</ol>";

    scoresEl.innerHTML = html;
  });
}

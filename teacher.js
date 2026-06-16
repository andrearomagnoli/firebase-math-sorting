// Firebase è già inizializzato in firebase-config.js
const auth = firebase.auth();
const db = firebase.database();

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

  if (!sessionId) {
    statusBox.textContent = "Nessuna sessione";
    activeBox.style.display = "none";
    startBox.style.display = "none";
    return;
  }

  db.ref(`sessions/${sessionId}`).on("value", snap => {
    if (!snap.exists()) {
      statusBox.textContent = "Nessuna sessione attiva";
      activeBox.style.display = "none";
      startBox.style.display = "none";
      return;
    }

    const data = snap.val();
    statusBox.textContent = "Sessione attiva";
    activeBox.style.display = "block";
    startBox.style.display = "block";

    document.getElementById("activeSessionLabel").textContent =
      "Sessione: " + sessionId;

    updatePlayersList(sessionId);
    updateScores(sessionId);
  });
}

// AGGIORNA LISTA STUDENTI
function updatePlayersList(sessionId) {
  const list = document.getElementById("playersList");
  list.innerHTML = "<ul></ul>";
  const ul = list.querySelector("ul");

  db.ref(`sessions/${sessionId}/players`).on("value", snap => {
    ul.innerHTML = "";

    snap.forEach(child => {
      const player = child.val();

      const li = document.createElement("li");
      li.textContent = player.name || "(senza nome)";

      ul.appendChild(li);
    });
  });
}

// AGGIORNA PUNTEGGI
function updateScores(sessionId) {
  const scoresBox = document.getElementById("scores");
  scoresBox.innerHTML = "<ol></ol>";
  const ol = scoresBox.querySelector("ol");

  db.ref(`sessions/${sessionId}/players`).on("value", snap => {
    ol.innerHTML = "";

    snap.forEach(child => {
      const player = child.val();

      const li = document.createElement("li");
      li.textContent = `${player.name || "(senza nome)"} – ${player.score}`;

      ol.appendChild(li);
    });
  });
}

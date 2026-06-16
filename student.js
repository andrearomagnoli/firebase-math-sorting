// Si assume che firebase.initializeApp(firebaseConfig) sia già chiamato in firebase-config.js
const db = firebase.database();

let currentSessionId = null;
let studentId = null;
let hasJoined = false;

document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("joinBtn");
  const exitBtn = document.getElementById("exitBtn");

  if (joinBtn) {
    joinBtn.addEventListener("click", joinSession);
    joinBtn.addEventListener("touchstart", joinSession, { passive: false });
  }

  if (exitBtn) {
    exitBtn.addEventListener("click", leaveSession);
    exitBtn.addEventListener("touchstart", leaveSession, { passive: false });
  }
});

function joinSession(event) {
  if (event && event.type === "touchstart") {
    event.preventDefault();
  }

  if (hasJoined) return;
  hasJoined = true;

  const sessionIdInput = document.getElementById("sessionId");
  const displayNameInput = document.getElementById("displayName");

  const sessionId = sessionIdInput.value.trim();
  const name = displayNameInput.value.trim();

  if (!sessionId || !name) {
    alert("Inserisci codice sessione e cognome.");
    hasJoined = false;
    return;
  }

  currentSessionId = sessionId;

  const playersRef = db.ref(`sessions/${sessionId}/players`);
  const newPlayer = playersRef.push({
    name: name,
    score: 0
  });

  studentId = newPlayer.key;

  sessionIdInput.style.display = "none";
  displayNameInput.style.display = "none";
  document.getElementById("joinBtn").style.display = "none";
  document.getElementById("exitBtn").style.display = "block";

  document.getElementById("status").textContent =
    "In attesa che il docente avvii la partita.";

  // Se la sessione viene eliminata dal docente
  db.ref(`sessions/${sessionId}`).on("value", snap => {
    if (!snap.exists()) {
      alert("La sessione è stata chiusa dal docente.");
      leaveSession();
    }
  });

  // Avvio partita
  db.ref(`sessions/${sessionId}/status`).on("value", snap => {
    if (snap.val() === "started") {
      startGame();
    }
  });
}

function leaveSession(event) {
  if (event && event.type === "touchstart") {
    event.preventDefault();
  }

  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`).remove();
  }

  resetStudentUI();
}

function resetStudentUI() {
  document.getElementById("sessionId").style.display = "block";
  document.getElementById("displayName").style.display = "block";
  document.getElementById("joinBtn").style.display = "block";
  document.getElementById("exitBtn").style.display = "none";

  document.getElementById("status").textContent = "In attesa…";
  document.getElementById("gameContainer").style.display = "none";

  currentSessionId = null;
  studentId = null;
  hasJoined = false;
}

function startGame() {
  document.getElementById("gameContainer").style.display = "block";

  const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    parent: "gameContainer",
    scene: {
      preload: preload,
      create: create,
      update: update
    }
  };

  new Phaser.Game(config);
}

// Placeholder per il tuo gioco reale
function preload() {}
function create() {}
function update() {}

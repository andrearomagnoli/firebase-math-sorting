// Variabili globali
let currentSessionId = null;
let studentId = null;

// Inizializzazione Firebase (usa la tua configurazione)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Event listeners per mobile e desktop
document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("joinBtn");
  const exitBtn = document.getElementById("exitBtn");

  if (joinBtn) {
    joinBtn.addEventListener("click", joinSession);
    joinBtn.addEventListener("touchstart", joinSession);
  }

  if (exitBtn) {
    exitBtn.addEventListener("click", leaveSession);
    exitBtn.addEventListener("touchstart", leaveSession);
  }
});

// Funzione per entrare nella sessione
function joinSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const name = document.getElementById("displayName").value.trim();

  if (!sessionId || !name) {
    alert("Inserisci codice sessione e cognome.");
    return;
  }

  currentSessionId = sessionId;

  const playersRef = db.ref(`sessions/${sessionId}/players`);
  const newPlayer = playersRef.push({
    name: name,
    score: 0
  });

  studentId = newPlayer.key;

  // Nascondi form e mostra pulsante Esci
  document.getElementById("sessionId").style.display = "none";
  document.getElementById("displayName").style.display = "none";
  document.getElementById("joinBtn").style.display = "none";
  document.getElementById("exitBtn").style.display = "block";

  document.getElementById("status").textContent = "In attesa che il docente avvii la partita.";

  // Ascolta eliminazione sessione
  db.ref(`sessions/${sessionId}`).on("value", snap => {
    if (!snap.exists()) {
      alert("La sessione è stata chiusa dal docente.");
      leaveSession();
    }
  });

  // Ascolta avvio partita
  db.ref(`sessions/${sessionId}/status`).on("value", snap => {
    if (snap.val() === "started") {
      startGame();
    }
  });
}

// Funzione per uscire dalla sessione
function leaveSession() {
  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`).remove();
  }

  resetStudentUI();
}

// Reset UI studente
function resetStudentUI() {
  document.getElementById("sessionId").style.display = "block";
  document.getElementById("displayName").style.display = "block";
  document.getElementById("joinBtn").style.display = "block";
  document.getElementById("exitBtn").style.display = "none";

  document.getElementById("status").textContent = "In attesa…";

  document.getElementById("gameContainer").style.display = "none";

  currentSessionId = null;
  studentId = null;
}

// Avvio del gioco
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

function preload() {}
function create() {}
function update() {}

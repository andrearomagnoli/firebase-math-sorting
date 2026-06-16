// Firebase è già inizializzato in firebase-config.js
const db = firebase.database();

let currentSessionId = null;
let studentId = null;
let hasJoined = false;

let gameInstance = null;

// TIMER E PUNTEGGIO
let timeLeft = 10;
let score = 0;
let timerText = null;
let scoreText = null;

document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("joinBtn");
  const exitBtn = document.getElementById("exitBtn");

  if (joinBtn) {
    joinBtn.addEventListener("touchstart", e => { e.preventDefault(); joinSession(); }, { passive: false });
    joinBtn.addEventListener("click", joinSession);
  }

  if (exitBtn) {
    exitBtn.addEventListener("touchstart", e => { e.preventDefault(); leaveSession(); }, { passive: false });
    exitBtn.addEventListener("click", leaveSession);
  }
});


// ---------------------------------------------------------
// 1) ENTRA NELLA SESSIONE (con controllo esistenza)
// ---------------------------------------------------------
function joinSession() {
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

  // Controllo se la sessione esiste
  db.ref(`sessions/${sessionId}`).once("value").then(snap => {
    if (!snap.exists()) {
      alert("La sessione non esiste. Controlla il codice.");
      hasJoined = false;
      return;
    }

    enterSession(sessionId, name);
  });
}


// ---------------------------------------------------------
// 2) ENTRA NELLA SESSIONE (vero ingresso)
// ---------------------------------------------------------
function enterSession(sessionId, name) {
  currentSessionId = sessionId;

  const playersRef = db.ref(`sessions/${sessionId}/players`);
  const newPlayer = playersRef.push({
    name: name,
    score: 0
  });

  studentId = newPlayer.key;

  // Nascondi form
  document.getElementById("sessionId").style.display = "none";
  document.getElementById("displayName").style.display = "none";
  document.getElementById("joinBtn").style.display = "none";
  document.getElementById("exitBtn").style.display = "block";

  document.getElementById("status").textContent =
    "In attesa che il docente avvii la partita.";

  // Sessione eliminata dal docente
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


// ---------------------------------------------------------
// 3) USCITA
// ---------------------------------------------------------
function leaveSession() {
  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`).remove();
  }

  resetStudentUI();
}


// ---------------------------------------------------------
// 4) RESET UI
// ---------------------------------------------------------
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

  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
}


// ---------------------------------------------------------
// 5) AVVIO GIOCO
// ---------------------------------------------------------
function startGame() {
  const container = document.getElementById("gameContainer");
  container.style.display = "block";

  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }

  const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    parent: "gameContainer",
    backgroundColor: "#ffffff",
    scene: {
      preload: preload,
      create: create,
      update: update
    }
  };

  gameInstance = new Phaser.Game(config);
}


// ---------------------------------------------------------
// 6) FINE PARTITA
// ---------------------------------------------------------
function endGame() {
  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}/score`).set(score);
  }

  alert("Partita terminata! Punteggio: " + score);

  leaveSession();
}


// ---------------------------------------------------------
// 7) SCENA PHASER
// ---------------------------------------------------------
function preload() {}

function create() {
  timeLeft = 10;
  score = 0;

  timerText = this.add.text(20, 20, "Tempo: 10", {
    font: "24px Arial",
    fill: "#000"
  });

  scoreText = this.add.text(20, 60, "Punteggio: 0", {
    font: "24px Arial",
    fill: "#000"
  });

  this.time.addEvent({
    delay: 1000,
    callback: () => {
      timeLeft--;
      timerText.setText("Tempo: " + timeLeft);

      score += Phaser.Math.Between(1, 5);
      scoreText.setText("Punteggio: " + score);

      if (timeLeft <= 0) {
        endGame();
      }
    },
    loop: true
  });
}

function update() {}

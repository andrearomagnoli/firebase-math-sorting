// Firebase è già inizializzato in firebase-config.js
const db = firebase.database();

let currentSessionId = null;
let studentId = null;
let hasJoined = false;

let gameInstance = null;
let gameEnded = false;

// TIMER E PUNTEGGIO
let timeLeft = 10;
let score = 0;
let timerText = null;
let scoreText = null;

// Lista dei listener Firebase attivi
let firebaseListeners = [];

function addFirebaseListener(ref, event, callback) {
  ref.on(event, callback);
  firebaseListeners.push({ ref, event, callback });
}

function removeAllFirebaseListeners() {
  firebaseListeners.forEach(l => {
    l.ref.off(l.event, l.callback);
  });
  firebaseListeners = [];
}

document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("joinBtn");
  const exitBtn = document.getElementById("exitBtn");

  if (joinBtn) {
    joinBtn.addEventListener("touchstart", e => { e.preventDefault(); joinSession(); }, { passive: false });
    joinBtn.addEventListener("click", joinSession);
  }

  if (exitBtn) {
    exitBtn.addEventListener("touchstart", e => { e.preventDefault(); leaveSessionManual(); }, { passive: false });
    exitBtn.addEventListener("click", leaveSessionManual);
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

  db.ref(`sessions/${sessionId}`).once("value").then(snap => {
    if (!snap.exists()) {
      alert("La sessione non esiste. Controlla il codice.");
      hasJoined = false;
      return;
    }

    const data = snap.val();

    if (data.status === "finished") {
      alert("La sessione è terminata. Non puoi più entrare.");
      hasJoined = false;
      return;
    }

    enterSession(sessionId, name);
  });
}


// ---------------------------------------------------------
// 2) ENTRA NELLA SESSIONE
// ---------------------------------------------------------
function enterSession(sessionId, name) {
  currentSessionId = sessionId;

  const playersRef = db.ref(`sessions/${sessionId}/players`);
  const newPlayer = playersRef.push({
    name: name,
    score: 0
  });

  studentId = newPlayer.key;

  document.getElementById("sessionId").style.display = "none";
  document.getElementById("displayName").style.display = "none";
  document.getElementById("joinBtn").style.display = "none";
  document.getElementById("exitBtn").style.display = "block";

  document.getElementById("status").textContent =
    "In attesa che il docente avvii la partita.";

  // Listener: docente elimina la sessione
  addFirebaseListener(
    db.ref(`sessions/${sessionId}`),
    "value",
    snap => {
      if (!snap.exists()) {

        // Se la partita è finita, NON notificare nulla
        if (gameEnded) {
          removeAllFirebaseListeners();
          resetStudentUI();
          return;
        }

        // Se la partita NON è finita, notifica normalmente
        alert("La sessione è stata chiusa dal docente.");
        removeAllFirebaseListeners();
        resetStudentUI();
      }
    }
  );

  // Listener: docente avvia la partita
  addFirebaseListener(
    db.ref(`sessions/${sessionId}/status`),
    "value",
    snap => {
      if (snap.val() === "started") {
        startGame();
      }
    }
  );
}


// ---------------------------------------------------------
// 3) USCITA MANUALE (studente preme "Esci")
// ---------------------------------------------------------
function leaveSessionManual() {
  if (currentSessionId && studentId) {

    // 1) Rimuovi lo studente dal database
    db.ref(`sessions/${currentSessionId}/players/${studentId}`).remove()
      .then(() => {
        // 2) Solo dopo rimuovi i listener
        removeAllFirebaseListeners();
        resetStudentUI();
      });

  } else {
    // Caso raro: nessuna sessione attiva
    removeAllFirebaseListeners();
    resetStudentUI();
  }
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
  gameEnded = false;

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
  if (gameEnded) return;
  gameEnded = true;

  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}/score`)
      .set(score)
      .then(() => db.ref(`sessions/${currentSessionId}/status`).set("finished"))
      .then(() => {
        alert("Partita terminata! Punteggio: " + score);
        removeAllFirebaseListeners();
        resetStudentUI();
      });
  }
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

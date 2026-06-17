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
// 2) ENTRA NELLA SESSIONE E CARICA LE DOMANDE
// ---------------------------------------------------------
function enterSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const displayName = document.getElementById("displayName").value.trim();
  const statusEl = document.getElementById("status");

  if (!sessionId || !displayName) {
    statusEl.textContent = "Inserisci cognome e codice partita.";
    return;
  }

  currentSessionId = sessionId;
  currentUserId = "guest_" + Math.random().toString(36).substring(2, 10);

  // Registra lo studente
  db.ref(`sessions/${sessionId}/players/${currentUserId}`).set({
    name: displayName,
    score: 0
  });

  document.getElementById("exitBtn").style.display = "block";
  document.getElementById("joinBtn").style.display = "none";

  // Listener sullo stato della sessione
  db.ref(`sessions/${sessionId}/status`).on("value", snap => {
    const status = snap.val();
    statusEl.textContent = "Stato sessione: " + status;

    if (status === "started") {
      loadQuestions(sessionId, questions => {

        if (questions.length === 0) {
          alert("Nessun quesito caricato dal docente.");
          return;
        }

        // MOSTRA IL CANVAS PRIMA DI CREARE PHASER
        const container = document.getElementById("gameContainer");
        container.style.display = "block";

        // PICCOLA PAUSA PER MOBILE
        setTimeout(() => {
          startGame(questions, sessionId, currentUserId);
        }, 50);
      });
    }

    if (status === null) {
      statusEl.textContent = "Sessione terminata dal docente.";
      setTimeout(() => location.reload(), 1500);
    }
  });
}

function loadQuestions(sessionId, callback) {
  db.ref(`sessions/${sessionId}/questions`).once("value", snap => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const data = snap.val();
    const arr = Object.keys(data).map(k => data[k]);
    callback(arr);
  });
}


// ---------------------------------------------------------
// 3) USCITA MANUALE (studente preme "Esci")
// ---------------------------------------------------------
function leaveSessionManual() {
  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`)
      .remove()
      .then(() => {
        resetStudentUI();
      })
      .catch(err => {
        console.error("Errore rimozione studente:", err);
        resetStudentUI();
      });
  } else {
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
function startGame(questions, sessionId, playerId) {

  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }

  let currentIndex = 0;
  let score = 0;
  const total = questions.length;

  const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    parent: "gameContainer",
    backgroundColor: "#ffffff",
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 200 }, debug: false }
    },
    scene: { preload, create, update }
  };

  gameInstance = new Phaser.Game(config);

  let fallingText;
  let baskets = [];
  let targetBasket;

  function preload() {}

  function create() {

    // Ceste
    const uniqueBaskets = [...new Set(questions.map(q => q.basket))];
    const basketWidth = 400 / uniqueBaskets.length;

    uniqueBaskets.forEach((b, i) => {
      const rect = this.add.rectangle(
        basketWidth * i + basketWidth / 2,
        580,
        basketWidth - 10,
        40,
        0xdddddd
      );
      this.physics.add.existing(rect, true);
      rect.basketName = b;
      baskets.push(rect);

      this.add.text(rect.x - 40, 560, b, { fontSize: "14px", color: "#000" });
    });

    spawnQuestion.call(this);

    this.input.on("pointerdown", pointer => {
      if (!fallingText) return;
      fallingText.setVelocityX(pointer.x < 200 ? -150 : 150);
    });
  }

  function spawnQuestion() {
    if (currentIndex >= total) {
      endGame();
      return;
    }

    const q = questions[currentIndex];
    targetBasket = q.basket;

    fallingText = this.physics.add.text(200, 50, q.text, {
      fontSize: "20px",
      color: "#000"
    });
    fallingText.setOrigin(0.5);

    baskets.forEach(b => {
      this.physics.add.overlap(fallingText, b, () => {
        if (!fallingText.active) return;

        if (b.basketName === targetBasket) score++;

        fallingText.destroy();
        currentIndex++;
        spawnQuestion.call(this);
      });
    });
  }

  function update() {
    if (fallingText && fallingText.y > 620) {
      fallingText.destroy();
      currentIndex++;
      spawnQuestion.call(this);
    }
  }

  function endGame() {
    const finalScore = Math.max(2, Math.floor(2 + 8 * (score / total)));

    db.ref(`sessions/${sessionId}/players/${playerId}/score`).set(finalScore);

    alert("Partita terminata. Punteggio: " + finalScore);
  }
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

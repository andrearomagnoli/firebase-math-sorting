// student.js
// NON dichiarare db o auth qui. Devono arrivare da firebase-config.js.

// -------------------------
// CONTROLLI INIZIALI
// -------------------------
function firebaseReady() {
  if (typeof firebase === "undefined") return false;
  if (!firebase.apps.length) return false;
  if (typeof db === "undefined") return false;
  return true;
}

// Aspetta che Firebase sia pronto prima di tutto
document.addEventListener("DOMContentLoaded", () => {
  const check = setInterval(() => {
    if (firebaseReady()) {
      console.log("Firebase OK – student.js avviato");
      clearInterval(check);
      initStudent();
    } else {
      console.warn("Firebase non ancora pronto...");
    }
  }, 100);
});

// -------------------------
// VARIABILI GLOBALI
// -------------------------
let currentSessionId = null;
let studentId = null;
let hasJoined = false;
let gameInstance = null;

// -------------------------
// INIZIALIZZAZIONE UI
// -------------------------
function initStudent() {
  const joinBtn = document.getElementById("joinBtn");
  const exitBtn = document.getElementById("exitBtn");

  joinBtn.addEventListener("click", joinSession);
  exitBtn.addEventListener("click", leaveSession);
}

// -------------------------
// JOIN SESSIONE
// -------------------------
function joinSession() {
  if (!firebaseReady()) {
    alert("Firebase non inizializzato. Controlla firebase-config.js");
    return;
  }

  if (hasJoined) return;
  hasJoined = true;

  const sessionId = document.getElementById("sessionId").value.trim();
  const name = document.getElementById("displayName").value.trim();

  if (!sessionId || !name) {
    alert("Inserisci codice sessione e cognome.");
    hasJoined = false;
    return;
  }

  db.ref(`sessions/${sessionId}`).once("value").then(snap => {
    if (!snap.exists()) {
      alert("La sessione non esiste.");
      hasJoined = false;
      return;
    }

    enterSession(sessionId, name);
  });
}

function enterSession(sessionId, name) {
  currentSessionId = sessionId;
  studentId = "guest_" + Math.random().toString(36).substring(2, 10);

  db.ref(`sessions/${sessionId}/players/${studentId}`).set({
    name,
    score: 0
  });

  document.getElementById("joinBtn").style.display = "none";
  document.getElementById("exitBtn").style.display = "block";

  db.ref(`sessions/${sessionId}/status`).on("value", snap => {
    const status = snap.val();
    document.getElementById("status").textContent = "Stato sessione: " + status;

    if (status === "started") {
      loadQuestions(sessionId, questions => {
        if (!questions.length) {
          alert("Nessun quesito caricato.");
          return;
        }

        document.getElementById("gameContainer").style.display = "block";

        setTimeout(() => {
          startGame(questions, sessionId, studentId);
        }, 50);
      });
    }
  });
}

// -------------------------
// CARICA QUESITI
// -------------------------
function loadQuestions(sessionId, callback) {
  db.ref(`sessions/${sessionId}/questions`).once("value").then(snap => {
    if (!snap.exists()) return callback([]);
    const data = snap.val();
    callback(Object.values(data));
  });
}

// -------------------------
// USCITA
// -------------------------
function leaveSession() {
  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`).remove();
  }

  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }

  document.getElementById("gameContainer").style.display = "none";
  document.getElementById("joinBtn").style.display = "block";
  document.getElementById("exitBtn").style.display = "none";

  currentSessionId = null;
  studentId = null;
  hasJoined = false;
}

// -------------------------
// GIOCO PHASER
// -------------------------
function startGame(questions, sessionId, studentId) {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }

  let index = 0;
  let score = 0;

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

  let falling = null;
  let baskets = [];
  let target = null;

  function preload() {}

  function create() {
    const unique = [...new Set(questions.map(q => q.basket))];
    const w = 400 / unique.length;

    unique.forEach((b, i) => {
      const rect = this.add.rectangle(w * i + w / 2, 580, w - 10, 40, 0xdddddd);
      this.physics.add.existing(rect, true);
      rect.basketName = b;
      baskets.push(rect);
      this.add.text(rect.x - 40, 560, b, { fontSize: "14px", color: "#000" });
    });

    spawn.call(this);

    this.input.on("pointerdown", p => {
      if (!falling) return;
      falling.setVelocityX(p.x < 200 ? -150 : 150);
    });
  }

  function spawn() {
    if (index >= questions.length) return endGame();

    const q = questions[index];
    target = q.basket;

    falling = this.physics.add.text(200, 50, q.text, {
      fontSize: "20px",
      color: "#000"
    });
    falling.setOrigin(0.5);

    baskets.forEach(b => {
      this.physics.add.overlap(falling, b, () => {
        if (!falling.active) return;

        if (b.basketName === target) score++;

        falling.destroy();
        index++;
        spawn.call(this);
      });
    });
  }

  function update() {
    if (falling && falling.y > 620) {
      falling.destroy();
      index++;
      spawn.call(this);
    }
  }

  function endGame() {
    const finalScore = Math.max(2, Math.floor(2 + 8 * (score / questions.length)));
    db.ref(`sessions/${sessionId}/players/${studentId}/score`).set(finalScore);
    alert("Partita terminata. Punteggio: " + finalScore);
  }
}

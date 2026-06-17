// student.js
// NON dichiarare db o auth qui. Arrivano da firebase-config.js.

// Aspetta Firebase prima di partire
function waitForFirebase(callback) {
  const check = setInterval(() => {
    if (typeof firebase !== "undefined" &&
        firebase.apps.length > 0 &&
        typeof db !== "undefined") {
      clearInterval(check);
      callback();
    }
  }, 50);
}

document.addEventListener("DOMContentLoaded", () => {
  waitForFirebase(() => {
    console.log("Firebase pronto – student.js avviato");
    initStudent();
  });
});

// -------------------------
// VARIABILI GLOBALI
// -------------------------
let currentSessionId = null;
let studentId = null;
let gameInstance = null;

// -------------------------
// INIZIALIZZAZIONE UI
// -------------------------
function initStudent() {
  document.getElementById("joinBtn").addEventListener("click", joinSession);
  document.getElementById("exitBtn").addEventListener("click", leaveSession);
}

// -------------------------
// JOIN SESSIONE
// -------------------------
function joinSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const name = document.getElementById("displayName").value.trim();

  if (!sessionId || !name) {
    alert("Inserisci codice sessione e cognome.");
    return;
  }

  db.ref(`sessions/${sessionId}`).once("value").then(snap => {
    if (!snap.exists()) {
      alert("La sessione non esiste.");
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

        const container = document.getElementById("gameContainer");
        container.style.display = "block";

        // MOBILE SAFE: aspetta due frame prima di creare Phaser
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            console.log("Container size:", container.clientWidth, container.clientHeight);
            startGame(questions, sessionId, studentId);
          });
        });
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
    callback(Object.values(snap.val()));
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
    try { gameInstance.destroy(true); } catch(e){}
    gameInstance = null;
  }

  document.getElementById("gameContainer").style.display = "none";
  document.getElementById("joinBtn").style.display = "block";
  document.getElementById("exitBtn").style.display = "none";

  currentSessionId = null;
  studentId = null;
}

// -------------------------
// GIOCO PHASER (VERSIONE DEFINITIVA)
// -------------------------
function startGame(questions, sessionId, studentId) {

  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){}
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
      arcade: { gravity: { y: 180 }, debug: false }
    },

    input: {
      activePointers: 3,
      touch: true
    },

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
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
      const rect = this.add.rectangle(
        w * i + w / 2,
        580,
        w - 10,
        40,
        0xdddddd
      );
      this.physics.add.existing(rect, true);
      rect.basketName = b;
      baskets.push(rect);

      this.add.text(rect.x - 40, 560, b, {
        fontSize: "14px",
        color: "#000"
      });
    });

    spawn.call(this);

    this.input.on("pointerdown", p => {
      if (!falling || !falling.body) return;
      falling.body.setVelocityX(p.x < 200 ? -150 : 150);
    });
  }

  function spawn() {
    if (index >= questions.length) return endGame();

    const q = questions[index];
    target = q.basket;

    const scene = this;

    falling = scene.add.text(200, 50, q.text, {
      fontSize: "20px",
      color: "#000",
      align: "center",
      wordWrap: { width: 360 }
    });
    falling.setOrigin(0.5);

    scene.physics.add.existing(falling);

    falling.body.setSize(falling.width, falling.height);
    falling.body.setOffset(0, 0);

    falling.body.setVelocityY(0);
    falling.body.setBounce(0);
    falling.body.setCollideWorldBounds(false);

    baskets.forEach(b => {
      scene.physics.add.overlap(falling, b, () => {
        if (!falling.active) return;

        if (b.basketName === target) score++;

        falling.destroy();
        index++;
        spawn.call(scene);
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

    try { gameInstance.destroy(true); } catch(e){}
    gameInstance = null;
    document.getElementById("gameContainer").style.display = "none";
  }
}

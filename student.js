// student.js

// ---------- Variabili globali ----------
let currentSessionId = null;
let studentId = null;
let hasJoined = false;
let gameInstance = null;
let gameEnded = false;

// UI
const joinBtn = document.getElementById("joinBtn");
const exitBtn = document.getElementById("exitBtn");
const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");
const gameContainer = document.getElementById("gameContainer");

// Lista listener firebase per pulizia
let firebaseListeners = [];

function debug(msg) {
  console.log(msg);
  if (debugEl) {
    debugEl.style.display = "block";
    debugEl.textContent = msg;
  }
}

// Controllo che Firebase sia pronto
function ensureFirebaseReady() {
  if (typeof firebase === 'undefined' || typeof firebase.database === 'undefined') {
    statusEl.textContent = "Firebase non inizializzato. Controlla firebase-config.js.";
    debug("Firebase non inizializzato.");
    return false;
  }
  if (typeof db === 'undefined') {
    // Se firebase-config.js non ha definito db, crealo qui
    try {
      db = firebase.database();
    } catch (e) {
      statusEl.textContent = "Errore inizializzazione DB Firebase.";
      debug("Errore inizializzazione DB Firebase: " + e);
      return false;
    }
  }
  return true;
}

// Aggiunge listener e lo traccia per rimozione
function addFirebaseListener(ref, event, cb) {
  ref.on(event, cb);
  firebaseListeners.push({ ref, event, cb });
}

function removeAllFirebaseListeners() {
  firebaseListeners.forEach(l => {
    try { l.ref.off(l.event, l.cb); } catch(e){/*ignore*/ }
  });
  firebaseListeners = [];
}

// ---------- Carica quesiti ----------
function loadQuestions(sessionId, callback) {
  if (!ensureFirebaseReady()) { callback([]); return; }
  db.ref(`sessions/${sessionId}/questions`).once("value").then(snap => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val();
    const arr = Object.keys(data).map(k => data[k]);
    arr.sort((a,b) => (a.id > b.id) ? 1 : -1);
    callback(arr);
  }).catch(err => {
    console.error("Errore lettura questions:", err);
    callback([]);
  });
}

// ---------- Join / Enter session ----------
function joinSession() {
  if (!ensureFirebaseReady()) return;
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
  }).catch(err => {
    console.error("Errore controllo sessione:", err);
    alert("Errore di rete. Riprova.");
    hasJoined = false;
  });
}

function enterSession(sessionId, displayName) {
  if (!ensureFirebaseReady()) return;

  currentSessionId = sessionId;
  studentId = "guest_" + Math.random().toString(36).substring(2, 10);

  // Registra lo studente
  db.ref(`sessions/${sessionId}/players/${studentId}`).set({
    name: displayName,
    score: 0
  }).then(() => {
    statusEl.textContent = "Registrato. In attesa dell'avvio della partita...";
    debug("Registrazione completata: " + studentId);
  }).catch(err => {
    console.error("Errore registrazione player:", err);
    statusEl.textContent = "Errore registrazione.";
  });

  document.getElementById("exitBtn").style.display = "block";
  document.getElementById("joinBtn").style.display = "none";

  // Listener sullo stato della sessione
  const statusRef = db.ref(`sessions/${sessionId}/status`);
  addFirebaseListener(statusRef, "value", snap => {
    const status = snap.val();
    statusEl.textContent = "Stato sessione: " + (status || "non impostato");

    if (status === "started") {
      loadQuestions(sessionId, questions => {
        if (!questions || questions.length === 0) {
          alert("Nessun quesito caricato dal docente.");
          return;
        }
        // mostra container e avvia gioco dopo breve pausa
        gameContainer.style.display = "block";
        setTimeout(() => startGame(questions, sessionId, studentId), 60);
      });
    }

    if (status === null) {
      statusEl.textContent = "Sessione terminata dal docente.";
      setTimeout(() => location.reload(), 1500);
    }
  });
}

// ---------- Leave / Exit ----------
function leaveSessionManual() {
  if (!ensureFirebaseReady()) { resetStudentUI(); return; }

  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`)
      .remove()
      .then(() => resetStudentUI())
      .catch(err => {
        console.error("Errore rimozione studente:", err);
        resetStudentUI();
      });
  } else {
    resetStudentUI();
  }
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
  gameEnded = false;

  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){/*ignore*/ }
    gameInstance = null;
  }

  removeAllFirebaseListeners();
}

// ---------- Start game (Phaser) ----------
function startGame(questions, sessionId, playerId) {
  if (!questions || questions.length === 0) {
    alert("Nessun quesito disponibile.");
    return;
  }

  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){/*ignore*/ }
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

  let fallingText = null;
  let baskets = [];
  let targetBasket = null;

  function preload() {}

  function create() {
    const uniqueBaskets = [...new Set(questions.map(q => q.basket))];
    const basketWidth = config.width / Math.max(1, uniqueBaskets.length);

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

    this.scoreText = this.add.text(12, 12, `Punteggio: 0`, { fontSize: "16px", color: "#000" });
    this.progressText = this.add.text(12, 34, `Quesito: 0 / ${total}`, { fontSize: "14px", color: "#666" });

    spawnQuestion.call(this);

    this.input.on("pointerdown", pointer => {
      if (!fallingText || !fallingText.body) return;
      fallingText.setVelocityX(pointer.x < config.width/2 ? -150 : 150);
    });
  }

  function spawnQuestion() {
    if (currentIndex >= total) {
      endGame();
      return;
    }

    const q = questions[currentIndex];
    targetBasket = q.basket;

    const scene = gameInstance.scene.keys[Object.keys(gameInstance.scene.keys)[0]];
    fallingText = scene.add.text(config.width/2, 50, q.text, { fontSize: "20px", color: "#000", align: "center", wordWrap: { width: config.width - 40 } });
    fallingText.setOrigin(0.5);
    scene.physics.add.existing(fallingText);
    fallingText.body.setCollideWorldBounds(true);
    fallingText.body.setBounce(0);
    fallingText.body.setVelocityY(0);

    baskets.forEach(b => {
      scene.physics.add.overlap(fallingText, b, () => {
        if (!fallingText || !fallingText.active) return;

        if (b.basketName === targetBasket) {
          score++;
          scene.tweens.add({
            targets: fallingText,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0,
            duration: 250,
            onComplete: () => { if (fallingText) fallingText.destroy(); }
          });
        } else {
          scene.tweens.add({
            targets: fallingText,
            alpha: 0,
            duration: 150,
            onComplete: () => { if (fallingText) fallingText.destroy(); }
          });
        }

        currentIndex++;
        updateHUD(scene);
        scene.time.delayedCall(200, () => spawnQuestion.call(scene));
      }, null, scene);
    });

    updateHUD(gameInstance.scene.keys[Object.keys(gameInstance.scene.keys)[0]]);
  }

  function updateHUD(scene) {
    if (scene && scene.scoreText) {
      scene.scoreText.setText(`Punteggio: ${score}`);
      scene.progressText.setText(`Quesito: ${Math.min(currentIndex, total)} / ${total}`);
    }
  }

  function update() {
    if (fallingText && fallingText.y > config.height + 50) {
      try { fallingText.destroy(); } catch(e){/*ignore*/ }
      fallingText = null;
      currentIndex++;
      const scene = gameInstance.scene.keys[Object.keys(gameInstance.scene.keys)[0]];
      updateHUD(scene);
      spawnQuestion.call(scene);
    }
  }

  function endGame() {
    const finalScore = Math.max(2, Math.floor(2 + 8 * (score / total)));

    if (ensureFirebaseReady()) {
      db.ref(`sessions/${sessionId}/players/${playerId}/score`).set(finalScore).catch(err => {
        console.warn("Errore salvataggio punteggio:", err);
      });
    }

    setTimeout(() => {
      alert("Partita terminata. Punteggio: " + finalScore);
      try { gameInstance.destroy(true); } catch(e){/*ignore*/ }
      gameInstance = null;
      gameContainer.style.display = "none";
    }, 100);
  }
}

// ---------- Event listeners UI ----------
document.addEventListener("DOMContentLoaded", () => {
  if (joinBtn) {
    joinBtn.addEventListener("touchstart", e => { e.preventDefault(); joinSession(); }, { passive: false });
    joinBtn.addEventListener("click", joinSession);
  }
  if (exitBtn) {
    exitBtn.addEventListener("touchstart", e => { e.preventDefault(); leaveSessionManual(); }, { passive: false });
    exitBtn.addEventListener("click", leaveSessionManual);
  }
});

// ---------- Controllo iniziale ----------
window.addEventListener('load', () => {
  if (!ensureFirebaseReady()) {
    debug("Firebase non inizializzato. Controlla firebase-config.js.");
  } else {
    debug("Pagina pronta. Inserisci codice e cognome, poi premi Entra.");
  }
});

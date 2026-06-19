// student.js
// NON dichiarare db o auth qui. Arrivano da firebase-config-student.js.

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
    initStudent();
  });
});

// -------------------------
// VARIABILI GLOBALI
// -------------------------
let currentSessionId = null;
let studentId = null;
let gameInstance = null;
let gameFinished = false;
let gameStarted = false;

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
    alert("Inserisci codice partita e cognome.");
    return;
  }

  const playedSession = localStorage.getItem("mathSorting_sessionId");
  const hasPlayed = localStorage.getItem("mathSorting_hasPlayed");

  db.ref(`sessions/${sessionId}`).once("value").then(snap => {

    if (!snap.exists()) {
      alert("La sessione non esiste.");
      return;
    }

    const data = snap.val();
    const status = data.status || "waiting";

    if (hasPlayed === "true" && playedSession === sessionId) {

      if (status === "finished") {
        alert("Hai già partecipato a questa partita.");
        return;
      }

      if (status === "waiting") {
        localStorage.removeItem("mathSorting_sessionId");
        localStorage.removeItem("mathSorting_hasPlayed");
        enterSession(sessionId, name);
        return;
      }

      if (status === "started") {
        alert("La partita è già in corso e hai già partecipato.");
        return;
      }
    }

    if (status === "started" || status === "finished") {
      alert("La partita è già iniziata o terminata.");
      return;
    }

    enterSession(sessionId, name);
  });
}

// -------------------------
// ENTRA IN SESSIONE
// -------------------------
function enterSession(sessionId, name) {

  currentSessionId = sessionId;
  studentId = "guest_" + Math.random().toString(36).substring(2, 10);
  gameFinished = false;
  gameStarted = false;

  db.ref(`sessions/${sessionId}/players/${studentId}`).set({
    name,
    score: 0,
    leftEarly: false
  });

  db.ref(`sessions/${sessionId}/players/${studentId}`).onDisconnect().update({
    leftEarly: true
  });

  document.getElementById("joinBtn").style.display = "none";
  document.getElementById("exitBtn").style.display = "block";

  db.ref(`sessions/${sessionId}/status`).on("value", snap => {
    const status = snap.val();
    document.getElementById("status").textContent = "Stato sessione: " + status;

    if (status === "started") {
      gameStarted = true;

      document.getElementById("loginCard").style.display = "none";
      document.getElementById("exitBtn").style.display = "none";

      const titleEl = document.getElementById("title");
      if (titleEl) titleEl.style.display = "none";

      loadQuestions(sessionId, questions => {
        if (!questions.length) {
          alert("Nessun quesito caricato.");
          return;
        }

        document.getElementById("gameContainer").style.display = "block";

        requestAnimationFrame(() => {
          startGame(questions, sessionId, studentId);
        });
      });
    }

    if (status === "finished" && !gameFinished) {
      endGameForced();
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

  if (!gameStarted) {
    if (currentSessionId && studentId) {
      db.ref(`sessions/${currentSessionId}/players/${studentId}`).remove();
    }
    resetUI();
    return;
  }

  if (gameStarted && !gameFinished) {
    return;
  }

  if (currentSessionId && studentId) {
    db.ref(`sessions/${currentSessionId}/players/${studentId}`).update({
      leftEarly: false
    });
  }

  resetUI();
}

// -------------------------
// RESET UI
// -------------------------
function resetUI() {
  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){}
    gameInstance = null;
  }

  const titleEl = document.getElementById("title");
  if (titleEl) titleEl.style.display = "block";

  document.getElementById("gameContainer").style.display = "none";
  document.getElementById("loginCard").style.display = "block";
  document.getElementById("joinBtn").style.display = "block";
  document.getElementById("exitBtn").style.display = "none";

  currentSessionId = null;
  studentId = null;
  gameFinished = false;
  gameStarted = false;
}

// -------------------------
// FINE PARTITA FORZATA
// -------------------------
function endGameForced() {
  gameFinished = true;

  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e) {}
    gameInstance = null;
  }

  alert("La partita è stata terminata dal docente.");
  resetUI();
}

// -------------------------
// GIOCO PHASER
// -------------------------
function startGame(questions, sessionId, studentId) {

  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){}
    gameInstance = null;
  }

  // Shuffle dei quesiti
  questions = shuffle(questions);

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
      arcade: { gravity: { y: 0 }, debug: false }
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

  // Progress bar
  let progressBar = null;
  let progressFillGreen = null;
  let progressFillRed = null;

  let totalQuestions = questions.length;
  let correctCount = 0;
  let wrongCount = 0;

  function preload() {}

  function create() {

    // Sfondo
    progressBar = this.add.graphics();
    progressBar.fillStyle(0xcccccc, 1);
    progressBar.fillRect(20, 14, 360, 12);

    // Verde
    progressGreen = this.add.graphics();

    // Rosso
    progressRed = this.add.graphics();

    const unique = [...new Set(questions.map(q => q.basket))];
    const w = 400 / unique.length;

    unique.forEach((b, i) => {
      const rect = this.add.rectangle(
        w * i + w / 2,
        580,
        w - 10,
        60,
        0xdddddd
      );
      this.physics.add.existing(rect, true);
      rect.basketName = b;
      baskets.push(rect);

      const label = this.add.text(
        rect.x,
        560,
        b,
        {
          fontSize: "16px",
          color: "#000",
          align: "center",
          wordWrap: { width: w - 20 }
        }
      );
      label.setOrigin(0.5);

      while (label.height > 50) {
        let size = parseInt(label.style.fontSize);
        label.setFontSize((size - 1) + "px");
      }

      rect.label = label;
    });

    spawn.call(this);

    this.input.on("pointerdown", p => {
      if (!falling || !falling.body) return;

      falling.wasTouched = true;

      const lateralSpeed = 200;

      if (p.x < 200) {
        falling.body.setVelocityX(-lateralSpeed);
      } else {
        falling.body.setVelocityX(lateralSpeed);
      }

      falling.body.setVelocityY(falling.fallSpeed);
    });

    this.input.on("pointerup", () => {
      if (!falling || !falling.body) return;
      falling.body.setVelocityX(0);
    });
  }

  // -------------------------
  // BARRA DI AVANZAMENTO
  // -------------------------
  function updateProgress(isCorrect) {

    if (isCorrect) correctCount++;
    else wrongCount++;

    const greenWidth = 360 * (correctCount / totalQuestions);
    const redWidth   = 360 * (wrongCount   / totalQuestions);

    // Pulisci e ridisegna
    progressGreen.clear();
    progressRed.clear();

    // Verde da sinistra
    progressGreen.fillStyle(0x4caf50, 1);
    progressGreen.fillRect(20, 14, greenWidth, 12);

    // Rosso da destra
    progressRed.fillStyle(0xff5252, 1);
    progressRed.fillRect(380 - redWidth, 14, redWidth, 12);
  }

  // -------------------------
  // CREA NUOVO OGGETTO
  // -------------------------
  function spawn() {
    if (index >= questions.length) return endGame();

    const q = questions[index];
    target = q.basket;

    const scene = this;

    falling = scene.add.text(
      200,
      50,
      q.text,
      {
        fontSize: "20px",
        color: "#000",
        align: "center",
        wordWrap: { width: 360 }
      }
    );
    falling.setOrigin(0.5);

    scene.physics.add.existing(falling);

    falling.body.setSize(falling.width, falling.height);
    falling.body.setOffset(0, 0);

    falling.body.setBounce(0);
    falling.body.setCollideWorldBounds(false);

    falling.wasTouched = false;

    const spawnY = 50;
    const basketY = 580;
    const fallDistance = basketY - spawnY;
    const fallTime = 6000;
    const fallSpeed = fallDistance / (fallTime / 1000);

    falling.fallSpeed = fallSpeed;
    falling.body.setVelocityY(fallSpeed);
    falling.body.setVelocityX(0);

    // MARKER (puntino) con fisica
    const marker = scene.add.circle(
      falling.x,
      falling.y + falling.height / 2 + 5,
      4,
      0x000000
    );
    marker.setDepth(10);
    falling.marker = marker;

    scene.physics.add.existing(marker);
    marker.body.setAllowGravity(false);
    marker.body.setImmovable(true);
    marker.body.setCircle(4);
    marker.body.setOffset(-4, -4);

    baskets.forEach(b => {
      scene.physics.add.overlap(falling.marker, b, () => {

        if (!falling.active) return;
        falling.active = false;

        falling.body.checkCollision.none = true;
        falling.marker.body.checkCollision.none = true;

        const isCorrect = (b.basketName === target);

        if (isCorrect) {
          score++;
          updateProgress(true);

          // ANIMAZIONE CORRETTO
          scene.tweens.add({
            targets: b,
            scaleX: 1.15,
            scaleY: 1.15,
            yoyo: true,
            duration: 150,
            ease: 'Power2'
          });

        } else {
          updateProgress(false);

          // ANIMAZIONE SBAGLIATO (shake)
          scene.tweens.add({
            targets: b,
            x: b.x + 8,
            yoyo: true,
            repeat: 2,
            duration: 60,
            ease: 'Power2'
          });
        }

        falling.marker.destroy();
        falling.destroy();
        index++;
        spawn.call(scene);
      });
    });
  }

  // -------------------------
  // UPDATE
  // -------------------------
  function update() {
    if (falling) {

      if (falling.marker) {

        const clampedX = Phaser.Math.Clamp(
          falling.x,
          5,
          395
        );

        falling.marker.x = clampedX;
        falling.marker.y = falling.y + falling.height / 2 + 5;

        if (clampedX !== falling.x) {
          falling.x = clampedX;
          falling.body.setVelocityX(0);
        }
      }

      if (falling.y > 620) {

        if (!falling.active) return;
        falling.active = false;
        falling.body.checkCollision.none = true;

        updateProgress(false);

        if (falling.marker) falling.marker.destroy();
        falling.destroy();
        index++;
        spawn.call(this);
      }
    }
  }

  // -------------------------
  // FINE PARTITA
  // -------------------------
  function endGame() {
    gameFinished = true;

    const finalScore = Math.max(2, Math.floor(2 + 8 * (score / questions.length)));

    db.ref(`sessions/${sessionId}/players/${studentId}`).update({
      score: finalScore,
      leftEarly: false
    });

    localStorage.setItem("mathSorting_sessionId", sessionId);
    localStorage.setItem("mathSorting_hasPlayed", "true");

    alert("Partita terminata. Punteggio: " + finalScore);

    resetUI();
  }
}

// -------------------------
// SHUFFLE
// -------------------------
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// student.js

// ---------- Variabili globali ----------
let currentSessionId = null;
let currentUserId = null;
let gameInstance = null;

// Elementi UI
const joinBtn = document.getElementById("joinBtn");
const exitBtn = document.getElementById("exitBtn");
const statusEl = document.getElementById("status");
const debugEl = document.getElementById("debug");
const gameContainer = document.getElementById("gameContainer");

// Debug helper
function debug(msg) {
  console.log(msg);
  if (debugEl) {
    debugEl.style.display = "block";
    debugEl.textContent = msg;
  }
}

// ---------- Funzione per caricare i quesiti ----------
function loadQuestions(sessionId, callback) {
  db.ref(`sessions/${sessionId}/questions`).once("value", snap => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const data = snap.val();
    const arr = Object.keys(data).map(k => data[k]);
    // Ordina per id per stabilità (opzionale)
    arr.sort((a, b) => (a.id > b.id ? 1 : -1));
    callback(arr);
  }, err => {
    console.error("Errore lettura questions:", err);
    callback([]);
  });
}

// ---------- enterSession ----------
function enterSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const displayName = document.getElementById("displayName").value.trim();

  if (!sessionId || !displayName) {
    statusEl.textContent = "Inserisci cognome e codice partita.";
    return;
  }

  currentSessionId = sessionId;
  currentUserId = "guest_" + Math.random().toString(36).substring(2, 10);

  // Registra lo studente nella sessione
  db.ref(`sessions/${currentSessionId}/players/${currentUserId}`).set({
    name: displayName,
    score: 0
  }).then(() => {
    statusEl.textContent = "Registrato. In attesa dell'avvio della partita...";
    debug("Registrazione completata: " + currentUserId);
  }).catch(err => {
    console.error("Errore registrazione player:", err);
    statusEl.textContent = "Errore registrazione.";
  });

  exitBtn.style.display = "block";
  joinBtn.style.display = "none";

  // Listener sullo stato della sessione
  db.ref(`sessions/${currentSessionId}/status`).on("value", snap => {
    const status = snap.val();
    statusEl.textContent = "Stato sessione: " + (status || "non impostato");

    if (status === "started") {
      // Carica i quesiti e avvia il gioco
      loadQuestions(currentSessionId, questions => {
        if (!questions || questions.length === 0) {
          alert("Nessun quesito caricato dal docente.");
          return;
        }

        // Mostra il contenitore del gioco PRIMA di creare Phaser
        gameContainer.style.display = "block";

        // Piccola pausa per assicurare il layout su mobile
        setTimeout(() => {
          startGame(questions, currentSessionId, currentUserId);
        }, 60);
      });
    }

    if (status === null) {
      statusEl.textContent = "Sessione terminata dal docente.";
      setTimeout(() => location.reload(), 1500);
    }
  });
}

// ---------- exitSession ----------
function exitSession() {
  if (currentSessionId && currentUserId) {
    db.ref(`sessions/${currentSessionId}/players/${currentUserId}`).remove().catch(err => {
      console.warn("Errore rimozione player:", err);
    });
  }
  // distruggi gioco se attivo
  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){/*ignore*/ }
    gameInstance = null;
  }
  // reset UI
  gameContainer.style.display = "none";
  joinBtn.style.display = "block";
  exitBtn.style.display = "none";
  statusEl.textContent = "Sei uscito.";
}

// ---------- startGame (Phaser) ----------
function startGame(questions, sessionId, playerId) {

  // distruggi eventuale istanza precedente
  if (gameInstance) {
    try { gameInstance.destroy(true); } catch(e){/*ignore*/ }
    gameInstance = null;
  }

  // Parametri di gioco
  let currentIndex = 0;
  let score = 0;
  const total = questions.length;

  // Config responsive: usa 400x600 come base, ma il canvas si adatterà al contenitore
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

  // Variabili di scena
  let fallingObj = null;
  let baskets = [];
  let targetBasket = null;

  function preload() {
    // nessun asset esterno
  }

  function create() {
    // sfondo semplice
    this.cameras.main.setBackgroundColor('#ffffff');

    // crea ceste in basso in base alle categorie trovate
    const uniqueBaskets = [...new Set(questions.map(q => q.basket))];
    const basketCount = Math.max(1, uniqueBaskets.length);
    const basketWidth = config.width / basketCount;

    baskets = [];

    uniqueBaskets.forEach((b, i) => {
      const x = basketWidth * i + basketWidth / 2;
      const rect = this.add.rectangle(x, 560, basketWidth - 12, 60, 0xeeeeee);
      rect.setStrokeStyle(2, 0x999999);
      this.physics.add.existing(rect, true); // corpo statico
      rect.basketName = b;
      baskets.push(rect);

      // label
      this.add.text(x - (basketWidth/2 - 8), 540, b, { fontSize: "14px", color: "#000" });
    });

    // HUD: punteggio e progresso
    this.scoreText = this.add.text(12, 12, `Punteggio: 0`, { fontSize: "16px", color: "#000" });
    this.progressText = this.add.text(12, 34, `Quesito: 0 / ${total}`, { fontSize: "14px", color: "#666" });

    // spawn primo quesito
    spawnQuestion.call(this);

    // touch / click: tocca sinistra o destra per spostare l'oggetto
    this.input.on('pointerdown', pointer => {
      if (!fallingObj || !fallingObj.body) return;
      const mid = config.width / 2;
      const vx = (pointer.x < mid) ? -180 : 180;
      fallingObj.body.setVelocityX(vx);
    });
  }

  function spawnQuestion() {
    if (currentIndex >= total) {
      endGame();
      return;
    }

    const q = questions[currentIndex];
    targetBasket = q.basket;

    // crea testo come oggetto e abilita fisica
    const scene = gameInstance.scene.keys[Object.keys(gameInstance.scene.keys)[0]];
    fallingObj = scene.add.text(config.width/2, 40, q.text, {
      fontSize: "20px",
      color: "#000",
      align: "center",
      wordWrap: { width: config.width - 40 }
    });
    fallingObj.setOrigin(0.5);
    scene.physics.add.existing(fallingObj);
    fallingObj.body.setCollideWorldBounds(true);
    fallingObj.body.setBounce(0);
    fallingObj.body.setVelocityY(0); // gravity lo farà scendere

    // collisioni con ceste
    baskets.forEach(b => {
      scene.physics.add.overlap(fallingObj, b, () => {
        if (!fallingObj || !fallingObj.active) return;

        // controllo basket
        if (b.basketName === targetBasket) {
          score++;
          scene.tweens.add({
            targets: fallingObj,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0,
            duration: 250,
            onComplete: () => {
              if (fallingObj) fallingObj.destroy();
            }
          });
        } else {
          // animazione errore (semplice fade)
          scene.tweens.add({
            targets: fallingObj,
            alpha: 0,
            duration: 150,
            onComplete: () => {
              if (fallingObj) fallingObj.destroy();
            }
          });
        }

        // aggiorna indice e spawn prossimo
        currentIndex++;
        updateHUD(scene);
        // piccolo delay per dare tempo all'animazione
        scene.time.delayedCall(200, () => spawnQuestion.call(scene));
      }, null, scene);
    });

    updateHUD(scene);
  }

  function updateHUD(scene) {
    if (scene && scene.scoreText) {
      scene.scoreText.setText(`Punteggio: ${score}`);
      scene.progressText.setText(`Quesito: ${Math.min(currentIndex, total)} / ${total}`);
    }
  }

  function update() {
    // se l'oggetto cade oltre il fondo senza entrare in una cesta
    if (fallingObj && fallingObj.y > config.height + 50) {
      try { fallingObj.destroy(); } catch(e){/*ignore*/ }
      fallingObj = null;
      currentIndex++;
      const scene = gameInstance.scene.keys[Object.keys(gameInstance.scene.keys)[0]];
      updateHUD(scene);
      spawnQuestion.call(scene);
    }
  }

  function endGame() {
    // calcolo punteggio proporzionale tra 2 e 10
    const finalScore = Math.max(2, Math.floor(2 + 8 * (score / total)));

    // salva su Firebase
    db.ref(`sessions/${sessionId}/players/${playerId}/score`).set(finalScore).catch(err => {
      console.warn("Errore salvataggio punteggio:", err);
    });

    // mostra risultato e distruggi gioco
    setTimeout(() => {
      alert("Partita terminata. Punteggio: " + finalScore);
      try { gameInstance.destroy(true); } catch(e){/*ignore*/ }
      gameInstance = null;
      gameContainer.style.display = "none";
    }, 100);
  }
}

// ---------- Event listeners UI ----------
joinBtn.addEventListener("click", () => {
  try {
    enterSession();
  } catch (err) {
    console.error("Errore enterSession:", err);
    statusEl.textContent = "Errore interno. Controlla console.";
  }
});

exitBtn.addEventListener("click", () => {
  exitSession();
});

// ---------- Controllo iniziale ----------
window.addEventListener('load', () => {
  if (typeof firebase === 'undefined' || typeof db === 'undefined') {
    statusEl.textContent = "Firebase non inizializzato. Controlla la configurazione in firebase-config.js.";
    debug("Firebase non inizializzato.");
  } else {
    debug("Pagina pronta. Inserisci codice e cognome, poi premi Entra.");
  }
});

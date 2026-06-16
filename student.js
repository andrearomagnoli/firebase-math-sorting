// =====================================
// Variabili globali
// =====================================

const db = firebase.database();

let currentSessionId = null;
let currentUserId = null;
let currentDisplayName = null;

// =====================================
// Entrata nella sessione (senza login)
// =====================================

function joinSession() {
  const sessionId = document.getElementById("sessionId").value.trim();
  const displayName = document.getElementById("displayName").value.trim();
  const statusEl = document.getElementById("status");

  if (!sessionId || !displayName) {
    statusEl.textContent = "Inserisci cognome e codice partita.";
    return;
  }

  currentSessionId = sessionId;
  currentDisplayName = displayName;

  // 🔥 Genera ID persistente per lo studente
  if (!localStorage.getItem("studentId")) {
    localStorage.setItem("studentId", "guest_" + Math.random().toString(36).substring(2, 10));
  }

  currentUserId = localStorage.getItem("studentId");

  // 🔥 Registra lo studente nella sessione
  db.ref(`sessions/${currentSessionId}/players/${currentUserId}`).set({
    displayName: currentDisplayName,
    status: "waiting",
    score: 0
  });

  // 🔥 Ascolta lo stato della sessione
  db.ref(`sessions/${currentSessionId}/status`).on("value", snap => {
    const status = snap.val();
    statusEl.textContent = "Stato sessione: " + status;

    if (status === "running") {
      startGame();
    }
  });
}

// =====================================
// Avvio del gioco
// =====================================

function startGame() {
  const container = document.getElementById("gameContainer");
  container.style.display = "block";

  db.ref(`sessions/${currentSessionId}/questions`).once("value").then(snap => {
    const questions = snap.val() || {};

    runGame(questions, (finalScore) => {
      endGame(finalScore);
    });
  });
}

// =====================================
// Placeholder del gioco (da sostituire con Phaser)
// =====================================

function runGame(questions, callbackEnd) {
  const container = document.getElementById("gameContainer");

  container.innerHTML = `
    <div style="padding:20px; font-size:20px;">
      Gioco in esecuzione...
      <br><br>
      <span id="timer"></span><br>
      <span id="score"></span>
    </div>
  `;

  let score = 0;
  let time = 10;

  const timerEl = document.getElementById("timer");
  const scoreEl = document.getElementById("score");

  const interval = setInterval(() => {
    time--;
    score += Math.floor(Math.random() * 3);

    timerEl.textContent = "Tempo: " + time;
    scoreEl.textContent = "Punteggio: " + score;

    if (time <= 0) {
      clearInterval(interval);
      callbackEnd(score);
    }
  }, 1000);
}

// =====================================
// Fine partita
// =====================================

function endGame(score) {
  db.ref(`sessions/${currentSessionId}/players/${currentUserId}/score`).set(score);
  db.ref(`sessions/${currentSessionId}/players/${currentUserId}/status`).set("finished");

  const container = document.getElementById("gameContainer");
  container.innerHTML = `
    <div style="padding:20px; font-size:20px;">
      Partita terminata!<br><br>
      Punteggio finale: ${score}
    </div>
  `;
}
// =====================================
// Variabili globali
// =====================================

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

  // Genera ID stabile per lo studente (persistente nel browser)
  if (!localStorage.getItem("studentId")) {
    localStorage.setItem("studentId", "guest_" + Math.random().toString(36).substring(2, 10));
  }

  currentUserId = localStorage.getItem("studentId");

  // Registra lo studente nella sessione
  db.ref(`sessions/${currentSessionId}/players/${currentUserId}`).set({
    displayName: currentDisplayName,
    status: "waiting",
    score: 0
  });

  // Ascolta lo stato della sessione
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
  const canvas = document.getElementById("gameCanvas");
  canvas.style.display = "block";

  db.ref(`sessions/${currentSessionId}/questions`).once("value").then(snap => {
    const questions = snap.val() || {};

    runGame(questions, (finalScore) => {
      endGame(finalScore);
    });
  });
}

// =====================================
// Placeholder del gioco
// =====================================

function runGame(questions, callbackEnd) {
  const ctx = document.getElementById("gameCanvas").getContext("2d");

  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText("Gioco in esecuzione...", 80, 300);

  let score = 0;
  let time = 10;

  const interval = setInterval(() => {
    time--;

    ctx.clearRect(0, 0, 400, 600);
    ctx.fillText("Gioco in esecuzione...", 80, 300);
    ctx.fillText("Tempo: " + time, 150, 350);
    ctx.fillText("Punteggio: " + score, 150, 380);

    score += Math.floor(Math.random() * 3);

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

  const ctx = document.getElementById("gameCanvas").getContext("2d");
  ctx.clearRect(0, 0, 400, 600);
  ctx.fillText("Partita terminata!", 120, 300);
  ctx.fillText("Punteggio finale: " + score, 120, 340);
}

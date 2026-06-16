// =========================
// Variabili globali
// =========================

let currentSessionId = null;
let sessionCode = null;

// =========================
// Sessione (gestione login/logout + UI)
// =========================

auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("teacherPanel").style.display = "none";
    return;
  }

  const uid = user.uid;

  db.ref("teachers/" + uid).once("value").then(snap => {
    if (!snap.exists()) {
      auth.signOut();
      return;
    }

    document.getElementById("loginForm").style.display = "none";
    document.getElementById("teacherPanel").style.display = "block";

    showAdminPanel();

    db.ref("teachers/" + uid + "/currentSession").once("value").then(snap => {
      const savedSession = snap.val();
      if (savedSession) {
        currentSessionId = savedSession;
        loadLobby();
      }
    });
  });
});

// =========================
// Login docente
// =========================

function loginTeacher() {
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const errorEl = document.getElementById("loginError");

  errorEl.textContent = "";

  if (!email || !pass) {
    errorEl.textContent = "Inserisci email e password.";
    return;
  }

  auth.signInWithEmailAndPassword(email, pass)
    .catch(err => {
      errorEl.textContent = err.message;
    });
}

// =========================
// Creazione / selezione sessione
// =========================

function createSession() {
  const sessionIdInput = document.getElementById("sessionId");
  const sessionStatusEl = document.getElementById("sessionStatus");
  const sessionId = sessionIdInput.value.trim();

  if (!sessionId) {
    sessionStatusEl.textContent = "Inserisci un ID sessione.";
    return;
  }

  currentSessionId = sessionId;
  const uid = auth.currentUser.uid;

  const ref = db.ref("sessions/" + currentSessionId);

  ref.set({
    status: "waiting",
    teacherId: uid
  })
  .then(() => {
    return db.ref("teachers/" + uid + "/currentSession").set(currentSessionId);
  })
  .then(() => {
    sessionStatusEl.textContent = "Sessione creata: " + currentSessionId;
    watchLobby();
    watchScores();
  })
  .catch(err => {
    console.error(err);
    sessionStatusEl.textContent = "Errore nella creazione della sessione: " + err.message;
  });
}

// =========================
// Upload Excel
// =========================

function uploadExcel() {
  const excelStatusEl = document.getElementById("excelStatus");
  excelStatusEl.textContent = "";

  if (!currentSessionId) {
    excelStatusEl.textContent = "Crea prima una sessione.";
    return;
  }

  const fileInput = document.getElementById("excelFile");
  const file = fileInput.files[0];

  if (!file) {
    excelStatusEl.textContent = "Seleziona un file Excel (.xlsx).";
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!rows || rows.length === 0) {
        excelStatusEl.textContent = "Il file Excel è vuoto o non leggibile.";
        return;
      }

      const questionsRef = db.ref("sessions/" + currentSessionId + "/questions");
      const updates = {};

      rows.forEach(row => {
        const id = row.ID_Quesito;
        const text = row.Testo;
        const bucket = row.Cesta;
        const correctAnswer = row.RispostaCorretta || null;

        if (!id || !text || !bucket) return;

        updates[id] = {
          text: text,
          bucket: bucket,
          correctAnswer: correctAnswer
        };
      });

      questionsRef.set(updates)
        .then(() => {
          excelStatusEl.textContent = "Quesiti caricati correttamente.";
        })
        .catch(err => {
          console.error(err);
          excelStatusEl.textContent = "Errore nel salvataggio dei quesiti: " + err.message;
        });

    } catch (err) {
      console.error(err);
      excelStatusEl.textContent = "Errore nella lettura del file Excel.";
    }
  };

  reader.onerror = () => {
    excelStatusEl.textContent = "Errore nella lettura del file.";
  };

  reader.readAsArrayBuffer(file);
}

// =========================
// Lobby
// =========================

function loadLobby() {
  if (currentSessionId) {
    watchLobby();
    watchScores();
  }
}

function watchLobby() {
  const playersListEl = document.getElementById("playersList");

  if (!currentSessionId) return;

  const playersRef = db.ref("sessions/" + currentSessionId + "/players");

  playersRef.on("value", snap => {
    const players = snap.val() || {};
    const entries = Object.entries(players);

    if (entries.length === 0) {
      playersListEl.innerHTML = "Nessuno studente collegato";
      return;
    }

    let html = "<ul>";
    entries.forEach(([uid, player]) => {
      const name = player.displayName || uid;
      const status = player.status || "unknown";
      html += `<li>${name} – stato: ${status}</li>`;
    });
    html += "</ul>";

    playersListEl.innerHTML = html;
  });
}

// =========================
// Avvio partita
// =========================

function startSession() {
  const sessionStatusEl = document.getElementById("sessionStatus");

  if (!currentSessionId) {
    sessionStatusEl.textContent = "Crea prima una sessione.";
    return;
  }

  db.ref("sessions/" + currentSessionId + "/status").set("running")
    .then(() => {
      sessionStatusEl.textContent = "Partita avviata.";
    })
    .catch(err => {
      console.error(err);
      sessionStatusEl.textContent = "Errore nell'avvio della partita: " + err.message;
    });
}

// =========================
// Punteggi
// =========================

function watchScores() {
  const scoresEl = document.getElementById("scores");

  if (!currentSessionId) return;

  const playersRef = db.ref("sessions/" + currentSessionId + "/players");

  playersRef.on("value", snap => {
    const players = snap.val() || {};
    const entries = Object.entries(players);

    if (entries.length === 0) {
      scoresEl.innerHTML = "Nessun punteggio ancora";
      return;
    }

    entries.sort((a, b) => {
      const scoreA = a[1].score || 0;
      const scoreB = b[1].score || 0;
      return scoreB - scoreA;
    });

    let html = "<ol>";
    entries.forEach(([uid, player]) => {
      const name = player.displayName || uid;
      const score = player.score || 0;
      html += `<li>${name}: ${score} punti</li>`;
    });
    html += "</ol>";

    scoresEl.innerHTML = html;
  });
}

// =========================
// Admin
// =========================

function showAdminPanel() {
  document.getElementById("adminPanel").style.display = "block";

  db.ref("pendingTeachers").on("value", snap => {
    const data = snap.val() || {};
    const table = document.getElementById("pendingTable");
    table.innerHTML = "";

    Object.keys(data).forEach(uid => {
      const teacher = data[uid];

      if (!teacher.email || teacher.email === "undefined") return;

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${teacher.email}</td>
        <td>${uid}</td>
        <td>
          <button onclick="approveTeacher('${uid}')">Approva</button>
          <button onclick="rejectTeacher('${uid}')">Rifiuta</button>
        </td>
      `;

      table.appendChild(row);
    });
  });
}

function approveTeacher(uid) {
  db.ref("pendingTeachers/" + uid).once("value")
    .then(snap => {
      const data = snap.val();
      if (!data) return;

      return db.ref("teachers/" + uid).set({
        email: data.email
      });
    })
    .then(() => {
      return db.ref("pendingTeachers/" + uid).remove();
    })
    .catch(err => console.error(err));
}

function rejectTeacher(uid) {
  db.ref("pendingTeachers/" + uid).remove();
}

// =========================
// Logout
// =========================

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});

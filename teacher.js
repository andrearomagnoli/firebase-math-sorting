// =====================================
// Variabili globali
// =====================================

let currentSessionId = null;

// =====================================
// Login / Logout docente
// =====================================

auth.onAuthStateChanged(user => {
  if (!user) {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("teacherPanel").style.display = "none";
    return;
  }

  const uid = user.uid;

  // Verifica che sia un docente approvato
  db.ref("teachers/" + uid).once("value").then(snap => {
    if (!snap.exists()) {
      auth.signOut();
      return;
    }

    // Mostra UI docente
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("teacherPanel").style.display = "block";

    // Mostra pannello admin
    showAdminPanel();

    // 🔥 Ripristina sessione associata al docente
    db.ref("teacherSessions/" + uid).once("value").then(snap => {
      if (snap.exists()) {
        currentSessionId = snap.val().sessionId;
        localStorage.setItem("currentSessionId", currentSessionId);
        loadLobby();
      }
    });
  });
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("currentSessionId");
  auth.signOut();
});

// =====================================
// Login docente
// =====================================

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

// =====================================
// Creazione sessione (una sola per docente)
// =====================================

function createSession() {
  const sessionIdInput = document.getElementById("sessionId");
  const sessionStatusEl = document.getElementById("sessionStatus");
  const sessionId = sessionIdInput.value.trim();

  if (!sessionId) {
    sessionStatusEl.textContent = "Inserisci un ID sessione.";
    return;
  }

  const uid = auth.currentUser.uid;

  // 🔥 Controlla se esiste già una sessione per questo docente
  db.ref("teacherSessions/" + uid).once("value").then(snap => {
    if (snap.exists()) {
      sessionStatusEl.textContent = "Hai già una sessione attiva: " + snap.val().sessionId;
      return;
    }

    // 🔥 Crea la sessione
    db.ref("sessions/" + sessionId).set({
      status: "waiting",
      teacherId: uid
    })
    .then(() => {
      // 🔥 Salva la sessione associata al docente
      return db.ref("teacherSessions/" + uid).set({
        sessionId: sessionId
      });
    })
    .then(() => {
      currentSessionId = sessionId;
      localStorage.setItem("currentSessionId", sessionId);
      sessionStatusEl.textContent = "Sessione creata: " + sessionId;
      loadLobby();
    });
  });
}

// =====================================
// Eliminazione sessione
// =====================================

function deleteSession() {
  const uid = auth.currentUser.uid;

  if (!currentSessionId) return;

  db.ref("sessions/" + currentSessionId).remove()
    .then(() => db.ref("teacherSessions/" + uid).remove())
    .then(() => {
      localStorage.removeItem("currentSessionId");
      currentSessionId = null;

      document.getElementById("playersList").innerHTML = "";
      document.getElementById("scores").innerHTML = "";
      document.getElementById("sessionStatus").textContent = "Sessione chiusa.";
    });
}

// =====================================
// Upload Excel
// =====================================

function uploadExcel() {
  const excelStatusEl = document.getElementById("excelStatus");
  excelStatusEl.textContent = "";

  if (!currentSessionId) {
    excelStatusEl.textContent = "Crea prima una sessione.";
    return;
  }

  const file = document.getElementById("excelFile").files[0];
  if (!file) {
    excelStatusEl.textContent = "Seleziona un file Excel.";
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const updates = {};

      rows.forEach(row => {
        if (!row.ID_Quesito || !row.Testo || !row.Cesta) return;

        updates[row.ID_Quesito] = {
          text: row.Testo,
          bucket: row.Cesta,
          correctAnswer: row.RispostaCorretta || null
        };
      });

      db.ref(`sessions/${currentSessionId}/questions`).set(updates)
        .then(() => excelStatusEl.textContent = "Quesiti caricati.")
        .catch(err => excelStatusEl.textContent = "Errore: " + err.message);

    } catch (err) {
      excelStatusEl.textContent = "Errore nella lettura del file.";
    }
  };

  reader.readAsArrayBuffer(file);
}

// =====================================
// Lobby
// =====================================

function loadLobby() {
  if (!currentSessionId) return;
  watchLobby();
  watchScores();
}

function watchLobby() {
  const playersListEl = document.getElementById("playersList");

  const ref = db.ref(`sessions/${currentSessionId}/players`);

  ref.on("value", snap => {
    const players = snap.val() || {};

    const entries = Object.entries(players);

    if (entries.length === 0) {
      playersListEl.innerHTML = "Nessuno studente collegato";
      return;
    }

    let html = "<ul>";
    entries.forEach(([uid, p]) => {
      html += `<li>${p.displayName} – ${p.status}</li>`;
    });
    html += "</ul>";

    playersListEl.innerHTML = html;
  });
}

// =====================================
// Avvio partita
// =====================================

function startSession() {
  if (!currentSessionId) return;

  db.ref(`sessions/${currentSessionId}/status`).set("running");
}

// =====================================
// Punteggi
// =====================================

function watchScores() {
  const scoresEl = document.getElementById("scores");

  const ref = db.ref(`sessions/${currentSessionId}/players`);

  ref.on("value", snap => {
    const players = snap.val() || {};

    const entries = Object.entries(players);

    if (entries.length === 0) {
      scoresEl.innerHTML = "Nessun punteggio ancora";
      return;
    }

    entries.sort((a, b) => (b[1].score || 0) - (a[1].score || 0));

    let html = "<ol>";
    entries.forEach(([uid, p]) => {
      html += `<li>${p.displayName}: ${p.score || 0} punti</li>`;
    });
    html += "</ol>";

    scoresEl.innerHTML = html;
  });
}

// =====================================
// Admin
// =====================================

function showAdminPanel() {
  const table = document.getElementById("pendingTable");

  db.ref("pendingTeachers").on("value", snap => {
    const data = snap.val() || {};
    table.innerHTML = "";

    Object.entries(data).forEach(([uid, t]) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${t.email}</td>
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
  db.ref("pendingTeachers/" + uid).once("value").then(snap => {
    const data = snap.val();
    if (!data) return;

    return db.ref("teachers/" + uid).set({ email: data.email });
  })
  .then(() => db.ref("pendingTeachers/" + uid).remove());
}

function rejectTeacher(uid) {
  db.ref("pendingTeachers/" + uid).remove();
}

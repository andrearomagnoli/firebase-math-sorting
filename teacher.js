// =========================
// Variabili globali
// =========================

let currentSessionId = null;
let sessionCode = null;

// =========================
// Sessione
// =========================

auth.onAuthStateChanged(user => {
  if (!user) {
    // Nessun utente loggato → torna al login
    window.location.href = "login.html";
    return;
  }

  const uid = user.uid;

  // Controlla se è un docente approvato
  db.ref("teachers/" + uid).once("value").then(snap => {
    if (!snap.exists()) {
      // Non è un docente approvato → logout
      auth.signOut();
      window.location.href = "login.html";
      return;
    }

    // Ricostruisci la UI docente
    document.getElementById("teacherPanel").style.display = "block";

    // Mostra pannello admin (se previsto)
    showAdminPanel();

    // Ricarica eventuali dati della lobby
    loadLobby();
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
  .then(() => {
    const uid = auth.currentUser.uid;

    return db.ref("teachers/" + uid).once("value");
  })
  .then(snap => {
    if (!snap.exists()) {
      throw new Error("Account non autorizzato. Contatta l'amministratore.");
    }

    document.getElementById("loginSection").style.display = "none";
    document.getElementById("teacherPanel").style.display = "block";

    // Mostra pannello admin
    showAdminPanel();
  })
  .catch(err => {
    document.getElementById("loginError").textContent = err.message;
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

  const ref = db.ref("sessions/" + currentSessionId);

  ref.set({
    status: "waiting",
    teacherId: auth.currentUser.uid
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
// Upload Excel con quesiti
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

        if (!id || !text || !bucket) {
          // Riga non valida, la salto
          return;
        }

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
// Lobby: studenti collegati
// =========================

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
// Punteggi in tempo reale
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

    // Ordino per punteggio decrescente
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
// Amministrazione utenti
// =========================

// Mostra pannello admin solo ai docenti approvati
function showAdminPanel() {
  document.getElementById("adminPanel").style.display = "block";

  db.ref("pendingTeachers").on("value", snap => {
    const data = snap.val() || {};
    const table = document.getElementById("pendingTable");
    table.innerHTML = "";

    Object.keys(data).forEach(uid => {
      const teacher = data[uid];

      // FILTRO: salta i docenti con email undefined o stringa "undefined"
      if (!teacher.email || teacher.email === "undefined") {
        return; // non aggiunge la riga alla tabella
      }

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

// APPROVAZIONE DOCENTE
function approveTeacher(uid) {
  db.ref("pendingTeachers/" + uid).once("value")
    .then(snap => {
      const data = snap.val();
      if (!data) return;

      // Copia in teachers/<uid>
      return db.ref("teachers/" + uid).set({
        email: data.email
      });
    })
    .then(() => {
      // Rimuovi da pending
      return db.ref("pendingTeachers/" + uid).remove();
    })
    .catch(err => console.error(err));
}

// RIFIUTO DOCENTE
function rejectTeacher(uid) {
  db.ref("pendingTeachers/" + uid).remove();
}


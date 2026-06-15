// ======================================================
// app.js — funzioni comuni per docente e studente
// ======================================================

// ------------------------------------------------------
// Utility: log elegante
// ------------------------------------------------------
function log(...args) {
  console.log("[MathGame]", ...args);
}

// ------------------------------------------------------
// Utility: mostra messaggi in un elemento HTML
// ------------------------------------------------------
function showMessage(id, text, color = "black") {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
}

// ------------------------------------------------------
// Generatore ID sessione (opzionale)
// ------------------------------------------------------
function generateSessionId(prefix = "SESSION") {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0")
  ].join("");

  return `${prefix}_${stamp}`;
}

// ------------------------------------------------------
// Firebase: wrapper per scrivere nel DB con log
// ------------------------------------------------------
function dbSet(path, value) {
  log("DB SET", path, value);
  return db.ref(path).set(value);
}

// ------------------------------------------------------
// Firebase: wrapper per leggere una volta
// ------------------------------------------------------
function dbGet(path) {
  log("DB GET", path);
  return db.ref(path).once("value").then(snap => snap.val());
}

// ------------------------------------------------------
// Firebase: ascolto realtime
// ------------------------------------------------------
function dbOn(path, callback) {
  log("DB ON", path);
  db.ref(path).on("value", snap => callback(snap.val()));
}

// ------------------------------------------------------
// Firebase: rimozione listener
// ------------------------------------------------------
function dbOff(path) {
  log("DB OFF", path);
  db.ref(path).off();
}

// ------------------------------------------------------
// Utility: validazione email semplice
// ------------------------------------------------------
function isValidEmail(email) {
  return email.includes("@") && email.includes(".");
}

// ------------------------------------------------------
// Utility: validazione stringa non vuota
// ------------------------------------------------------
function isNonEmpty(str) {
  return str && str.trim().length > 0;
}

// ------------------------------------------------------
// Utility: normalizza testo (per ceste, categorie, ecc.)
// ------------------------------------------------------
function normalize(str) {
  return (str || "").trim().toUpperCase();
}

// ------------------------------------------------------
// Utility: mescola array (per randomizzare quesiti)
// ------------------------------------------------------
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------
// Utility: delay (await sleep)
// ------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ------------------------------------------------------
// Debug: stampa errori Firebase in modo leggibile
// ------------------------------------------------------
function handleFirebaseError(err, targetElementId = null) {
  console.error("[Firebase Error]", err);

  if (targetElementId) {
    showMessage(targetElementId, err.message, "red");
  }
}

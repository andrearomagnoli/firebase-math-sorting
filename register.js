function registerTeacher() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const statusEl = document.getElementById("registerStatus");

  if (!email || !password) {
    statusEl.textContent = "Inserisci email e password.";
    statusEl.style.color = "red";
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      const uid = cred.user.uid;

      return db.ref("pendingTeachers/" + uid).set({
        email: email,
        timestamp: Date.now()
      });
    })
    .then(() => {
      statusEl.textContent = "Richiesta inviata. L'amministratore deve approvarla.";
      statusEl.style.color = "green";
    })
    .catch(err => {
      statusEl.textContent = err.message;
      statusEl.style.color = "red";
    });
}

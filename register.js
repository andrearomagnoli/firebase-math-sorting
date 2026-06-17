// register.js – versione Firebase 8 compat

const emailInput = document.getElementById("registerEmail");
const passwordInput = document.getElementById("registerPassword");
const registerBtn = document.getElementById("registerBtn");
const messageBox = document.getElementById("registerMessage");

function showMessage(text, isError = true) {
    messageBox.style.display = "block";
    messageBox.style.color = isError ? "red" : "green";
    messageBox.textContent = text;
}

registerBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    messageBox.style.display = "none";

    if (!email || !password) {
        showMessage("Compila tutti i campi.");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const uid = userCredential.user.uid;

            return db.ref("pendingTeachers/" + uid).set({
                email: email,
                timestamp: Date.now()
            });
        })
        .then(() => {
            showMessage("Registrazione inviata. Attendi l'approvazione.", false);
            emailInput.value = "";
            passwordInput.value = "";
        })
        .catch(error => {
            if (error.code === "auth/email-already-in-use") {
                showMessage("Email già registrata.");
            } else if (error.code === "auth/weak-password") {
                showMessage("La password deve contenere almeno 6 caratteri.");
            } else if (error.code === "auth/invalid-email") {
                showMessage("Formato email non valido.");
            } else {
                showMessage("Errore durante la registrazione.");
            }
        });
});

var button = document.getElementById("next");
var idInput = document.getElementById("id");

button.addEventListener("click", function (event) {
    event.preventDefault();

    let userID = parseInt(idInput.value) - 1;

    let idsArray = JSON.parse(localStorage.getItem("medicalIDs"));
    let names = JSON.parse(localStorage.getItem("names"));
    let agesArray = JSON.parse(localStorage.getItem("ages"));
    let genderArray = JSON.parse(localStorage.getItem("Gender"));

    if (idInput.value === "") {
        alert("Please enter your medical ID");
        return;
    }

    if (!idsArray) {
        alert("Please go back to the home page and click Start Assessment first.");
        return;
    }

    let found = false;
    for (let i = 0; i < idsArray.length; i++) {
        if (userID === idsArray[i]) {
            // Create a session ID for this triage
            const sessionId = "s_" + Date.now();

            // Generate AES key for this session and stash everything
            generateSessionKey().then(keyB64 => {
                const session = {
                    id: sessionId,
                    medicalId: i + 1,
                    name: names[i],
                    age: agesArray[i],
                    gender: genderArray[i],
                    encryptionKey: keyB64,
                    messages: [],          // [{role, ciphertext, iv}]
                    status: "in_progress",
                    createdAt: new Date().toISOString()
                };

                // Append to sessions list
                const allSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
                allSessions.push(session);
                localStorage.setItem("sessions", JSON.stringify(allSessions));
                localStorage.setItem("activeSessionId", sessionId);

                window.location.href = "PatientSurvey.html";
            });

            found = true;
            break;
        }
    }

    if (!found) {
        alert("Medical ID not found");
    }
});

async function generateSessionKey() {
    const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const raw = await crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

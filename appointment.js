// Read what the survey/triage saved
const apptTime = localStorage.getItem("appointmentTime");
const priority = localStorage.getItem("priority"); // "urgent" | "medium" | "normal"

const apptTimeEl = document.getElementById("apptTime");
const apptMetaEl = document.getElementById("apptMeta");
const crisisBox = document.getElementById("crisisBox");
const leadText = document.getElementById("leadText");

if (apptTime) {
    const dt = new Date(apptTime);
    apptTimeEl.textContent = new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
    }).format(dt);

    // Friendly relative description (no priority label leaked to patient)
    const hoursAway = (dt - new Date()) / (1000 * 60 * 60);
    if (hoursAway < 36) {
        apptMetaEl.textContent = "We've arranged this as soon as possible for you.";
    } else if (hoursAway < 24 * 8) {
        apptMetaEl.textContent = "This is within the next week.";
    } else {
        apptMetaEl.textContent = "Standard appointment slot.";
    }
} else {
    apptTimeEl.textContent = "To be confirmed";
    apptMetaEl.textContent = "Reception will contact you shortly.";
}

// Show crisis resources for high-priority cases — patient never sees the label "urgent",
// but they do see the support resources, which is the right safety behaviour.
if (priority === "urgent") {
    crisisBox.style.display = "block";
    leadText.textContent = "Your assessment is complete. We've arranged an appointment for you as soon as possible.";
}

// Clean up sensitive items from localStorage now that we've shown them
window.addEventListener("beforeunload", () => {
    localStorage.removeItem("appointmentTime");
    localStorage.removeItem("priority");
    localStorage.removeItem("sessionId");
    // Keep patient name etc. for friendliness if they restart, harmless
});

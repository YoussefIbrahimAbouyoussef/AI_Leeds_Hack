// ============================================================
// HealthTree — patient chat with Gemini, encrypted localStorage
// ============================================================

const sessionId = localStorage.getItem("activeSessionId");
if (!sessionId) {
    alert("No active session — please start again.");
    window.location.href = "PatientHome.html";
}

function getSession() {
    const all = JSON.parse(localStorage.getItem("sessions") || "[]");
    return all.find(s => s.id === sessionId);
}

function saveSession(updated) {
    const all = JSON.parse(localStorage.getItem("sessions") || "[]");
    const idx = all.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
        all[idx] = updated;
        localStorage.setItem("sessions", JSON.stringify(all));
    }
}

const session = getSession();
document.getElementById("welcome").textContent = "Hello " + session.name;

// ============================================================
// CRYPTO
// ============================================================
async function importKey(b64) {
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        "raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
    );
}

async function encryptText(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipher))),
        iv: btoa(String.fromCharCode(...iv))
    };
}

async function decryptText(payload, key) {
    const ct = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(plain);
}

// ============================================================
// CHAT UI
// ============================================================
const chatLog = document.getElementById("chatLog");
const inputField = document.querySelector(".input");
const submitBtn = document.querySelector(".submit");
const counterEl = document.getElementById("counter");

function appendMessage(text, who) {
    const bubble = document.createElement("div");
    bubble.className = "bubble " + who;
    bubble.textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function appendTyping() {
    const bubble = document.createElement("div");
    bubble.className = "bubble ai typing";
    bubble.id = "typing";
    bubble.textContent = "…";
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById("typing");
    if (t) t.remove();
}

function updateCounter(n) {
    counterEl.textContent = `Question ${n} of ${TOTAL_QUESTIONS}`;
}

// ============================================================
// GEMINI
// ============================================================
async function callGemini(prompt, jsonMode = false) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_KEY_HERE") {
        throw new Error("Gemini API key not set in config.js");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    if (jsonMode) body.generationConfig = { responseMimeType: "application/json" };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function getNextQuestion(historyPlain, questionNumber) {
    const conversationLines = historyPlain.map(h =>
        `${h.role === "ai" ? "Assistant" : "Patient"}: ${h.text}`
    ).join("\n");

    const prompt = `
You are a mental health triage assistant for HealthTree. Your ONLY job is to ask thoughtful,
open-ended questions to understand the patient's mental state. You will ask exactly ${TOTAL_QUESTIONS}
questions across this conversation.

CRITICAL RULES:
- NEVER give advice, reassurance, diagnoses, or coping suggestions.
- NEVER use phrases like "I'm sorry to hear that" or "that must be hard". Stay neutral and professional.
- Ask ONE question per turn. Keep it under 30 words.
- Each question must build on what the patient just said. Do not repeat.
- Cover (across all 10 questions): mood, sleep, appetite, energy, social connection,
  hopelessness, intrusive thoughts, self-harm risk, support systems, substances. Adapt order.
- Question ${questionNumber} of ${TOTAL_QUESTIONS} now. If this is question 1, start gently with what brought them here.
- If patient mentions self-harm or suicide, your next question should sensitively but directly explore
  frequency, plan, and intent — but still as a question, never as advice.
- The patient is ${session.name}, age ${session.age}, ${session.gender}.

${conversationLines ? `Conversation so far:\n${conversationLines}\n\n` : ""}Generate question ${questionNumber}. Respond with ONLY the question text. No preamble, no labels, no quotes.
    `.trim();

    const text = await callGemini(prompt);
    return text.trim().replace(/^["']|["']$/g, "");
}

async function runTriage(historyPlain) {
    const transcript = historyPlain.map(m =>
        `${m.role === "ai" ? "Q" : "A"}: ${m.text}`
    ).join("\n");

    const prompt = `
You are a clinical triage scorer for a mental health intake. Read the transcript below
and assign exactly ONE priority:

- "urgent"  : signs of active suicidal ideation, self-harm risk, severe hopelessness,
              psychosis, inability to function, or any safety concern. Patient needs to be seen fast.
- "medium"  : moderate symptoms — persistent low mood, anxiety affecting daily life,
              sleep/appetite disturbance, but no immediate safety concern.
- "normal"  : mild symptoms, situational stress, generally coping. Routine appointment fine.

Respond ONLY with JSON in this exact shape:
{
  "priority": "urgent" | "medium" | "normal",
  "reasoning": "<2-3 sentences for the doctor explaining the key signals you saw>",
  "sessionTitle": "<short 4-7 word session title for the doctor's queue>"
}

Transcript:
${transcript}
    `.trim();

    let priority = "medium";
    let reasoning = "Automated scoring fallback — please review manually.";
    let sessionTitle = "Mental health triage session";

    try {
        const raw = await callGemini(prompt, true);
        const parsed = JSON.parse(raw);
        if (["urgent", "medium", "normal"].includes(parsed.priority)) priority = parsed.priority;
        if (parsed.reasoning) reasoning = parsed.reasoning;
        if (parsed.sessionTitle) sessionTitle = parsed.sessionTitle;
    } catch (err) {
        console.error("Triage error:", err);
    }

    // Allocate appointment
    const now = new Date();
    let appointmentTime;
    if (priority === "urgent") {
        appointmentTime = new Date(now.getTime() + 22 * 60 * 60 * 1000);
    } else if (priority === "medium") {
        appointmentTime = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
    } else {
        appointmentTime = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    }
    appointmentTime.setMinutes(appointmentTime.getMinutes() < 30 ? 30 : 0);
    if (appointmentTime.getMinutes() === 0) {
        appointmentTime.setHours(appointmentTime.getHours() + 1);
    }
    appointmentTime.setSeconds(0);
    appointmentTime.setMilliseconds(0);

    return { priority, reasoning, sessionTitle, appointmentTime: appointmentTime.toISOString() };
}

// ============================================================
// MAIN FLOW
// ============================================================
let key;
let plainHistory = []; // mirrors encrypted store, plaintext for prompt only

async function start() {
    try {
        key = await importKey(session.encryptionKey);
    } catch (err) {
        appendMessage("Sorry, this session can't be started. Please go back and try again.", "ai");
        console.error(err);
        return;
    }

    appendTyping();
    try {
        const firstQ = await getNextQuestion([], 1);
        removeTyping();
        appendMessage(firstQ, "ai");
        plainHistory.push({ role: "ai", text: firstQ });
        await saveTurn("ai", firstQ);
        updateCounter(1);
    } catch (err) {
        removeTyping();
        appendMessage("Sorry, something went wrong starting your assessment. " + err.message, "ai");
        console.error(err);
    }
}

async function saveTurn(role, text) {
    const enc = await encryptText(text, key);
    const s = getSession();
    s.messages.push({ role, ciphertext: enc.ciphertext, iv: enc.iv });
    saveSession(s);
}

document.querySelector("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const text = inputField.value.trim();
    if (!text) return;

    submitBtn.disabled = true;
    inputField.disabled = true;

    appendMessage(text, "user");
    plainHistory.push({ role: "user", text });
    inputField.value = "";
    await saveTurn("user", text);

    const aiAsked = plainHistory.filter(m => m.role === "ai").length;

    if (aiAsked >= TOTAL_QUESTIONS) {
        // Triage time
        appendTyping();
        try {
            const result = await runTriage(plainHistory);
            removeTyping();

            const s = getSession();
            s.status = "complete";
            s.priority = result.priority;
            s.reasoning = result.reasoning;
            s.sessionTitle = result.sessionTitle;
            s.appointmentTime = result.appointmentTime;
            s.completedAt = new Date().toISOString();
            saveSession(s);

            localStorage.setItem("appointmentTime", result.appointmentTime);
            localStorage.setItem("priority", result.priority);
            window.location.href = "appointment.html";
        } catch (err) {
            removeTyping();
            appendMessage("We've recorded your responses. Please contact reception.", "ai");
            console.error(err);
            submitBtn.disabled = false;
            inputField.disabled = false;
        }
        return;
    }

    appendTyping();
    try {
        const nextQ = await getNextQuestion(plainHistory, aiAsked + 1);
        removeTyping();
        appendMessage(nextQ, "ai");
        plainHistory.push({ role: "ai", text: nextQ });
        await saveTurn("ai", nextQ);
        updateCounter(aiAsked + 1);
    } catch (err) {
        removeTyping();
        appendMessage("Sorry, please try sending again. " + err.message, "ai");
        console.error(err);
    }

    submitBtn.disabled = false;
    inputField.disabled = false;
    inputField.focus();
});

start();

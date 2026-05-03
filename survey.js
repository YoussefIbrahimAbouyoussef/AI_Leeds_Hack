// survey.js
// Imports the live pod from pod.js (top-level await in pod.js means the pod
// is fully booted before any line of this file runs).

import { getPortalUrl } from "./pod.js";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const TOTAL_QUESTIONS = 7;

// BrowserPod knowledge baked into every Gemini system prompt.
// This makes the Gemini agent aware of the infrastructure it's running on.
const BROWSERPOD_KNOWLEDGE = `
You are operating inside a HealthTree session powered by BrowserPod — a universal
execution layer that runs Node.js compiled to WebAssembly directly in the patient's
browser tab. No cloud servers process this data. Each pod is sandboxed and ephemeral.

Architecture in this session:
- A Node.js HTTP server runs inside the BrowserPod pod on port 3000
- Every conversation turn is POSTed to that server at /log
- The server writes to /home/user/project/session.log in the pod's virtual filesystem
- BrowserPod exposes the server via a Portal URL (SharedArrayBuffer + WebWorkers)
- Zero patient data leaves the device to any third-party server

BrowserPod API used here:
- BrowserPod.boot({ apiKey: import.meta.env.VITE_BP_APIKEY })
- pod.createDefaultTerminal(element)   // element must stay in DOM
- pod.onPortal(({ url, port }) => {})  // register BEFORE pod.run
- pod.createDirectory(path)
- pod.run("npm", ["install"], { echo, terminal, cwd })  // NOT a shell
- pod.run("node", ["main.js"], { echo, terminal, cwd })
- copyFile(pod, "project/main.js", homePath)            // from utils.js
`;

// ── Session ───────────────────────────────────────────────────────────────────
const sessionId = localStorage.getItem("activeSessionId");
if (!sessionId) {
  alert("No active session — please start again.");
  window.location.href = "index.html";
}

function getSession() {
  return JSON.parse(localStorage.getItem("sessions") || "[]").find(
    (s) => s.id === sessionId,
  );
}

function saveSession(updated) {
  const all = JSON.parse(localStorage.getItem("sessions") || "[]");
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    all[idx] = updated;
    localStorage.setItem("sessions", JSON.stringify(all));
  }
}

const session = getSession();
document.getElementById("welcome").textContent = "Hello " + session.name;

// ── Pod log helper ────────────────────────────────────────────────────────────
async function postTurnToPod(role, text) {
  const url = getPortalUrl(3000);
  if (!url) return; // portal not fired yet — skip silently, localStorage is source of truth
  try {
    await fetch(`${url}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, text, sessionId }),
    });
  } catch (err) {
    console.warn("[BrowserPod] Could not post turn:", err);
  }
}

// ── Crypto ────────────────────────────────────────────────────────────────────
async function importKey(b64) {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptText(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
const chatLog = document.getElementById("chatLog");
const inputField = document.querySelector(".input");
const submitBtn = document.querySelector(".submit");
const counterEl = document.getElementById("counter");

function appendMessage(text, who) {
  const b = document.createElement("div");
  b.className = "bubble " + who;
  b.textContent = text;
  chatLog.appendChild(b);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function appendTyping() {
  const b = document.createElement("div");
  b.className = "bubble ai typing";
  b.id = "typing";
  b.textContent = "…";
  chatLog.appendChild(b);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function removeTyping() {
  document.getElementById("typing")?.remove();
}
function updateCounter(n) {
  counterEl.textContent = `Question ${n} of ${TOTAL_QUESTIONS}`;
}

// ── Gemini ────────────────────────────────────────────────────────────────────
async function callGemini(userPrompt, systemPrompt = "", jsonMode = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    ...(systemPrompt && {
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }),
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    ...(jsonMode && {
      generationConfig: { responseMimeType: "application/json" },
    }),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function buildSystemPrompt() {
  return `${BROWSERPOD_KNOWLEDGE}

You are a mental health triage assistant for HealthTree. Your ONLY job is to ask
thoughtful, open-ended questions to understand the patient's mental state.
You will ask exactly ${TOTAL_QUESTIONS} questions across this conversation.

RULES:
- NEVER give advice, reassurance, diagnoses, or coping suggestions.
- NEVER say "I'm sorry to hear that" or "that must be hard". Stay neutral and professional.
- Ask ONE question per turn, under 30 words.
- Each question must build on what the patient just said. Never repeat topics.
- Cover across all questions: mood, sleep, appetite, energy, social connection,
  hopelessness, intrusive thoughts, self-harm risk, support systems, substances.
- If patient mentions self-harm or suicide, sensitively but directly explore
  frequency, plan, and intent — as a question only, never as advice.
- Patient: ${session.name}, age ${session.age}, ${session.gender}.`;
}

async function getNextQuestion(historyPlain, questionNumber) {
  const lines = historyPlain
    .map((h) => `${h.role === "ai" ? "Assistant" : "Patient"}: ${h.text}`)
    .join("\n");
  const userPrompt = `${lines ? `Conversation so far:\n${lines}\n\n` : ""}Generate question ${questionNumber} of ${TOTAL_QUESTIONS}. ${questionNumber === 1 ? "Start gently with what brought them here." : ""} Respond with ONLY the question text. No preamble, no labels, no quotes.`;
  const text = await callGemini(userPrompt, buildSystemPrompt());
  return text.trim().replace(/^["']|["']$/g, "");
}

async function runTriage(historyPlain) {
  const transcript = historyPlain
    .map((m) => `${m.role === "ai" ? "Q" : "A"}: ${m.text}`)
    .join("\n");
  const userPrompt = `Assign ONE priority:
- "urgent" : suicidal ideation, self-harm risk, severe hopelessness, psychosis, or safety concern
- "medium" : persistent low mood, anxiety affecting daily life, no immediate safety concern
- "normal" : mild symptoms, situational stress, generally coping

Respond ONLY with JSON (no markdown, no backticks):
{ "priority": "urgent"|"medium"|"normal", "reasoning": "<2-3 sentences for the doctor>", "sessionTitle": "<4-7 word title>" }

Transcript:
${transcript}`;

  let priority = "medium",
    reasoning = "Manual review required.",
    sessionTitle = "Mental health triage session";
  try {
    const raw = await callGemini(userPrompt, buildSystemPrompt(), true);
    const p = JSON.parse(raw);
    if (["urgent", "medium", "normal"].includes(p.priority))
      priority = p.priority;
    if (p.reasoning) reasoning = p.reasoning;
    if (p.sessionTitle) sessionTitle = p.sessionTitle;
  } catch (err) {
    console.error("Triage parse error:", err);
  }

  // Also log the triage result to the pod
  const url = getPortalUrl(3000);
  if (url) {
    fetch(`${url}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "triage",
        priority,
        reasoning,
        sessionTitle,
        sessionId,
      }),
    }).catch(() => {});
  }

  const now = new Date();
  const hoursOffset =
    priority === "urgent" ? 22 : priority === "medium" ? 4 * 24 : 14 * 24;
  const appt = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
  appt.setMinutes(appt.getMinutes() < 30 ? 30 : 0);
  if (appt.getMinutes() === 0) appt.setHours(appt.getHours() + 1);
  appt.setSeconds(0);
  appt.setMilliseconds(0);

  return {
    priority,
    reasoning,
    sessionTitle,
    appointmentTime: appt.toISOString(),
  };
}

// ── Main flow ─────────────────────────────────────────────────────────────────
let key;
let plainHistory = [];

async function saveTurn(role, text) {
  const enc = await encryptText(text, key);
  const s = getSession();
  s.messages.push({ role, ciphertext: enc.ciphertext, iv: enc.iv });
  saveSession(s);
  postTurnToPod(role, text); // fire-and-forget
}

async function start() {
  try {
    key = await importKey(session.encryptionKey);
  } catch (err) {
    appendMessage("Session error — please go back and try again.", "ai");
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
    appendMessage(
      "Something went wrong starting your assessment: " + err.message,
      "ai",
    );
  }
}

document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputField.value.trim();
  if (!text) return;

  submitBtn.disabled = true;
  inputField.disabled = true;
  appendMessage(text, "user");
  plainHistory.push({ role: "user", text });
  inputField.value = "";
  await saveTurn("user", text);

  const aiAsked = plainHistory.filter((m) => m.role === "ai").length;

  if (aiAsked >= TOTAL_QUESTIONS) {
    appendTyping();
    try {
      const result = await runTriage(plainHistory);
      removeTyping();
      const s = getSession();
      Object.assign(s, {
        status: "complete",
        ...result,
        completedAt: new Date().toISOString(),
      });
      saveSession(s);
      localStorage.setItem("appointmentTime", result.appointmentTime);
      localStorage.setItem("priority", result.priority);
      window.location.href = "appointment.html";
    } catch (err) {
      removeTyping();
      appendMessage(
        "We've recorded your responses. Please contact reception.",
        "ai",
      );
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
    appendMessage("Sorry, please try again: " + err.message, "ai");
  }

  submitBtn.disabled = false;
  inputField.disabled = false;
  inputField.focus();
});

start();

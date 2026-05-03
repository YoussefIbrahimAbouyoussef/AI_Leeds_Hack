// project/main.js
// This file is copied into the BrowserPod virtual filesystem and run with Node.js.
// It starts a tiny HTTP server inside the pod that serves the session log,
// which BrowserPod exposes via a Portal URL the patient page can iframe.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const LOG_PATH = "/home/user/project/session.log";

// Ensure the log file exists
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, "[]");
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/log") {
    // Return the session log as JSON
    const data = fs.readFileSync(LOG_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(data);
  } else if (req.method === "POST" && req.url === "/log") {
    // Append an entry to the session log
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const entry = JSON.parse(body);
        const existing = JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
        existing.push({ ...entry, ts: Date.now() });
        fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", pod: true, port: PORT }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  // This console.log is what triggers BrowserPod's onPortal callback
  console.log(`[HealthTree Pod] Session log server listening on port ${PORT}`);
});

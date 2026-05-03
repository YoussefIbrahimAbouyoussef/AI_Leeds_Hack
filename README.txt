HealthTree — Local Demo Setup
==============================

This version runs entirely in your browser. No backend, no deployment.
The doctor and patient pages share data through localStorage.

WHAT YOU NEED
-------------
1. A Gemini API key from https://aistudio.google.com/app/apikey
2. Tree.png (your logo) in this folder
3. A modern browser (Chrome, Edge, or Firefox)

SETUP — 3 STEPS
---------------

STEP 1: Add your Gemini API key
   Open config.js in any text editor (Notepad works fine).
   Find this line:
       const GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE";
   Replace PASTE_YOUR_KEY_HERE with your actual Gemini key.
   Save the file.

STEP 2: Make sure Tree.png is in this folder.
   Copy it from your original patient project folder if it isn't.

STEP 3: Run a local server
   You can't just double-click PatientHome.html — browser security blocks
   the Gemini API call when opened as a file. You need a tiny local server.

   EASIEST WAY: open this folder in VS Code, install the "Live Server"
   extension, right-click PatientHome.html, click "Open with Live Server".

   OR using Python (if you have it installed):
       1. Open a terminal IN THIS FOLDER
       2. Run:  python -m http.server 8000
       3. Open http://localhost:8000/PatientHome.html in your browser

   OR using Node.js:
       1. Open a terminal IN THIS FOLDER
       2. Run:  npx serve
       3. Open the URL it shows you

DEMO FLOW
---------
1. Open http://localhost:PORT/PatientHome.html in one tab.
2. Open http://localhost:PORT/Doctor.html in ANOTHER tab in the SAME browser.
3. On the patient tab: click Start Assessment, type medical ID 1, answer 10 questions.
4. The doctor tab updates within 2 seconds — the patient appears in the queue.
5. Click "View full transcript" on the doctor side to see the decrypted conversation.

Try different patients (IDs 1-20) and answer with different vibes:
- Cheerful answers → "normal" priority (green)
- Mention struggling, low mood → "medium" (yellow)
- Mention hopelessness or self-harm → "urgent" (red, and crisis box appears for the patient)

LIMITATIONS
-----------
- Patient and doctor must use the same browser on the same machine.
- API key is in config.js — anyone with access to your files can see it.
  Don't upload this folder to GitHub publicly.
- Closing the browser preserves data. Clearing localStorage (or using
  incognito mode) wipes everything.

TROUBLESHOOTING
---------------
"Gemini API key not set" → you didn't save config.js after editing.
"Gemini 403" → your API key is invalid or restricted. Make a fresh one.
"Gemini 429" → you've hit the free quota; wait a minute and try again.
Doctor page empty → patient hasn't completed assessment yet, or you're
   in a different browser/profile than the patient tab.

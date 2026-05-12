/**
 * index.js  — Try-On Server + QR Code Host  (HTTPS Edition)
 * ===========================================================
 * ROOT CAUSE OF "Camera access denied":
 *   Browsers ONLY allow camera/microphone on HTTPS pages (or localhost).
 *   Your phone was hitting  http://192.168.x.x:3001  → browser blocks camera.
 *
 * FIX: This server now runs on HTTPS using a self-signed certificate.
 *   Phone URL becomes:  https://192.168.x.x:3001
 *   Browser will show a "Not Secure" warning ONCE — tap "Advanced → Proceed".
 *   After that, camera works perfectly.
 *
 * SETUP (run once before first use):
 *   npm install express qrcode
 *   node generate_cert.js          ← creates cert.pem + key.pem
 *   node index.js                  ← start the server
 *
 * OR: the server auto-generates the cert on first run if openssl is available.
 */

const { spawn, execSync } = require("child_process");
const express  = require("express");
const readline = require("readline");
const path     = require("path");
const os       = require("os");
const fs       = require("fs");
const https    = require("https");
const http     = require("http");   // HTTP redirect server

let QRCode;
try { QRCode = require("qrcode"); } catch { QRCode = null; }

const app = express();

// ── Config ────────────────────────────────────────────────────────────────────
const HTTPS_PORT  = parseInt(process.env.PORT)   || 3001;
const HTTP_PORT   = HTTPS_PORT + 1;               // 3002 — redirects to HTTPS
const GARMENT     = process.env.GARMENT     || "garment.png";
const PYTHON_BIN  = process.env.PYTHON_BIN  || "python";
const FRONTEND    = path.join(__dirname, "mobile_tryon.html");
// Auto-detect whichever engine version is present in the same folder
const ENGINE = (() => {
  const candidates = ["tryon_engine_v9.py","tryon_engine_v8.py","tryon_engine.py"];
  for (const f of candidates) {
    const p = path.join(__dirname, f);
    if (fs.existsSync(p)) { console.log("[Server] Using engine: " + f); return p; }
  }
  console.error("[Server] ERROR: No tryon_engine*.py found in", __dirname);
  process.exit(1);
})();
const CERT_FILE   = path.join(__dirname, "cert.pem");
const KEY_FILE    = path.join(__dirname, "key.pem");

// ── Get local IP ──────────────────────────────────────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

const LOCAL_IP   = getLocalIP();
const SERVER_URL = `https://${LOCAL_IP}:${HTTPS_PORT}`;
const QR_URL     = `${SERVER_URL}/?server=${SERVER_URL}`;

// ── Auto-generate self-signed cert if missing ─────────────────────────────────
function ensureCert() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    console.log("[Server] Using existing SSL certificate.");
    return true;
  }

  console.log("[Server] Generating self-signed SSL certificate…");
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}"` +
      ` -days 825 -nodes -subj "/CN=${LOCAL_IP}"` +
      ` -addext "subjectAltName=IP:${LOCAL_IP},IP:127.0.0.1"`,
      { stdio: "pipe" }
    );
    console.log("[Server] Certificate created: cert.pem + key.pem");
    return true;
  } catch (e) {
    console.warn("[Server] openssl not found — falling back to HTTP.");
    console.warn("         Install openssl or run generate_cert.js manually.");
    return false;
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "12mb" }));
app.use(express.static(__dirname));

// ── Spawn Python engine ───────────────────────────────────────────────────────
const pyEngine = spawn(
  PYTHON_BIN,
  [ENGINE, "--mode", "server", "--garment", GARMENT],
  { stdio: ["pipe", "pipe", "pipe"] }
);

pyEngine.on("error", (err) => {
  console.error("[Server] Python engine failed to start:", err.message);
  process.exit(1);
});
pyEngine.on("close", (code) => console.log(`[Server] Python exited (${code})`));
pyEngine.stderr.on("data", (d) => process.stderr.write(`[Engine] ${d}`));

// ── FIFO request queue ────────────────────────────────────────────────────────
const queue = [];
const rl = readline.createInterface({ input: pyEngine.stdout, crlfDelay: Infinity });
rl.on("line", (line) => {
  const handler = queue.shift();
  if (!handler) return;
  try   { handler.resolve(JSON.parse(line)); }
  catch (e) { handler.reject(new Error("Bad Python response: " + e.message)); }
});

function sendToPython(payload) {
  return new Promise((resolve, reject) => {
    queue.push({ resolve, reject });
    pyEngine.stdin.write(JSON.stringify(payload) + "\n");
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  if (fs.existsSync(FRONTEND)) return res.sendFile(FRONTEND);
  res.status(404).send("mobile_tryon.html not found.");
});

app.get("/health", (req, res) =>
  res.json({ status: "ok", engine: "running", garment: GARMENT, server: SERVER_URL, https: true })
);

app.post("/tryon", async (req, res) => {
  const { frame, garment } = req.body;
  if (!frame) return res.status(400).json({ success: false, error: "Missing frame." });
  try {
    const payload = { frame };
    if (garment) payload.garment = garment;
    const result = await sendToPython(payload);
    return res.json(result);
  } catch (err) {
    console.error("[Server] Engine error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start servers ─────────────────────────────────────────────────────────────
async function start() {
  const hasCert = ensureCert();

  if (hasCert) {
    // ── HTTPS server (main) ─────────────────────────────────────────────────
    const sslOptions = {
      key:  fs.readFileSync(KEY_FILE),
      cert: fs.readFileSync(CERT_FILE),
    };

    https.createServer(sslOptions, app).listen(HTTPS_PORT, "0.0.0.0", async () => {
      printBanner(true);
    });

    // ── HTTP → HTTPS redirect (convenience) ────────────────────────────────
    http.createServer((req, res) => {
      res.writeHead(301, { Location: `https://${req.headers.host.split(":")[0]}:${HTTPS_PORT}${req.url}` });
      res.end();
    }).listen(HTTP_PORT, "0.0.0.0", () => {
      console.log(`[Server] HTTP redirect running on port ${HTTP_PORT} → HTTPS`);
    });

  } else {
    // ── Fallback: plain HTTP (camera WON'T work on phones) ─────────────────
    app.listen(HTTPS_PORT, "0.0.0.0", () => printBanner(false));
  }
}

async function printBanner(isHttps) {
  const protocol = isHttps ? "https" : "http";
  const url      = `${protocol}://${LOCAL_IP}:${HTTPS_PORT}`;
  const qrTarget = `${url}/?server=${url}`;

  console.log("\n" + "═".repeat(60));
  console.log("  🧥  Virtual Try-On Server  —  Layellpur Innovation 2025");
  console.log("═".repeat(60));
  console.log(`  Protocol   : ${isHttps ? "✅ HTTPS (camera will work on phones)" : "⚠  HTTP  (camera BLOCKED on phones)"}`);
  console.log(`  Server URL : ${url}`);
  console.log(`  Mobile URL : ${qrTarget}`);
  console.log("─".repeat(60));

  if (isHttps) {
    console.log("  ⚠  FIRST TIME on each phone:");
    console.log("     Browser shows 'Your connection is not private'");
    console.log("     Tap  Advanced  →  Proceed to " + LOCAL_IP + "  (unsafe)");
    console.log("     This is normal for self-signed certs on a local network.");
    console.log("─".repeat(60));
  }

  if (QRCode) {
    console.log("  📱 Scan this QR on any phone (same Wi-Fi):\n");
    const qr = await QRCode.toString(qrTarget, { type: "terminal", small: true });
    console.log(qr);

    await QRCode.toFile(path.join(__dirname, "qr.png"), qrTarget, {
      width: 500, margin: 2,
      color: { dark: "#7c3aed", light: "#ffffff" },
    });
    console.log("  ✅  qr.png saved — print or display it!\n");
  } else {
    console.log(`  👉 Share this URL manually: ${qrTarget}\n`);
    console.log("  Run  npm install qrcode  to auto-generate QR codes.\n");
  }

  console.log("  Exhibition Tips:");
  console.log("  ├─ All phones MUST be on the same Wi-Fi as this laptop");
  console.log("  ├─ Use 5GHz Wi-Fi band for lower latency");
  console.log("  ├─ Windows Firewall: allow port", HTTPS_PORT, "(TCP inbound)");
  console.log(`  │   netsh advfirewall firewall add rule name="TryOn" dir=in`);
  console.log(`  │   action=allow protocol=TCP localport=${HTTPS_PORT}`);
  console.log("  ├─ Certificate warning: tap Advanced → Proceed (once per phone)");
  console.log("  └─ To open firewall NOW, run this in an ADMIN terminal:");
  console.log("      netsh advfirewall firewall add rule name=TryOn dir=in action=allow protocol=TCP localport=" + HTTPS_PORT);
  console.log("═".repeat(60) + "\n");
}

start();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down…");
  pyEngine.stdin.end();
  process.exit(0);
});
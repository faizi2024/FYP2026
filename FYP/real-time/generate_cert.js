/**
 * generate_cert.js
 * ─────────────────
 * Generates a self-signed SSL certificate for the local network IP.
 * Run ONCE before starting the server:
 *
 *   node generate_cert.js
 *
 * Creates: cert.pem  (certificate)
 *          key.pem   (private key)
 *
 * Requirements: openssl must be installed.
 *   Windows: https://slproweb.com/products/Win32OpenSSL.html  (Light version is fine)
 *   OR:  winget install ShiningLight.OpenSSL
 */

const { execSync } = require("child_process");
const os   = require("os");
const fs   = require("fs");
const path = require("path");

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces))
    for (const iface of ifaces[name])
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
  return "127.0.0.1";
}

const ip       = getLocalIP();
const certFile = path.join(__dirname, "cert.pem");
const keyFile  = path.join(__dirname, "key.pem");

console.log(`\nGenerating self-signed SSL certificate for IP: ${ip}`);
console.log("This certificate is valid for 825 days (~2 years).\n");

try {
  execSync(
    `openssl req -x509 -newkey rsa:2048` +
    ` -keyout "${keyFile}" -out "${certFile}"` +
    ` -days 825 -nodes` +
    ` -subj "/CN=${ip}"` +
    ` -addext "subjectAltName=IP:${ip},IP:127.0.0.1"`,
    { stdio: "inherit" }
  );
  console.log("\n✅  Done!");
  console.log(`   cert.pem → ${certFile}`);
  console.log(`   key.pem  → ${keyFile}`);
  console.log("\nNow run:  node index.js");
  console.log(`\n⚠  On each phone (FIRST TIME ONLY):`);
  console.log(`   Browser shows "Not Private" warning.`);
  console.log(`   Tap  Advanced  →  Proceed to ${ip}  (unsafe)`);
  console.log(`   This is expected for local self-signed certificates.\n`);
} catch (e) {
  console.error("\n❌  openssl not found or failed.");
  console.error("   Windows: install from https://slproweb.com/products/Win32OpenSSL.html");
  console.error("   Or run:  winget install ShiningLight.OpenSSL");
  console.error("   Then re-run this script.\n");
  process.exit(1);
}

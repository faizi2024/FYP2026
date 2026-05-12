#!/usr/bin/env node
/**
 * diagnose.js
 * ───────────
 * Checks if your system has all required dependencies installed.
 * Run before starting the server:
 *
 *   node diagnose.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const checks = [];

function check(name, fn) {
  try {
    const result = fn();
    checks.push({ name, status: "OK", message: result });
  } catch (e) {
    checks.push({ name, status: "FAIL", message: e.message });
  }
}

console.log("\n[DIAGNOSE] Virtual Try-On System Check\n");

// 1. Node.js
check("Node.js", () => {
  const v = process.version;
  return `v${v}`;
});

// 2. npm packages
check("qrcode npm package", () => {
  require.resolve("qrcode");
  return "installed";
});

check("qrcode-terminal npm package", () => {
  require.resolve("qrcode-terminal");
  return "installed";
});

// 3. Python
check("Python executable", () => {
  const v = execSync("python --version").toString().trim();
  return v;
});

// 4. Python packages
check("diffusers (pip)", () => {
  execSync("python -c \"import diffusers; print(diffusers.__version__)\"");
  return "installed";
});

check("transformers (pip)", () => {
  execSync("python -c \"import transformers; print('OK')\"", { stdio: "pipe" });
  return "installed";
});

check("accelerate (pip)", () => {
  execSync("python -c \"import accelerate; print('OK')\"", { stdio: "pipe" });
  return "installed";
});

check("torch (pip)", () => {
  const v = execSync("python -c \"import torch; print(f'v{torch.__version__}')\"", { stdio: "pipe" }).toString().trim();
  return v;
});

// 5. Engine files
check("Engine file (tryon_engine_*.py)", () => {
  const candidates = [
    "tryon_engine_hybrid.py",
    "tryon_engine_v9.py",
    "tryon_engine_v8.py",
    "tryon_engine.py",
  ];
  for (const f of candidates) {
    if (fs.existsSync(path.join(process.cwd(), f))) {
      return f;
    }
  }
  throw new Error("None found in current directory");
});

// 6. HTML frontend
check("Frontend file (mobile_tryon.html)", () => {
  if (fs.existsSync("mobile_tryon.html")) return "found";
  throw new Error("Not found in current directory");
});

// 7. Garment image
check("Garment image", () => {
  const candidates = ["garment.png", "garment.jpg", "garment.jpeg"];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f;
  }
  throw new Error("No garment.png/jpg found (optional for first run)");
});

// 8. SSL certificates
check("SSL certificates (optional)", () => {
  const hasCert = fs.existsSync("cert.pem") && fs.existsSync("key.pem");
  return hasCert ? "present (will reuse)" : "not present (will be auto-generated)";
});

// 9. OpenSSL
check("OpenSSL (for cert generation)", () => {
  execSync("openssl version", { stdio: "pipe" });
  return "installed";
});

// Print results
console.log("╔" + "═".repeat(60) + "╗");
for (const check of checks) {
  const icon = check.status === "OK" ? "[OK]" : "[!]";
  const line = `║ ${icon} ${check.name.padEnd(30)} ${check.message}`;
  console.log(line.substring(0, 62).padEnd(62) + "║");
}
console.log("╚" + "═".repeat(60) + "╝");

const failed = checks.filter(c => c.status === "FAIL");
const passed = checks.filter(c => c.status === "OK");

console.log(`\n${passed.length}/${checks.length} checks passed`);

if (failed.length > 0) {
  console.log("\n[FIXES NEEDED]\n");
  
  for (const f of failed) {
    console.log(`${f.name}: ${f.message}`);
    
    if (f.name.includes("qrcode")) {
      console.log("  Fix: npm install qrcode qrcode-terminal\n");
    }
    if (f.name.includes("diffusers")) {
      console.log("  Fix: pip install diffusers>=0.27.0 --break-system-packages\n");
    }
    if (f.name.includes("transformers")) {
      console.log("  Fix: pip install transformers --break-system-packages\n");
    }
    if (f.name.includes("accelerate")) {
      console.log("  Fix: pip install accelerate --break-system-packages\n");
    }
    if (f.name.includes("torch")) {
      console.log("  Fix: pip install torch --break-system-packages\n");
    }
    if (f.name.includes("Engine")) {
      console.log("  Fix: Copy tryon_engine_v9.py to this directory\n");
    }
    if (f.name.includes("Frontend")) {
      console.log("  Fix: Copy mobile_tryon.html to this directory\n");
    }
    if (f.name.includes("OpenSSL")) {
      console.log("  Fix: https://slproweb.com/products/Win32OpenSSL.html\n");
    }
  }
  
  console.log("After installing, run 'node diagnose.js' again to verify.\n");
  process.exit(1);
} else {
  console.log("\n[SUCCESS] All checks passed! You can now run:\n");
  console.log("  node index.js --garment=garment.png\n");
}
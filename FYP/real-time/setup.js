#!/usr/bin/env node
/**
 * setup.js
 * ────────
 * One-time automated setup script.
 * Installs all npm and Python dependencies.
 *
 * Run once:
 *   node setup.js
 *
 * Then:
 *   node index.js --garment=garment.png
 */

const { execSync } = require("child_process");
const fs = require("fs");

const steps = [
  {
    name: "NPM: qrcode",
    cmd: "npm install qrcode",
    optional: false,
  },
  {
    name: "NPM: qrcode-terminal",
    cmd: "npm install qrcode-terminal",
    optional: false,
  },
  {
    name: "PIP: diffusers",
    cmd: "pip install diffusers>=0.27.0 --break-system-packages",
    optional: false,
  },
  {
    name: "PIP: transformers",
    cmd: "pip install transformers --break-system-packages",
    optional: false,
  },
  {
    name: "PIP: accelerate",
    cmd: "pip install accelerate --break-system-packages",
    optional: false,
  },
  {
    name: "PIP: torch (may take a while...)",
    cmd: "pip install torch --break-system-packages",
    optional: true,  // Only if not already installed
  },
];

console.log("\n" + "=".repeat(60));
console.log("  VIRTUAL TRY-ON — Automated Setup");
console.log("=".repeat(60) + "\n");

let passed = 0;
let failed = 0;

for (const step of steps) {
  process.stdout.write(`[${passed + failed + 1}/${steps.length}] ${step.name}... `);
  
  try {
    execSync(step.cmd, { stdio: "ignore" });
    console.log("OK");
    passed++;
  } catch (e) {
    if (step.optional) {
      console.log("SKIP (optional)");
    } else {
      console.log(`FAIL\n  Error: ${e.message}`);
      failed++;
    }
  }
}

console.log("\n" + "=".repeat(60));
console.log(`  Results: ${passed} installed, ${failed} failed`);
console.log("=".repeat(60) + "\n");

if (failed > 0) {
  console.log("Some installations failed. Try installing manually:");
  console.log("");
  for (const step of steps) {
    if (!step.optional) {
      console.log(`  ${step.cmd}`);
    }
  }
  console.log("");
  process.exit(1);
} else {
  console.log("All dependencies installed! You can now run:\n");
  console.log("  node index.js --garment=garment.png\n");
  
  // Check for engine file
  if (!fs.existsSync("tryon_engine_v9.py") && 
      !fs.existsSync("tryon_engine_hybrid.py") &&
      !fs.existsSync("tryon_engine_v8.py")) {
    console.log("WARNING: No engine file found!");
    console.log("Make sure tryon_engine_v9.py is in this directory.\n");
  }
  
  // Check for HTML
  if (!fs.existsSync("mobile_tryon.html")) {
    console.log("WARNING: No mobile_tryon.html found!");
    console.log("Make sure mobile_tryon.html is in this directory.\n");
  }
}
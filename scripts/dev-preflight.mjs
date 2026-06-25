import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");
const devLog = path.join(nextDir, "dev", "logs", "next-development.log");
const forceClean = process.argv.includes("--force");

const staleCacheMarkers = [
  "internal error in Turbopack",
  "Could not parse module '[project]/node_modules/next/document.js', file not found",
];

function readTail(filePath, maxBytes = 512 * 1024) {
  const stats = fs.statSync(filePath);
  const start = Math.max(0, stats.size - maxBytes);
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(stats.size - start);

  try {
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
}

function moveNextAside(reason) {
  if (!fs.existsSync(nextDir)) return;

  const staleDir = path.join(projectRoot, `.next-stale-${timestamp()}`);
  fs.renameSync(nextDir, staleDir);
  console.warn(
    `[dev-preflight] ${reason}. Moved .next to ${path.basename(staleDir)}.`
  );
}

if (forceClean) {
  moveNextAside("Forced clean requested");
  process.exit(0);
}

if (fs.existsSync(devLog)) {
  const logTail = readTail(devLog);
  const marker = staleCacheMarkers.find((text) => logTail.includes(text));

  if (marker) {
    moveNextAside(`Detected stale Next/Turbopack cache marker: "${marker}"`);
  }
}

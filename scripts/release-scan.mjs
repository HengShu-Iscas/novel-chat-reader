import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  "release",
  "tmp",
  "coverage",
  "playwright-report",
  "test-results",
]);
const blockedExtensions = new Set([".epub", ".pem", ".key", ".p12", ".pfx", ".crt"]);
const suspiciousPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /gho_[A-Za-z0-9_]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
];

const findings = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(fullPath);
      }
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (blockedExtensions.has(ext)) {
      findings.push(`blocked file type: ${relative}`);
      continue;
    }

    if (!isTextCandidate(ext)) continue;
    const content = await readFile(fullPath, "utf8");
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        findings.push(`suspicious secret pattern in ${relative}: ${pattern}`);
      }
    }
  }
}

function isTextCandidate(ext) {
  return [
    "",
    ".cjs",
    ".css",
    ".html",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".svg",
    ".ts",
    ".tsx",
    ".yml",
    ".yaml",
  ].includes(ext);
}

await walk(root);

if (findings.length > 0) {
  console.error("Release scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Release scan passed: no obvious secrets, private key files, or EPUB files found.");

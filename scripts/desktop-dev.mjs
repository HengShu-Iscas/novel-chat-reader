import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const npmCliPath =
  process.env.npm_execpath ?? path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const electronCliPath = path.join(root, "node_modules/electron/cli.js");
const devServerUrl = "http://127.0.0.1:5173";

function spawnLogged(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnLogged(command, args);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}`));
      }
    });
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until Vite is ready.
    }
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

await runOnce(process.execPath, ["scripts/build-electron.mjs"]);

const vite = spawnLogged(process.execPath, [npmCliPath, "run", "dev", "--", "--port", "5173"]);
await waitForServer(devServerUrl);

const electron = spawnLogged(process.execPath, [electronCliPath, "."], {
  env: { ...process.env, VITE_DEV_SERVER_URL: devServerUrl },
});

function shutdown() {
  vite.kill();
  electron.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
electron.on("exit", () => {
  vite.kill();
});

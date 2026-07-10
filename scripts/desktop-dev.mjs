import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const npmCliPath =
  process.env.npm_execpath ?? path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const electronCliPath = path.join(root, "node_modules/electron/cli.js");

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

await runOnce(process.execPath, [npmCliPath, "run", "desktop:build"]);

const electron = spawnLogged(process.execPath, [electronCliPath, "."]);

function shutdown() {
  electron.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

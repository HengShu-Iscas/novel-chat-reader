import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const npmCliPath =
  process.env.npm_execpath ?? path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const electronBuilderCliPath = path.join(root, "node_modules/electron-builder/cli.js");

const packageEnv = {
  ...process.env,
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? "https://npmmirror.com/mirrors/electron/",
  ELECTRON_BUILDER_BINARIES_MIRROR:
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR ?? "https://npmmirror.com/mirrors/electron-builder-binaries/",
};

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}`));
      }
    });
  });
}

await run(process.execPath, [npmCliPath, "run", "desktop:build"]);
await run(process.execPath, [electronBuilderCliPath, "--win", "nsis", "portable", "--x64", "--publish=never"], packageEnv);

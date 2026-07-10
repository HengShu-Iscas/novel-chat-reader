import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const outDir = path.join(root, "dist-electron");
const sourcemap = process.env.NOVELCHAT_ELECTRON_SOURCEMAP === "1";

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const common = {
  bundle: true,
  external: ["electron"],
  format: "cjs",
  logLevel: "info",
  platform: "node",
  sourcemap,
  target: "node22",
};

await Promise.all([
  build({
    ...common,
    entryPoints: [path.join(root, "electron/main.ts")],
    outfile: path.join(outDir, "main.cjs"),
  }),
  build({
    ...common,
    entryPoints: [path.join(root, "electron/preload.ts")],
    outfile: path.join(outDir, "preload.cjs"),
  }),
]);

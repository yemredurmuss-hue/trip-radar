// Bundles the extension into dist/. Usage: node scripts/build.mjs [--watch]
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const watch = process.argv.includes("--watch");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });

const options = {
  entryPoints: {
    background: "src/background.ts",
    popup: "src/popup.tsx",
    app: "src/app/main.tsx",
  },
  outdir: "dist",
  bundle: true,
  format: "esm",
  // ES2022 keeps functions injected with chrome.scripting self-contained (no esbuild helpers).
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}

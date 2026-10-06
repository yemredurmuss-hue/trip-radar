// Bundles the extension into dist/. Usage: node scripts/build.mjs [--watch]
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });

// The trip map's library (src/app/map/maplibre.ts loads it only when a map opens, so app.js stays small): MapLibre's
// CSP build and its worker as files (an extension page may not run a worker made from a blob), its stylesheet and
// licence. Copied as published (already minified), without the source-map comment (the maps aren't shipped).
mkdirSync("dist/maplibre", { recursive: true });
for (const file of ["maplibre-gl-csp.js", "maplibre-gl-csp-worker.js", "maplibre-gl.css", "LICENSE.txt"]) {
  const text = readFileSync(`node_modules/maplibre-gl/dist/${file}`, "utf8");
  writeFileSync(`dist/maplibre/${file}`, text.replace(/\n?\/[/*][#@] sourceMappingURL=\S+?(\s*\*\/)?\s*$/, "\n"));
}

// The pages compare it with the loaded extension's version (src/lib/update.ts reloadIfStale).
const version = JSON.parse(readFileSync("static/manifest.json", "utf8")).version;

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
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"), __APP_VERSION__: JSON.stringify(version) },
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

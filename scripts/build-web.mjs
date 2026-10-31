// Bundles the board as a web page into dist-web/ (src/web/main.ts: the board and its worker in one page, extension APIs
// answered by src/web/chromeShim.ts). Usage: node scripts/build-web.mjs [--serve] [--out=dir] → http://localhost:8787
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const serve = process.argv.includes("--serve");
const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "dist-web";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync("static", out, { recursive: true });
// The extension's other page; the board is index.html (and app.html, the address the code opens it at).
rmSync(`${out}/popup.html`, { force: true });
cpSync(`${out}/app.html`, `${out}/index.html`);

// As in scripts/build.mjs: MapLibre and its worker as files, without the source-map comment.
mkdirSync(`${out}/maplibre`, { recursive: true });
for (const file of ["maplibre-gl-csp.js", "maplibre-gl-csp-worker.js", "maplibre-gl.css", "LICENSE.txt"]) {
  const text = readFileSync(`node_modules/maplibre-gl/dist/${file}`, "utf8");
  writeFileSync(`${out}/maplibre/${file}`, text.replace(/\n?\/[/*][#@] sourceMappingURL=\S+?(\s*\*\/)?\s*$/, "\n"));
}

const version = JSON.parse(readFileSync("static/manifest.json", "utf8")).version;

const options = {
  entryPoints: { app: "src/web/main.ts" },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": JSON.stringify(serve ? "development" : "production"), __APP_VERSION__: JSON.stringify(version) },
  minify: !serve,
  sourcemap: serve ? "inline" : false,
  logLevel: "info",
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 8787, host: "127.0.0.1" });
  console.log(`Trip Radar web: http://localhost:${port}`);
} else {
  await esbuild.build(options);
}

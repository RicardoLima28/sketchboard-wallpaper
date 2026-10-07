import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const out = "dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

await build({
  entryPoints: { main: "src/renderer/main.jsx" },
  bundle: true,
  format: "iife",
  minify: true,
  outdir: out,
  jsx: "automatic",
  loader: { ".woff2": "file", ".ttf": "file", ".png": "file", ".svg": "file" },
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  conditions: ["production"],
  logLevel: "warning",
});

for (const f of ["index.html", "LICENSE", "THIRD_PARTY_NOTICES.txt"]) cpSync(f, `${out}/${f}`);
cpSync("node_modules/@excalidraw/excalidraw/dist/prod/fonts", `${out}/fonts`, { recursive: true });
console.log("build ok");

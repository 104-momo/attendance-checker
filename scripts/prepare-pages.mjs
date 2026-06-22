/**
 * Convert @opennextjs/cloudflare Workers-mode output (.open-next/)
 * into Cloudflare Pages-compatible structure (.open-next-pages/).
 *
 * Pages expects:
 *   - Static assets at the deployment root
 *   - A single `_worker.js` file at root as the Pages Function entry
 *   - Optional `_routes.json` to control function invocation
 *   - Cache directory (for ISR/SSG) served as static files
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, ".open-next");
const DST = path.join(ROOT, ".open-next-pages");

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log("→ Cleaning", DST);
rmrf(DST);
fs.mkdirSync(DST, { recursive: true });

// 1) Static assets to root
const assetsSrc = path.join(SRC, "assets");
if (fs.existsSync(assetsSrc)) {
  console.log("→ Copying assets/* to", DST);
  copyDir(assetsSrc, DST);
}

// 2) Worker bundle + all its dependencies.
//    OpenNext's worker.js imports from ./cloudflare/*, ./server-functions/*, etc.
//    We need to copy ALL of .open-next/* (except assets, which are already at root)
//    to the Pages output, then rename worker.js → _worker.js.
const workerSrc = path.join(SRC, "worker.js");
if (!fs.existsSync(workerSrc)) {
  console.error("✘ Missing .open-next/worker.js — run `opennextjs-cloudflare build` first.");
  process.exit(1);
}

// Copy the whole .open-next directory EXCEPT assets/ (already copied above).
// Keep .build/ because worker.js imports from it (durable-objects, etc).
for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
  if (entry.name === "assets") continue;
  const s = path.join(SRC, entry.name);
  const d = path.join(DST, entry.name);
  if (entry.isDirectory()) copyDir(s, d);
  else fs.copyFileSync(s, d);
}
// Rename worker.js → _worker.js (Pages convention)
fs.renameSync(path.join(DST, "worker.js"), path.join(DST, "_worker.js"));
console.log("→ Copied worker.js + dependencies, renamed to _worker.js");

// 3) Cache directory (for ISR/SSG)
const cacheSrc = path.join(SRC, "cache");
if (fs.existsSync(cacheSrc)) {
  console.log("→ Copying cache/* → cache/");
  copyDir(cacheSrc, path.join(DST, "cache"));
}

// 4) _routes.json
const routes = {
  version: 1,
  include: ["/*"],
  exclude: [
    "/_next/static/*",
    "/_next/image/*",
    "/favicon.ico",
    "/logo.svg",
    "/robots.txt",
    "/BUILD_ID",
    "/cache/*",
  ],
};
fs.writeFileSync(path.join(DST, "_routes.json"), JSON.stringify(routes, null, 2));
console.log("→ Wrote _routes.json");

console.log("\n✓ Pages output ready at", DST);
console.log("  Deploy with: npx wrangler pages deploy .open-next-pages --project-name=attendance-checker");

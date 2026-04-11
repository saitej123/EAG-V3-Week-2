/**
 * Smoke-check after build: manifest, command name, and bundles exist.
 * Run: npm run verify
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const fail = (msg) => {
  console.error("verify-extension:", msg);
  process.exit(1);
};

if (!existsSync(join(dist, "manifest.json"))) fail("missing dist/manifest.json — run npm run build first");

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
if (manifest.name !== "FairFrame") fail(`expected manifest.name "FairFrame", got "${manifest.name}"`);
if (!manifest.commands?.["run-fairframe-review"])
  fail('expected manifest.commands["run-fairframe-review"]');

const bg = readFileSync(join(dist, "background.js"), "utf8");
if (!bg.includes("run-fairframe-review")) fail("background.js missing command handler string");

const content = readFileSync(join(dist, "content.js"), "utf8");
if (content.length < 500) fail("content.js unexpectedly small");

if (!existsSync(join(dist, "sidepanel.html"))) fail("missing dist/sidepanel.html");
if (!existsSync(join(dist, "options.html"))) fail("missing dist/options.html");

console.log("FairFrame verify: OK (manifest, bundles, and HTML present).");

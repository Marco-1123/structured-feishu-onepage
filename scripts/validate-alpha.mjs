#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runs = ["audit-assistant", "h1-review", "release-process"];
const expected = new Set(["capability-system", "review-dashboard", "process-system"]);
const selected = new Set();
const failures = [];

for (const run of runs) {
  const manifestPath = path.join(root, "runs", run, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    failures.push(`${run}: manifest missing`);
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.status !== "passed") failures.push(`${run}: status is ${manifest.status}`);
  if (!manifest.quality?.passed) failures.push(`${run}: quality gate did not pass`);
  if ((manifest.quality?.coverage?.importantCoverage ?? 0) !== 1) failures.push(`${run}: important content coverage is incomplete`);
  if ((manifest.quality?.preview?.aspectRatio ?? 0) < 1.25) failures.push(`${run}: preview is too tall`);
  selected.add(manifest.selection?.archetype);
}

for (const archetype of expected) if (!selected.has(archetype)) failures.push(`semantic regression: ${archetype} was not selected`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("ok: V6 alpha integration gate passed for 3 distinct source structures");

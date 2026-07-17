#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runs = ["audit-assistant", "h1-review", "release-process", "strategy-proposal", "decision-comparison", "project-plan", "complex-review"];
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
  if ((manifest.quality?.coverage?.allCoverage ?? 0) !== 1) failures.push(`${run}: source information coverage is incomplete`);
  if ((manifest.quality?.preview?.aspectRatio ?? 0) < 1.4) failures.push(`${run}: preview is too tall`);
  if ((manifest.quality?.semantics?.grammarCount ?? 0) < 1) failures.push(`${run}: no visual grammar was selected`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("ok: V6 Alpha.3 composition gate passed for 7 distinct source structures");

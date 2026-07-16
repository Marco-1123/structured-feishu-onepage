#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { planScenes } from "./scene-planner.mjs";
import { renderSceneToDsl } from "./dsl-renderer.mjs";
import { validateContentGraph, validateScene } from "./validate.mjs";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const graphPath = value("--graph");
const outputDir = value("--output-dir");
const skipRender = args.includes("--skip-render");

if (!graphPath || !outputDir) {
  console.error("usage: onepage-engine --graph content-graph.json --output-dir run-dir [--skip-render]");
  process.exit(1);
}

const out = path.resolve(outputDir);
const candidateDir = path.join(out, "candidates");
fs.mkdirSync(candidateDir, { recursive: true });
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const graphIssues = validateContentGraph(graph);
if (graphIssues.length) throw new Error(graphIssues.join("\n"));

const writeJson = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const candidates = planScenes(graph);
const manifest = {
  version: "6.0.0-alpha.1",
  pipeline: "onepage-engine-v6",
  maturity: "prototype",
  status: "running",
  graph: path.resolve(graphPath),
  candidates: [],
  outputs: {},
  startedAt: new Date().toISOString()
};

for (const scene of candidates) {
  const sceneIssues = validateScene(scene, graph);
  const record = { id: scene.sceneId, archetype: scene.archetype, semanticScore: scene.score, status: "planned", issues: [...sceneIssues] };
  const scenePath = path.join(candidateDir, `${scene.archetype}.scene.json`);
  const dslPath = path.join(candidateDir, `${scene.archetype}.whiteboard.json`);
  writeJson(scenePath, scene);
  if (!sceneIssues.length) {
    const dsl = renderSceneToDsl(scene, graph);
    writeJson(dslPath, dsl);
    record.outputs = { scene: scenePath, whiteboard: dslPath };
    if (!skipRender) {
      const previewPath = path.join(candidateDir, `${scene.archetype}.png`);
      const render = spawnSync("npx", ["-y", "@larksuite/whiteboard-cli@0.2.12", "-i", dslPath, "-o", previewPath], { encoding: "utf8" });
      if (render.status !== 0) record.issues.push((render.stderr || render.stdout || "whiteboard render failed").trim());
      else {
        record.outputs.preview = previewPath;
        record.status = "rendered";
      }
    } else record.status = "compiled";
  }
  manifest.candidates.push(record);
}

const accepted = manifest.candidates.filter((candidate) => ["rendered", "compiled"].includes(candidate.status) && !candidate.issues.length).sort((a, b) => b.semanticScore - a.semanticScore);
if (!accepted.length) {
  manifest.status = "failed";
  manifest.finishedAt = new Date().toISOString();
  writeJson(path.join(out, "manifest.json"), manifest);
  throw new Error("all V6 scene candidates failed");
}

const selected = accepted[0];
manifest.selection = { id: selected.id, archetype: selected.archetype, score: selected.semanticScore };
for (const [name, source] of Object.entries(selected.outputs)) {
  const extension = path.extname(source);
  const target = path.join(out, name === "whiteboard" ? "whiteboard.json" : name === "preview" ? "whiteboard.png" : `scene${extension}`);
  fs.copyFileSync(source, target);
  manifest.outputs[name] = target;
}
manifest.status = "passed";
manifest.finishedAt = new Date().toISOString();
writeJson(path.join(out, "manifest.json"), manifest);
console.log(`ok: V6 ${selected.archetype} -> ${out}`);


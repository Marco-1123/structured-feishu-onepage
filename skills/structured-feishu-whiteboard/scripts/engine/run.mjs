#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compileComposition } from "./composition-compiler.mjs";
import { renderCompositionToSvg } from "./composition-svg-renderer.mjs";
import { validateContentGraph } from "./validate.mjs";
import { verifySealedGraph } from "./extraction.mjs";
import {
  buildCompositionCoverage,
  runWhiteboardCheck,
  validateCompositionQuality,
  validatePreview,
  validateSourceGrounding
} from "./quality-gate.mjs";

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
fs.mkdirSync(out, { recursive: true });
const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const graphIssues = [...validateContentGraph(graph), ...verifySealedGraph(graph), ...validateSourceGrounding(graph)];
if (graphIssues.length) throw new Error(graphIssues.join("\n"));

const writeJson = (file, data) => fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const composition = compileComposition(graph);
const svg = renderCompositionToSvg(composition);
const compositionPath = path.join(out, "composition.json");
const svgPath = path.join(out, "whiteboard.svg");
const previewPath = path.join(out, "whiteboard.png");
const whiteboardPath = path.join(out, "whiteboard.json");
writeJson(compositionPath, composition);
fs.writeFileSync(svgPath, svg);

const manifest = {
  version: "6.0.0-alpha.3",
  pipeline: "composition-compiler-v1",
  maturity: "prototype",
  status: "running",
  graph: path.resolve(graphPath),
  composition: compositionPath,
  outputs: { composition: compositionPath, svg: svgPath },
  startedAt: new Date().toISOString()
};

const semanticGate = validateCompositionQuality(composition, graph);
manifest.quality = {
  semantics: semanticGate.metrics,
  coverage: buildCompositionCoverage(composition, graph)
};
const issues = [...semanticGate.issues];

if (!skipRender) {
  const render = spawnSync("npx", ["-y", "@larksuite/whiteboard-cli@0.2.12", "-i", svgPath, "-o", previewPath, "-s", "1"], { encoding: "utf8" });
  if (render.status !== 0) issues.push((render.stderr || render.stdout || "whiteboard render failed").trim());
  const convert = spawnSync("npx", ["-y", "@larksuite/whiteboard-cli@0.2.12", "-i", svgPath, "-t", "openapi", "-o", whiteboardPath], { encoding: "utf8" });
  if (convert.status !== 0) issues.push((convert.stderr || convert.stdout || "whiteboard conversion failed").trim());
  if (!issues.length) {
    const previewGate = validatePreview(previewPath);
    const whiteboardGate = runWhiteboardCheck(svgPath);
    manifest.quality.preview = previewGate.metrics;
    manifest.quality.whiteboard = whiteboardGate.metrics;
    issues.push(...previewGate.issues, ...whiteboardGate.issues);
    manifest.outputs.preview = previewPath;
    manifest.outputs.whiteboard = whiteboardPath;
  }
}

manifest.issues = issues;
manifest.quality.passed = issues.length === 0;
manifest.status = issues.length ? "failed" : "passed";
manifest.finishedAt = new Date().toISOString();
writeJson(path.join(out, "manifest.json"), manifest);
if (issues.length) throw new Error(issues.join("\n"));
console.log(`ok: V6 Alpha.3 composition -> ${out}`);

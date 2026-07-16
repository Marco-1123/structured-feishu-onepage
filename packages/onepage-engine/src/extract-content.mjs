#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { buildDraftTemplate, buildExtractionPacket, sealDraft } from "./extraction.mjs";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourcePath = value("--source");
const outputDir = value("--output-dir");
const draftPath = value("--draft");
if (!sourcePath || !outputDir) {
  console.error("usage: extract-content --source source.md --output-dir extraction-dir [--draft content-draft.json]");
  process.exit(1);
}

const out = path.resolve(outputDir);
fs.mkdirSync(out, { recursive: true });
const sourceRef = path.relative(process.cwd(), path.resolve(sourcePath));
const source = fs.readFileSync(sourcePath, "utf8");
const packet = buildExtractionPacket(source, sourceRef);
fs.writeFileSync(path.join(out, "extraction-packet.json"), `${JSON.stringify(packet, null, 2)}\n`);

if (!draftPath) {
  const graphId = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "") || "onepage";
  fs.writeFileSync(path.join(out, "content-draft.json"), `${JSON.stringify(buildDraftTemplate(packet, graphId), null, 2)}\n`);
  console.log(`prepared: ${packet.units.length} evidence units -> ${out}`);
  process.exit(0);
}

const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
const result = sealDraft(packet, draft);
if (result.issues.length) {
  console.error(result.issues.join("\n"));
  process.exit(1);
}
fs.writeFileSync(path.join(out, "content-graph.json"), `${JSON.stringify(result.graph, null, 2)}\n`);
console.log(`sealed: ${result.graph.nodes.length} nodes from ${packet.units.length} reviewed units -> ${out}`);

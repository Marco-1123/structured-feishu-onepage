import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentGraph } from "../../../skills/structured-feishu-whiteboard/scripts/engine/validate.mjs";
import { compileComposition } from "../../../skills/structured-feishu-whiteboard/scripts/engine/composition-compiler.mjs";
import { renderCompositionToSvg } from "../../../skills/structured-feishu-whiteboard/scripts/engine/composition-svg-renderer.mjs";
import { buildCompositionCoverage, validateCompositionQuality, validateSourceGrounding } from "../../../skills/structured-feishu-whiteboard/scripts/engine/quality-gate.mjs";
import { buildDraftTemplate, buildExtractionPacket, sealDraft, verifySealedGraph } from "../../../skills/structured-feishu-whiteboard/scripts/engine/extraction.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const readGraph = (name) => JSON.parse(fs.readFileSync(path.join(root, "examples", name, "content-graph.json"), "utf8"));
const graph = readGraph("audit-assistant");

test("content graph remains source-grounded and sealed", () => {
  assert.deepEqual(validateContentGraph(graph), []);
  assert.deepEqual(validateSourceGrounding(graph, root), []);
  assert.deepEqual(verifySealedGraph(graph, root), []);
});

test("evidence ledger blocks unreviewed and protected source loss", () => {
  const sourceRef = "examples/audit-assistant/source.md";
  const packet = buildExtractionPacket(fs.readFileSync(path.join(root, sourceRef), "utf8"), sourceRef);
  const template = buildDraftTemplate(packet, "negative-test");
  assert.match(sealDraft(packet, template).issues.join("\n"), /has not been reviewed/);
  const dropped = structuredClone(template);
  dropped.sourceDecisions = packet.units.map((item) => ({ unitId: item.id, decision: "drop", nodeIds: [], reason: "重复信息可以删除" }));
  assert.match(sealDraft(packet, dropped).issues.join("\n"), /protected information and cannot be dropped/);
});

test("composition compiler preserves facts while aggregating visual units", () => {
  const composition = compileComposition(graph);
  const coverage = buildCompositionCoverage(composition, graph);
  assert.equal(coverage.importantCoverage, 1);
  assert.equal(coverage.allCoverage, 1);
  assert.ok(composition.units.length < graph.nodes.length);
  assert.ok(composition.grammarTypes.length >= 4);
  assert.deepEqual(validateCompositionQuality(composition, graph).issues, []);
});

test("renderer uses distinct visual grammar instead of a uniform card grid", () => {
  const richGraph = structuredClone(graph);
  richGraph.nodes.push({
    id: "trend-render-test",
    kind: "trend",
    headline: "周度闭环率持续提升",
    detail: "W1 41% -> W2 46% -> W3 53% -> W4 61%",
    importance: "medium",
    sourceQuote: "周度闭环率持续提升",
    sourceUnitIds: [richGraph.sourceDecisions[0].unitId]
  });
  const composition = compileComposition(richGraph);
  const svg = renderCompositionToSvg(composition);
  assert.match(svg, /<polyline/);
  assert.match(svg, /端到端工作链路/);
  assert.match(svg, /能力与系统架构/);
  assert.match(svg, /<circle/);
  assert.doesNotMatch(svg, /gradient|filter=|opacity=|clipPath|mask=/);
});

test("diverse corpus compiles through the single composition path", () => {
  for (const name of ["audit-assistant", "h1-review", "release-process", "strategy-proposal", "decision-comparison", "project-plan", "complex-review"]) {
    const item = readGraph(name);
    assert.deepEqual(validateContentGraph(item), [], name);
    assert.deepEqual(verifySealedGraph(item, root), [], name);
    const composition = compileComposition(item);
    assert.equal(buildCompositionCoverage(composition, item).importantCoverage, 1, name);
    assert.ok(composition.units.length >= 1, name);
  }
});

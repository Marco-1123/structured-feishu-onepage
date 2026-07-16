import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentGraph, validateScene } from "../src/validate.mjs";
import { planScenes } from "../src/scene-planner.mjs";
import { renderSceneToDsl } from "../src/dsl-renderer.mjs";
import { buildCoverage, validateSemanticComposition, validateSourceGrounding } from "../src/quality-gate.mjs";
import { buildDraftTemplate, buildExtractionPacket, sealDraft, verifySealedGraph } from "../src/extraction.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const graph = JSON.parse(fs.readFileSync(path.join(root, "examples/audit-assistant/content-graph.json"), "utf8"));
const reviewGraph = JSON.parse(fs.readFileSync(path.join(root, "examples/h1-review/content-graph.json"), "utf8"));
const processGraph = JSON.parse(fs.readFileSync(path.join(root, "examples/release-process/content-graph.json"), "utf8"));

test("content graph is source-grounded and valid", () => {
  assert.deepEqual(validateContentGraph(graph), []);
  assert.deepEqual(validateSourceGrounding(graph, root), []);
  assert.deepEqual(verifySealedGraph(graph, root), []);
  assert.ok(graph.nodes.every((node) => node.sourceQuote));
});

test("evidence ledger blocks unreviewed and protected source loss", () => {
  const sourceRef = "examples/audit-assistant/source.md";
  const packet = buildExtractionPacket(fs.readFileSync(path.join(root, sourceRef), "utf8"), sourceRef);
  const template = buildDraftTemplate(packet, "negative-test");
  assert.match(sealDraft(packet, template).issues.join("\n"), /has not been reviewed/);
  const dropped = structuredClone(template);
  dropped.sourceDecisions = packet.units.map((unit) => ({ unitId: unit.id, decision: "drop", nodeIds: [], reason: "重复信息可以删除" }));
  assert.match(sealDraft(packet, dropped).issues.join("\n"), /protected information and cannot be dropped/);
});

test("planner produces distinct semantic candidates and selects capability system", () => {
  const scenes = planScenes(graph);
  assert.equal(scenes.length, 4);
  assert.equal(new Set(scenes.map((scene) => scene.archetype)).size, 4);
  assert.equal(scenes[0].archetype, "capability-system");
  for (const scene of scenes) assert.deepEqual(validateScene(scene, graph), []);
  const governance = scenes[0].regions.find((region) => region.id === "actions");
  assert.equal(governance.title, "下一阶段与边界");
  assert.ok(governance.nodeIds.includes("r1"));
  assert.equal(scenes[0].regions.some((region) => region.id === "risks"), false);
});

test("native DSL uses Flex and Dagre without SVG coordinates", () => {
  const scene = planScenes(graph)[0];
  const dsl = renderSceneToDsl(scene, graph);
  const serialized = JSON.stringify(dsl);
  assert.equal(dsl.version, 2);
  assert.match(serialized, /"layout":"vertical"/);
  assert.match(serialized, /"layout":"horizontal"/);
  assert.match(serialized, /"layout":"dagre"/);
  assert.doesNotMatch(serialized, /<svg/);
  assert.ok(scene.sourceNodeIds.length === graph.nodes.length);
  assert.equal(buildCoverage(scene, graph).importantCoverage, 1);
  assert.deepEqual(validateSemanticComposition(scene, graph).issues, []);
});

test("different source structures select different scene archetypes", () => {
  assert.deepEqual(validateContentGraph(reviewGraph), []);
  assert.deepEqual(validateContentGraph(processGraph), []);
  assert.equal(planScenes(reviewGraph)[0].archetype, "review-dashboard");
  assert.equal(planScenes(processGraph)[0].archetype, "process-system");
  const processDsl = JSON.stringify(renderSceneToDsl(planScenes(processGraph)[0], processGraph));
  assert.match(processDsl, /"rankdir":"LR"/);
  assert.doesNotMatch(processDsl, /"rankdir":"TB"/);
});

test("six-source blind corpus is sealed and semantically routed", () => {
  const expected = {
    "audit-assistant": "capability-system",
    "h1-review": "review-dashboard",
    "release-process": "process-system",
    "strategy-proposal": "process-system",
    "decision-comparison": "information-map",
    "project-plan": "process-system"
  };
  for (const [name, archetype] of Object.entries(expected)) {
    const item = JSON.parse(fs.readFileSync(path.join(root, "examples", name, "content-graph.json"), "utf8"));
    assert.deepEqual(validateContentGraph(item), [], name);
    assert.deepEqual(verifySealedGraph(item, root), [], name);
    assert.equal(planScenes(item)[0].archetype, archetype, name);
  }
});

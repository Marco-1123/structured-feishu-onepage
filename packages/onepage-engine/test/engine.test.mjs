import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateContentGraph } from "../../../skills/structured-feishu-whiteboard/scripts/engine/validate.mjs";
import { compileComposition } from "../../../skills/structured-feishu-whiteboard/scripts/engine/composition-compiler.mjs";
import { renderCompositionToSvg } from "../../../skills/structured-feishu-whiteboard/scripts/engine/composition-svg-renderer.mjs";
import { buildCompositionCoverage, validateCompositionQuality, validateSourceGrounding, validateSvgReadability, validateSvgSemantics } from "../../../skills/structured-feishu-whiteboard/scripts/engine/quality-gate.mjs";
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
    const svg = renderCompositionToSvg(composition);
    assert.deepEqual(validateSvgSemantics(svg, item).issues, [], name);
    assert.deepEqual(validateSvgReadability(svg).issues, [], name);
  }
});

test("renderer never invents a recommendation from option order", () => {
  const item = readGraph("decision-comparison");
  const options = item.nodes.filter((node) => node.kind === "option");
  options[1].recommended = true;
  const svg = renderCompositionToSvg(compileComposition(item));
  const group = (id) => svg.match(new RegExp(`<g data-source-node-id="${id}">([\\s\\S]*?)<\\/g>`))?.[1] || "";
  assert.doesNotMatch(group(options[0].id), /stroke="#3370FF"[^>]*stroke-width="2.5"/);
  assert.match(group(options[1].id), /stroke="#3370FF"[^>]*stroke-width="2.5"/);
});

test("risk rendering preserves the source risk and explicit control as separate meanings", () => {
  const item = readGraph("complex-review");
  const risk = item.nodes.find((node) => node.kind === "risk");
  risk.version = undefined;
  risk.riskLevel = "high";
  risk.control = "保留双口径对照 8 周";
  const composition = compileComposition(item);
  const pair = composition.units.find((unit) => unit.type === "risk-control").pairs.find((entry) => entry.sourceNodeId === risk.id);
  assert.equal(pair.risk, risk.headline);
  assert.equal(pair.control, risk.control);
  const svg = renderCompositionToSvg(composition);
  const group = svg.match(new RegExp(`<g data-source-node-id="${risk.id}">([\\s\\S]*?)<\\/g>`))?.[1] || "";
  assert.match(group, new RegExp(risk.headline));
  assert.match(group, /控制措施：保留双口径对照 8 周/);
});

test("graph relationships materially affect the selected visual grammar", () => {
  const item = readGraph("release-process");
  const withEdges = compileComposition(item);
  assert.ok(withEdges.grammarTypes.includes("process-chain"));
  const withoutEdges = structuredClone(item);
  withoutEdges.edges = withoutEdges.edges.filter((edge) => edge.type !== "precedes");
  assert.ok(!compileComposition(withoutEdges).grammarTypes.includes("process-chain"));
});

test("sparse singleton signals are composed into one balanced mixed-grammar section", () => {
  const composition = compileComposition(readGraph("strategy-proposal"));
  const cluster = composition.units.find((unit) => unit.type === "insight-cluster");
  assert.ok(cluster);
  assert.ok(cluster.entries.length >= 3);
  assert.ok(cluster.entries.some((entry) => entry.type === "maturity-bars"));
  assert.ok(!composition.units.some((unit) => ["layer-stack", "maturity-bars", "cause-map", "evidence-ledger"].includes(unit.type) && unit.nodes.length === 1));
});

test("Alpha.5 seal rejects semantic mutation after review", () => {
  const source = "# 方案评审\n\n方案 A 成本 10，方案 B 成本 8，推荐方案 B。\n\n高风险是权限延误，控制措施是提前锁定评审。";
  const sourceRef = "inline-review.md";
  const packet = buildExtractionPacket(source, sourceRef);
  const draft = buildDraftTemplate(packet, "seal-integrity");
  draft.nodes = [
    { id: "o1", kind: "option", headline: "方案 A 成本 10", detail: "成本较高", importance: "medium", sourceQuote: "方案 A 成本 10", sourceUnitIds: ["U01"] },
    { id: "o2", kind: "option", headline: "方案 B 成本 8", detail: "推荐方案 B", importance: "high", recommended: true, sourceQuote: "方案 B 成本 8", sourceUnitIds: ["U01"] },
    { id: "r1", kind: "risk", headline: "权限延误", detail: "影响评审排期", importance: "high", riskLevel: "high", control: "提前锁定评审", sourceQuote: "风险是权限延误", sourceUnitIds: ["U02"] }
  ];
  draft.sourceDecisions = [
    { unitId: "U01", decision: "preserve", nodeIds: ["o1", "o2"], reason: "保留方案结论" },
    { unitId: "U02", decision: "preserve", nodeIds: ["r1"], reason: "保留风险控制" }
  ];
  const sealed = sealDraft(packet, draft);
  assert.deepEqual(sealed.issues, []);
  const changed = structuredClone(sealed.graph);
  changed.nodes[1].detail = "成本 999，推荐方案 A";
  const tempDir = fs.mkdtempSync(path.join(root, ".tmp-seal-"));
  const sourcePath = path.join(tempDir, sourceRef);
  fs.writeFileSync(sourcePath, source);
  changed.sourceRef = sourcePath;
  assert.match(verifySealedGraph(changed, root).join("\n"), /uncited numeric token 999|changed after it was sealed/);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("Alpha.5 preserves numeric polarity and blocks undecided recommendations", () => {
  const source = "# 评审\n\n转化率下降 5%，尚未决定推荐方案。";
  const packet = buildExtractionPacket(source, "inline.md");
  const draft = buildDraftTemplate(packet, "polarity-test");
  draft.nodes = [{ id: "o1", kind: "option", headline: "方案 A", detail: "转化率提升 5%", importance: "high", recommended: true, measure: { display: "+5%", unit: "%", direction: "up" }, sourceQuote: "转化率下降 5%", sourceUnitIds: ["U01"] }];
  draft.sourceDecisions = [{ unitId: "U01", decision: "preserve", nodeIds: ["o1"], reason: "保留评审信息" }];
  const issues = sealDraft(packet, draft).issues.join("\n");
  assert.match(issues, /uncited numeric token \+?5%|unsupported numeric token \+?5%|marked recommended/);
  assert.match(issues, /marked recommended/);
});

test("trend renderer preserves period labels and original units", () => {
  const item = structuredClone(graph);
  item.nodes.push({ id: "trend-minute", kind: "trend", headline: "响应耗时持续下降", detail: "W1 38 min -> W2 24 min -> W3 14 min", importance: "medium", sourceQuote: "响应耗时持续下降", sourceUnitIds: [item.sourceDecisions[0].unitId] });
  const svg = renderCompositionToSvg(compileComposition(item));
  assert.match(svg, />W1</);
  assert.match(svg, />38min</);
  assert.match(svg, />14min</);
  assert.doesNotMatch(svg, />38%</);
});

test("risk without control and unresolved decisions keep their original semantics", () => {
  const item = structuredClone(graph);
  item.nodes.push(
    { id: "r-no-control", kind: "risk", headline: "依赖接口延期", detail: "可能影响联调窗口", importance: "high", sourceQuote: "依赖接口延期", sourceUnitIds: [item.sourceDecisions[0].unitId] },
    { id: "u-decision", kind: "unresolved", headline: "部署方式待定", detail: "需要架构委员会确认", importance: "medium", sourceQuote: "部署方式待定", sourceUnitIds: [item.sourceDecisions[0].unitId] }
  );
  const svg = renderCompositionToSvg(compileComposition(item));
  const risk = svg.match(/<g data-source-node-id="r-no-control">([\s\S]*?)<\/g>/)?.[1] || "";
  const decision = svg.match(/<g data-source-node-id="u-decision">([\s\S]*?)<\/g>/)?.[1] || "";
  assert.match(risk, /可能影响联调窗口/);
  assert.doesNotMatch(risk, /控制措施/);
  assert.match(decision, /待决策/);
  assert.doesNotMatch(decision, /控制措施/);
});

test("directed precedes edges determine the visible process order", () => {
  const item = readGraph("release-process");
  const forward = renderCompositionToSvg(compileComposition(item));
  const reversed = structuredClone(item);
  reversed.edges = reversed.edges.map((edge) => edge.type === "precedes" ? { ...edge, from: edge.to, to: edge.from } : edge);
  const backward = renderCompositionToSvg(compileComposition(reversed));
  assert.notEqual(forward, backward);
});

test("a single metric participates in the normal grid instead of reserving a full row", () => {
  const item = structuredClone(graph);
  item.nodes = item.nodes.filter((node) => !["metric", "result"].includes(node.kind) || node.id === item.nodes.find((candidate) => ["metric", "result"].includes(candidate.kind))?.id);
  const composition = compileComposition(item);
  const metric = composition.units.find((unit) => unit.type === "metric-band");
  assert.equal(metric.span, 4);
  assert.ok(!validateCompositionQuality(composition, item).issues.includes("a single metric must not reserve a full-width row"));
});

test("Feishu round-trip gate rejects visible style drift", () => {
  const tempDir = fs.mkdtempSync(path.join(root, ".tmp-roundtrip-"));
  const generatedPath = path.join(tempDir, "generated.json");
  const queriedPath = path.join(tempDir, "queried.json");
  const textNode = {
    id: "text-1",
    type: "text",
    x: 100,
    y: 100,
    width: 320,
    height: 48,
    text: { text: "核心判断", font_size: 24, font_weight: "bold", text_color: "#1F2329" }
  };
  fs.writeFileSync(generatedPath, JSON.stringify({ nodes: [textNode] }));
  fs.writeFileSync(queriedPath, JSON.stringify({ nodes: [{ ...textNode, text: { ...textNode.text, font_size: 18 } }] }));
  const now = Date.now() / 1000;
  fs.utimesSync(generatedPath, now, now);
  fs.utimesSync(queriedPath, now + 1, now + 1);
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "validate-feishu-roundtrip.mjs"), "--generated", generatedPath, "--queried", queriedPath], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /changed font size/);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

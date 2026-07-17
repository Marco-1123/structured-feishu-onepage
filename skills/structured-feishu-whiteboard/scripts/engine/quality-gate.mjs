import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const IMPORTANT = new Set(["critical", "high", "medium"]);

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLowerCase();
}

export function validateSourceGrounding(graph, cwd = process.cwd()) {
  const issues = [];
  const sourcePath = path.isAbsolute(graph.sourceRef) ? graph.sourceRef : path.resolve(cwd, graph.sourceRef);
  if (!fs.existsSync(sourcePath)) return [`source snapshot not found: ${sourcePath}`];

  const source = normalize(fs.readFileSync(sourcePath, "utf8"));
  for (const node of graph.nodes.filter((item) => IMPORTANT.has(item.importance))) {
    const quote = normalize(node.sourceQuote);
    if (quote.length < 4) issues.push(`node ${node.id} has an unusably short source quote`);
    else if (!source.includes(quote)) issues.push(`node ${node.id} is not grounded in the source snapshot`);
  }
  return issues;
}

export function readPngSize(file) {
  const data = fs.readFileSync(file);
  if (data.length < 24 || data.toString("ascii", 1, 4) !== "PNG") throw new Error(`invalid PNG preview: ${file}`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

export function validatePreview(file) {
  const { width, height } = readPngSize(file);
  const ratio = width / height;
  const issues = [];
  if (width < 1600) issues.push(`preview width is too small: ${width}px`);
  if (ratio < 1.4) issues.push(`onepage is too tall: aspect ratio ${ratio.toFixed(2)}`);
  if (ratio > 2.1) issues.push(`onepage is too wide: aspect ratio ${ratio.toFixed(2)}`);
  return { issues, metrics: { width, height, aspectRatio: Number(ratio.toFixed(3)) } };
}

export function validateCompositionQuality(composition, graph) {
  const issues = [];
  const visible = new Set(composition.sourceNodeIds);
  const important = graph.nodes.filter((node) => IMPORTANT.has(node.importance));
  const complex = graph.nodes.length >= 18;
  const grammars = new Set(composition.grammarTypes);
  if (important.some((node) => !visible.has(node.id))) issues.push("composition drops important source nodes");
  if (composition.sourceNodeIds.length !== graph.nodes.length) issues.push("composition does not preserve every semantic node");
  if (complex && grammars.size < 5) issues.push(`complex OnePage uses only ${grammars.size} visual grammars`);
  if (complex && composition.units.length < 6) issues.push("complex OnePage has insufficient visual structure");
  if (complex && composition.units.length >= graph.nodes.length * 0.75) issues.push("semantic facts were not aggregated into visual units");
  const kinds = new Set(graph.nodes.map((node) => node.kind));
  if (kinds.has("trend") && !grammars.has("trend-chart")) issues.push("available trend data was not rendered as a trend chart");
  if (graph.nodes.filter((node) => ["input", "stage", "output"].includes(node.kind)).length >= 3 && !grammars.has("process-chain")) issues.push("available process data was not rendered as a process chain");
  if (kinds.has("option") && !grammars.has("option-comparison")) issues.push("available options were not rendered as a comparison");
  const rows = [];
  for (const unit of composition.units.filter((item) => item.type !== "metric-band")) {
    let row = rows.find((item) => item.used + unit.span <= 12);
    if (!row) {
      row = { used: 0, types: [] };
      rows.push(row);
    }
    row.used += unit.span;
    row.types.push(unit.type);
  }
  const rowOccupancy = rows.map((row) => row.used / 12);
  const averageRowOccupancy = rowOccupancy.length ? rowOccupancy.reduce((sum, value) => sum + value, 0) / rowOccupancy.length : 1;
  if (rowOccupancy.some((value) => value < 2 / 3)) issues.push("composition leaves a structural hole larger than one third of a row");
  if (averageRowOccupancy < 0.82) issues.push(`composition row occupancy is too low: ${averageRowOccupancy.toFixed(2)}`);
  return {
    issues,
    metrics: {
      grammarCount: grammars.size,
      grammarTypes: [...grammars],
      visualUnitCount: composition.units.length,
      semanticNodeCount: graph.nodes.length,
      aggregationRatio: Number((composition.units.length / graph.nodes.length).toFixed(3)),
      rowOccupancy: rowOccupancy.map((value) => Number(value.toFixed(3))),
      averageRowOccupancy: Number(averageRowOccupancy.toFixed(3))
    }
  };
}

export function buildCompositionCoverage(composition, graph) {
  const visible = new Set(composition.sourceNodeIds);
  const important = graph.nodes.filter((node) => IMPORTANT.has(node.importance));
  return {
    importantNodes: important.length,
    coveredImportantNodes: important.filter((node) => visible.has(node.id)).length,
    importantCoverage: important.length ? important.filter((node) => visible.has(node.id)).length / important.length : 1,
    allNodes: graph.nodes.length,
    coveredNodes: graph.nodes.filter((node) => visible.has(node.id)).length,
    allCoverage: graph.nodes.length ? graph.nodes.filter((node) => visible.has(node.id)).length / graph.nodes.length : 1
  };
}

export function runWhiteboardCheck(input, cwd = process.cwd()) {
  const result = spawnSync(
    "npx",
    ["-y", "@larksuite/whiteboard-cli@0.2.12", "-i", input, "--check"],
    { cwd, encoding: "utf8" }
  );
  if (result.status !== 0) return { issues: [(result.stderr || result.stdout || "whiteboard check failed").trim()], metrics: {} };
  try {
    const report = JSON.parse(result.stdout);
    const check = report?.data?.check;
    if (!check) return { issues: ["whiteboard check returned no report"], metrics: {} };
    const issues = [];
    if (check.errors) issues.push(`whiteboard check found ${check.errors} errors`);
    if ((check.summary?.textOcclusion || 0) > 0) issues.push(`whiteboard check found ${check.summary.textOcclusion} text occlusions`);
    return {
      issues,
      metrics: {
        errors: check.errors,
        warnings: check.warnings,
        ...(check.summary || {}),
        nodeCount: report?.data?.metadata?.nodeCount || 0,
        connectorCount: report?.data?.metadata?.connectorCount || 0
      }
    };
  } catch {
    return { issues: ["whiteboard check returned invalid JSON"], metrics: {} };
  }
}

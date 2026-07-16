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
  if (ratio < 1.25) issues.push(`onepage is too tall: aspect ratio ${ratio.toFixed(2)}`);
  if (ratio > 1.85) issues.push(`onepage is too wide: aspect ratio ${ratio.toFixed(2)}`);
  return { issues, metrics: { width, height, aspectRatio: Number(ratio.toFixed(3)) } };
}

export function validateSemanticComposition(scene, graph) {
  const issues = [];
  const roles = new Set(scene.regions.map((region) => region.role));
  if (roles.size < 3) issues.push(`scene has insufficient semantic variety: ${roles.size} region roles`);
  const hasMetrics = graph.nodes.some((node) => ["metric", "trend", "result"].includes(node.kind));
  const hasProcess = graph.nodes.some((node) => ["input", "stage", "output"].includes(node.kind));
  if (hasMetrics && !roles.has("metrics")) issues.push("scene fails to visualize available metrics");
  if (hasProcess && !roles.has("process")) issues.push("scene fails to visualize an available process");
  return { issues, metrics: { regionRoles: [...roles], regionCount: scene.regions.length } };
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
    if (check.warnings) issues.push(`whiteboard check found ${check.warnings} warnings`);
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

export function buildCoverage(scene, graph) {
  const visible = new Set(scene.sourceNodeIds);
  const important = graph.nodes.filter((node) => IMPORTANT.has(node.importance));
  const covered = important.filter((node) => visible.has(node.id));
  return {
    importantNodes: important.length,
    coveredImportantNodes: covered.length,
    importantCoverage: important.length ? covered.length / important.length : 1,
    allNodes: graph.nodes.length,
    coveredNodes: graph.nodes.filter((node) => visible.has(node.id)).length
  };
}

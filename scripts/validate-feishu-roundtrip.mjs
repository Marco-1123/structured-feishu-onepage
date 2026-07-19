#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const generatedPath = value("--generated");
const queriedPath = value("--queried");
if (!generatedPath || !queriedPath) {
  console.error("usage: validate-feishu-roundtrip.mjs --generated <whiteboard.json> --queried <fresh-feishu-query.json>");
  process.exit(2);
}

const absoluteGenerated = path.resolve(generatedPath);
const absoluteQueried = path.resolve(queriedPath);
const generatedBytes = fs.readFileSync(absoluteGenerated);
const queriedBytes = fs.readFileSync(absoluteQueried);
const read = (bytes) => {
  const parsed = JSON.parse(bytes.toString("utf8"));
  return parsed?.data?.nodes ? parsed.data : parsed;
};
const generated = read(generatedBytes);
const queried = read(queriedBytes);
const failures = [];
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
if (absoluteGenerated === absoluteQueried || sha(generatedBytes) === sha(queriedBytes)) failures.push("queried board is not an independent Feishu round-trip result");
if (fs.statSync(absoluteQueried).mtimeMs < fs.statSync(absoluteGenerated).mtimeMs) failures.push("queried board predates the generated board; run a fresh Feishu query");

const countBy = (nodes, key) => nodes.reduce((map, node) => map.set(node[key] || "<missing>", (map.get(node[key] || "<missing>") || 0) + 1), new Map());
const expectedTypes = countBy(generated.nodes || [], "type");
const actualTypes = countBy(queried.nodes || [], "type");
for (const [type, count] of expectedTypes) if ((actualTypes.get(type) || 0) !== count) failures.push(`Feishu changed ${type} count: ${count} -> ${actualTypes.get(type) || 0}`);

const groupedText = (board) => {
  const map = new Map();
  for (const node of board.nodes || []) {
    const text = node.text?.text;
    if (!text) continue;
    if (!map.has(text)) map.set(text, []);
    map.get(text).push(node);
  }
  for (const nodes of map.values()) nodes.sort((a, b) => a.y - b.y || a.x - b.x);
  return map;
};
const expectedTexts = groupedText(generated);
const actualTexts = groupedText(queried);
const close = (a, b, tolerance) => Math.abs((Number(a) || 0) - (Number(b) || 0)) <= tolerance;
for (const [text, expected] of expectedTexts) {
  const actual = actualTexts.get(text) || [];
  if (actual.length !== expected.length) {
    failures.push(`Feishu changed visible text multiplicity: ${text}`);
    continue;
  }
  expected.forEach((before, index) => {
    const after = actual[index];
    if (before.text.font_size !== after.text.font_size) failures.push(`Feishu changed font size for “${text}”: ${before.text.font_size} -> ${after.text.font_size}`);
    if (before.text.font_weight !== after.text.font_weight) failures.push(`Feishu changed font weight for “${text}”`);
    if ((before.text.text_color || "").toLowerCase() !== (after.text.text_color || "").toLowerCase()) failures.push(`Feishu changed text color for “${text}”`);
    if (!close(before.x, after.x, 2) || !close(before.y, after.y, 16) || !close(before.width, after.width, 16)) failures.push(`Feishu changed text geometry for “${text}”`);
  });
}

const connectors = (board) => (board.nodes || []).filter((node) => node.type === "connector").sort((a, b) => a.y - b.y || a.x - b.x);
const beforeConnectors = connectors(generated);
const afterConnectors = connectors(queried);
beforeConnectors.forEach((before, index) => {
  const after = afterConnectors[index];
  if (!after) return;
  if (!["x", "y", "width", "height"].every((key) => close(before[key], after[key], 2))) failures.push(`Feishu changed connector geometry at index ${index}`);
  if (before.connector?.start?.arrow_style !== after.connector?.start?.arrow_style || before.connector?.end?.arrow_style !== after.connector?.end?.arrow_style) failures.push(`Feishu changed connector arrows at index ${index}`);
});

const minimumFontSize = Math.min(...(queried.nodes || []).filter((node) => node.text?.text).map((node) => Number(node.text.font_size) || 0));
if (!Number.isFinite(minimumFontSize) || minimumFontSize < 16) failures.push(`Feishu contains text below 16px: ${minimumFontSize}`);
if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log(`ok: independent Feishu round-trip preserved ${(generated.nodes || []).length} nodes, ${[...expectedTexts.values()].reduce((sum, nodes) => sum + nodes.length, 0)} text elements, styles, geometry, connectors, and ${minimumFontSize}px minimum type`);

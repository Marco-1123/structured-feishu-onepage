#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
const generatedPath = value("--generated");
const queriedPath = value("--queried");

if (!generatedPath || !queriedPath) {
  console.error("usage: validate-feishu-roundtrip.mjs --generated <whiteboard.json> --queried <feishu-roundtrip.json>");
  process.exit(2);
}

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const generated = read(generatedPath);
const queried = read(queriedPath);
const failures = [];

function textMultiset(board) {
  const counts = new Map();
  for (const node of board.nodes || []) {
    const text = node.text?.text;
    if (!text) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  return counts;
}

function bounds(board) {
  const nodes = board.nodes || [];
  return {
    left: Math.min(...nodes.map((node) => Number(node.x) || 0)),
    top: Math.min(...nodes.map((node) => Number(node.y) || 0)),
    right: Math.max(...nodes.map((node) => (Number(node.x) || 0) + (Number(node.width) || 0))),
    bottom: Math.max(...nodes.map((node) => (Number(node.y) || 0) + (Number(node.height) || 0)))
  };
}

const expectedTexts = textMultiset(generated);
const actualTexts = textMultiset(queried);
for (const [text, count] of expectedTexts) {
  if ((actualTexts.get(text) || 0) < count) failures.push(`Feishu dropped visible text: ${text}`);
}

if ((queried.nodes || []).length !== (generated.nodes || []).length) {
  failures.push(`Feishu node count changed: ${(generated.nodes || []).length} -> ${(queried.nodes || []).length}`);
}

const minimumFontSize = Math.min(...(queried.nodes || []).filter((node) => node.text?.text).map((node) => Number(node.text.font_size) || 0));
if (!Number.isFinite(minimumFontSize) || minimumFontSize < 16) failures.push(`Feishu contains text below 16px: ${minimumFontSize}`);

const before = bounds(generated);
const after = bounds(queried);
for (const key of ["left", "top", "right", "bottom"]) {
  if (Math.abs(before[key] - after[key]) > 1) failures.push(`Feishu changed board ${key} bound: ${before[key]} -> ${after[key]}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`ok: Feishu round-trip preserved ${(generated.nodes || []).length} nodes, ${[...expectedTexts.values()].reduce((sum, count) => sum + count, 0)} text elements, and ${minimumFontSize}px minimum type`);

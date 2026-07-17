#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const name of fs.readdirSync("examples").sort()) {
  const graph = path.join("examples", name, "content-graph.json");
  if (!fs.existsSync(graph)) continue;
  const result = spawnSync(process.execPath, ["skills/structured-feishu-whiteboard/scripts/engine/run.mjs", "--graph", graph, "--output-dir", path.join("runs", name)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

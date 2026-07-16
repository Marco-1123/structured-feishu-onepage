const REQUIRED_IMPORTANCE = new Set(["critical", "high", "medium"]);

export function validateContentGraph(graph) {
  const issues = [];
  if (graph?.version !== "6.0-alpha.2") issues.push("content graph version must be 6.0-alpha.2");
  if (!graph?.graphId || !graph?.title || !graph?.sourceRef) issues.push("graphId, title and sourceRef are required");
  if (!Array.isArray(graph?.nodes) || !graph.nodes.length) issues.push("content graph requires nodes");
  if (!Array.isArray(graph?.edges)) issues.push("content graph requires an edges array");

  const ids = new Set();
  for (const node of graph?.nodes || []) {
    if (!node.id || ids.has(node.id)) issues.push(`duplicate or missing node id: ${node.id || "<missing>"}`);
    ids.add(node.id);
    if (!node.kind || !node.headline || !node.importance || !node.sourceQuote || !node.sourceUnitIds?.length) issues.push(`node ${node.id || "<missing>"} lacks semantic or source fields`);
  }
  for (const edge of graph?.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) issues.push(`edge ${edge.id || "<missing>"} references an unknown node`);
  }
  if (!(graph?.nodes || []).some((node) => node.kind === "thesis" || node.importance === "critical")) issues.push("content graph requires a thesis or critical node");
  return issues;
}

export function validateScene(scene, graph) {
  const issues = [];
  const ids = new Set(graph.nodes.map((node) => node.id));
  const visible = new Set(scene.sourceNodeIds || []);
  if (!ids.has(scene.thesisNodeId)) issues.push("scene thesisNodeId does not exist in the graph");
  for (const region of scene.regions || []) {
    if (!region.nodeIds?.length) issues.push(`region ${region.id} is empty`);
    for (const id of region.nodeIds || []) if (!ids.has(id)) issues.push(`region ${region.id} references unknown node ${id}`);
  }
  const missing = graph.nodes.filter((node) => REQUIRED_IMPORTANCE.has(node.importance) && !visible.has(node.id));
  if (missing.length) issues.push(`scene drops important nodes: ${missing.map((node) => node.id).join(", ")}`);
  return issues;
}

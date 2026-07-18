export function validateContentGraph(graph) {
  const issues = [];
  if (!["6.0-alpha.2", "6.0-alpha.3", "6.0-alpha.4"].includes(graph?.version)) issues.push("content graph version must be 6.0-alpha.2, 6.0-alpha.3 or 6.0-alpha.4");
  if (!graph?.graphId || !graph?.title || !graph?.sourceRef) issues.push("graphId, title and sourceRef are required");
  if (!Array.isArray(graph?.nodes) || !graph.nodes.length) issues.push("content graph requires nodes");
  if (!Array.isArray(graph?.edges)) issues.push("content graph requires an edges array");

  const ids = new Set();
  for (const node of graph?.nodes || []) {
    if (!node.id || ids.has(node.id)) issues.push(`duplicate or missing node id: ${node.id || "<missing>"}`);
    ids.add(node.id);
    if (!node.kind || !node.headline || !node.importance || !node.sourceQuote || !node.sourceUnitIds?.length) issues.push(`node ${node.id || "<missing>"} lacks semantic or source fields`);
    if (node.kind === "risk" && graph.version === "6.0-alpha.4" && !node.control) issues.push(`risk node ${node.id} requires an explicit control measure`);
  }
  for (const edge of graph?.edges || []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) issues.push(`edge ${edge.id || "<missing>"} references an unknown node`);
  }
  if (!(graph?.nodes || []).some((node) => node.kind === "thesis" || node.importance === "critical")) issues.push("content graph requires a thesis or critical node");
  return issues;
}

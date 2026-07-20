const IMPORTANT = new Set(["critical", "high", "medium"]);

function ordered(nodes) {
  return [...nodes].sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id.localeCompare(b.id));
}

function numericTokens(value) {
  return [...String(value || "").matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function unit(type, title, nodes, options = {}) {
  if (!nodes.length) return null;
  return {
    id: `${type}-${nodes.map((node) => node.id).join("-")}`,
    type,
    title,
    sourceNodeIds: nodes.map((node) => node.id),
    nodes,
    ...options
  };
}

function splitRisk(node) {
  return {
    sourceNodeId: node.id,
    type: "risk",
    risk: node.headline,
    detail: node.detail || "",
    severity: node.riskLevel || (node.status === "risk" ? "high" : "medium"),
    control: node.control || ""
  };
}

function precedesComponents(graph, nodes) {
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((item) => item.type === "precedes" && ids.has(item.from) && ids.has(item.to));
  const undirected = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    undirected.get(edge.from).add(edge.to);
    undirected.get(edge.to).add(edge.from);
  }
  const seen = new Set();
  const components = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const stack = [node.id];
    const component = [];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      component.push(nodes.find((item) => item.id === id));
      for (const neighbor of undirected.get(id) || []) stack.push(neighbor);
    }
    const componentIds = new Set(component.map((item) => item.id));
    const componentEdges = edges.filter((edge) => componentIds.has(edge.from) && componentIds.has(edge.to));
    const indegree = new Map(component.map((item) => [item.id, 0]));
    const outgoing = new Map(component.map((item) => [item.id, []]));
    for (const edge of componentEdges) {
      indegree.set(edge.to, indegree.get(edge.to) + 1);
      outgoing.get(edge.from).push(edge.to);
    }
    const byId = new Map(component.map((item) => [item.id, item]));
    const queue = ordered(component.filter((item) => indegree.get(item.id) === 0));
    const directed = [];
    while (queue.length) {
      const current = queue.shift();
      directed.push(current);
      for (const target of outgoing.get(current.id)) {
        indegree.set(target, indegree.get(target) - 1);
        if (indegree.get(target) === 0) {
          queue.push(byId.get(target));
          queue.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id.localeCompare(b.id));
        }
      }
    }
    components.push(directed.length === component.length ? directed : ordered(component));
  }
  return components.sort((a, b) => {
    const boundaryA = a.some((node) => ["input", "output"].includes(node.kind)) ? 10 : 0;
    const boundaryB = b.some((node) => ["input", "output"].includes(node.kind)) ? 10 : 0;
    return boundaryB + b.length - boundaryA - a.length;
  });
}

function selectMetrics(nodes) {
  return [...nodes]
    .sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      return (rank[b.importance] || 0) - (rank[a.importance] || 0) || a.id.localeCompare(b.id);
    })
    .slice(0, 5);
}

export function compileComposition(graph) {
  const compactGraph = graph.nodes.length <= 24;
  const thesis = graph.nodes.find((node) => node.kind === "thesis")
    || graph.nodes.find((node) => node.importance === "critical")
    || graph.nodes[0];
  const consumed = new Set([thesis.id]);
  const take = (predicate) => graph.nodes.filter((node) => !consumed.has(node.id) && predicate(node));
  const use = (nodes) => nodes.forEach((node) => consumed.add(node.id));
  const units = [];
  const add = (candidate) => {
    if (!candidate) return;
    use(candidate.nodes);
    units.push(candidate);
  };

  const metricNodes = take((node) => ["metric", "result"].includes(node.kind) && node.measure?.display);
  const primaryMetrics = selectMetrics(metricNodes);
  const metricUnit = unit("metric-band", "关键结果", primaryMetrics, {
    span: primaryMetrics.length === 1 ? 4 : 12,
    height: primaryMetrics.length === 1 ? 300 : 285,
    primaryCount: primaryMetrics.length
  });
  add(metricUnit);

  const trendNodes = take((node) => node.kind === "trend" || /→|连续\s*\d+\s*[周月季]/.test(`${node.headline} ${node.detail || ""}`));
  const trend = trendNodes.find((node) => numericTokens(node.detail).length >= 3);

  const orderedCandidates = take((node) => ["input", "stage", "output"].includes(node.kind));
  const orderedGroups = precedesComponents(graph, orderedCandidates);
  const processNodes = orderedGroups[0] || [];
  if (processNodes.length >= 3) add(unit("process-chain", "端到端工作链路", processNodes, { span: 12, height: 280 }));

  if (trend) add(unit("trend-chart", trend.headline, [trend], { span: 4, height: 300 }));

  const capabilityNodes = take((node) => node.kind === "capability");
  if (capabilityNodes.length) add(unit("layer-stack", "能力与系统架构", capabilityNodes, { span: 4, height: Math.max(320, 120 + capabilityNodes.length * 78) }));

  const maturityNodes = take((node) => /^L[1-5]\b/i.test(node.headline) || /成熟度/.test(`${node.headline} ${node.detail || ""}`));
  if (maturityNodes.length) add(unit("maturity-bars", "能力成熟度", maturityNodes, { span: 4, height: 320 }));

  const evidenceNodes = take((node) => node.kind === "evidence");
  const distributionEvidence = evidenceNodes.find((node) => numericTokens(node.detail).length >= 3 && /%/.test(node.detail || ""));
  const sampleEvidence = evidenceNodes.filter((node) => node !== distributionEvidence && numericTokens(`${node.headline} ${node.detail}`).length >= 2).slice(0, 3);
  const evidenceDashboardNodes = [...sampleEvidence, ...(distributionEvidence ? [distributionEvidence] : [])];
  if (evidenceDashboardNodes.length) add(unit("evidence-dashboard", "样本、验证与失败分布", evidenceDashboardNodes, {
    span: 8,
    height: 360,
    sampleNodes: sampleEvidence,
    distributionNode: distributionEvidence || null,
    values: distributionEvidence ? numericTokens(distributionEvidence.detail).slice(0, 5) : []
  }));

  const optionNodes = take((node) => node.kind === "option");
  if (optionNodes.length) add(unit("option-comparison", "方案比较与建议", optionNodes, { span: optionNodes.length >= 3 ? 8 : 6, height: 340 }));

  const riskNodes = take((node) => node.kind === "risk");
  const decisions = take((node) => node.kind === "unresolved");
  const governanceNodes = [...riskNodes, ...decisions];
  if (governanceNodes.length) add(unit("risk-control", "风险、控制与待决策", governanceNodes, {
    span: optionNodes.length >= 3 ? 4 : optionNodes.length ? 6 : governanceNodes.length >= 2 ? 12 : 8,
    height: governanceNodes.length > 4
      ? 128 + Math.ceil(governanceNodes.length / 2) * 102 + (Math.ceil(governanceNodes.length / 2) - 1) * 10
      : 340,
    pairs: [
      ...riskNodes.map(splitRisk),
      ...decisions.map((node) => ({ sourceNodeId: node.id, type: "decision", risk: node.headline, detail: node.detail || "", severity: "medium", control: "" }))
    ]
  }));

  const constraints = take((node) => node.kind === "constraint");
  if (constraints.length) add(unit("cause-map", "关键制约与根因", constraints, { span: 4, height: 320 }));

  const secondaryStages = orderedGroups.slice(1).flat().filter((node) => !consumed.has(node.id));
  const roadmapActions = take((node) => node.kind === "action" && (Number.isFinite(node.order) || /H[12]|Q[1-4]|阶段|月|周/.test(`${node.headline} ${node.detail || ""}`)));
  const roadmap = secondaryStages.length >= 2 ? secondaryStages : ordered(roadmapActions);
  if (roadmap.length >= 2) add(unit("roadmap", "下一阶段路线图", roadmap, { span: 12, height: 310 }));

  const actions = take((node) => node.kind === "action");
  if (actions.length) add(unit("action-list", "近期行动", actions, {
    span: actions.length >= 3 || (compactGraph && actions.length >= 2) ? 12 : 4,
    height: actions.length >= 3 || (compactGraph && actions.length >= 2) ? 240 : 310
  }));

  const remainingMetrics = take((node) => ["metric", "result", "trend"].includes(node.kind));
  if (remainingMetrics.length) {
    use(remainingMetrics);
    metricUnit.nodes.push(...remainingMetrics);
    metricUnit.sourceNodeIds.push(...remainingMetrics.map((node) => node.id));
    metricUnit.height = Math.max(metricUnit.height, 305);
  }

  const remainingEvidence = take((node) => ["evidence", "context", "criterion", "actor"].includes(node.kind));
  if (remainingEvidence.length) {
    const evidenceUnit = units.find((item) => item.type === "evidence-dashboard");
    if (evidenceUnit) {
      use(remainingEvidence);
      evidenceUnit.nodes.push(...remainingEvidence);
      evidenceUnit.sourceNodeIds.push(...remainingEvidence.map((node) => node.id));
      evidenceUnit.displayNodes = evidenceUnit.nodes;
      evidenceUnit.height = Math.max(evidenceUnit.height, 190 + Math.ceil(evidenceUnit.nodes.length / 3) * 108);
    } else add(unit("evidence-ledger", "关键依据", remainingEvidence, {
      span: compactGraph && remainingEvidence.length >= 3 ? 12 : 4,
      height: compactGraph && remainingEvidence.length >= 3 ? 220 : 300
    }));
  }

  const remaining = graph.nodes.filter((node) => !consumed.has(node.id));
  if (remaining.length) add(unit("information-grid", "补充信息", remaining, { span: 4, height: 300 }));

  const clusterable = new Set(["layer-stack", "maturity-bars", "cause-map", "risk-control", "evidence-ledger"]);
  const compactSignals = units.filter((item) => clusterable.has(item.type) && (item.nodes.length === 1 || (item.type === "layer-stack" && item.nodes.length <= 3)));
  if (compactSignals.length >= 2) {
    const insertionIndex = Math.min(...compactSignals.map((item) => units.indexOf(item)));
    for (const item of compactSignals) units.splice(units.indexOf(item), 1);
    units.splice(insertionIndex, 0, {
      id: `insight-cluster-${compactSignals.flatMap((item) => item.nodes).map((node) => node.id).join("-")}`,
      type: "insight-cluster",
      title: "关键判断信号",
      span: metricUnit?.span === 4 ? 8 : 12,
      height: 320,
      entries: compactSignals,
      nodes: compactSignals.flatMap((item) => item.nodes),
      sourceNodeIds: compactSignals.flatMap((item) => item.sourceNodeIds)
    });
  }

  const allSourceNodeIds = [...new Set([thesis.id, ...units.flatMap((item) => item.sourceNodeIds)])];
  const importantIds = graph.nodes.filter((node) => IMPORTANT.has(node.importance)).map((node) => node.id);
  const grammarTypes = [...new Set(units.flatMap((item) => item.type === "insight-cluster" ? [item.type, ...item.entries.map((entry) => entry.type)] : [item.type]))];
  return {
    version: "6.0-alpha.5",
    compositionId: `${graph.graphId}-composition`,
    title: graph.title,
    subtitle: graph.subtitle || "",
    thesis,
    units,
    sourceNodeIds: allSourceNodeIds,
    importantNodeIds: importantIds,
    grammarTypes,
    coverage: {
      all: allSourceNodeIds.length / graph.nodes.length,
      important: importantIds.filter((id) => allSourceNodeIds.includes(id)).length / importantIds.length
    }
  };
}

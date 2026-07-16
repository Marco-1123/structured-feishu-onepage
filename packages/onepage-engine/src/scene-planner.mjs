const IMPORTANT = new Set(["critical", "high", "medium"]);

function thesis(graph) {
  return graph.nodes.find((node) => node.kind === "thesis")
    || graph.nodes.find((node) => node.importance === "critical")
    || graph.nodes[0];
}

function nodesOf(graph, kinds, excluded = new Set()) {
  const allowed = new Set(kinds);
  return graph.nodes.filter((node) => allowed.has(node.kind) && !excluded.has(node.id));
}

function region(id, role, title, nodes, width, layout) {
  return nodes.length ? { id, role, title, nodeIds: nodes.map((node) => node.id), width, layout } : null;
}

function scoreSignals(graph) {
  const count = (kinds) => nodesOf(graph, kinds).length;
  const ordered = nodesOf(graph, ["stage", "input", "output"]).filter((node) => Number.isFinite(node.order)).length;
  return {
    metrics: count(["metric", "trend", "result"]),
    capabilities: count(["capability"]),
    stages: Math.max(ordered, count(["stage", "input", "output"])),
    actions: count(["action"]),
    risks: count(["risk", "constraint", "unresolved"]),
    evidence: count(["evidence", "context"]),
    explicitRelations: graph.edges.length,
  };
}

function buildRegions(graph, archetype, thesisNode) {
  const used = new Set([thesisNode.id]);
  const take = (kinds) => nodesOf(graph, kinds, used).map((node) => (used.add(node.id), node));
  const metrics = take(["metric", "trend", "result"]);
  const capabilities = take(["capability"]);
  const process = take(["input", "stage", "output"]);
  const evidence = take(["evidence", "context", "criterion", "option"]);
  const actions = take(["action"]);
  const risks = take(["risk", "constraint", "unresolved"]);
  const remaining = graph.nodes.filter((node) => !used.has(node.id));
  remaining.forEach((node) => used.add(node.id));

  if (archetype === "capability-system") {
    const sparseGovernance = risks.length > 0 && risks.length <= 1 && actions.length > 0 && actions.length + risks.length <= 5;
    return [
      region("metrics", "metrics", "价值结果", metrics, "full", "horizontal"),
      region("capabilities", "capabilities", "核心能力", capabilities, "two-thirds", "grid"),
      region("evidence", "evidence", "沉淀基础", evidence, "third", "vertical"),
      region("process", "process", "使用链路", process, "full", "dagre-lr"),
      region("actions", "actions", sparseGovernance ? "下一阶段与边界" : "下一阶段", sparseGovernance ? [...actions, ...risks] : actions, "full", "grid"),
      ...(!sparseGovernance ? [region("risks", "risks", "约束与待确认", risks, "half", "grid")] : []),
      region("context", "context", "补充信息", remaining, "full", "grid"),
    ].filter(Boolean);
  }
  if (archetype === "review-dashboard") {
    const sparseGovernance = risks.length > 0 && risks.length <= 1 && actions.length > 0 && actions.length + risks.length <= 5;
    return [
      region("metrics", "metrics", "阶段结果", metrics, "full", "horizontal"),
      region("evidence", "evidence", "关键依据", [...evidence, ...capabilities], "two-thirds", "grid"),
      ...(!sparseGovernance ? [region("risks", "risks", "风险与约束", risks, "third", "vertical")] : []),
      region("process", "process", "变化与推进路径", process, "full", "dagre-lr"),
      region("actions", "actions", sparseGovernance ? "下一阶段动作与约束" : "下一阶段动作", sparseGovernance ? [...actions, ...risks] : actions, "full", "grid"),
      region("context", "context", "补充信息", remaining, "full", "grid"),
    ].filter(Boolean);
  }
  if (archetype === "process-system") {
    return [
      region("process", "process", "端到端链路", process, "full", "dagre-lr"),
      region("capabilities", "capabilities", "支撑能力", capabilities, "two-thirds", "grid"),
      region("metrics", "metrics", "运行结果", metrics, "third", "vertical"),
      region("evidence", "evidence", "规则与依据", evidence, "half", "grid"),
      region("risks", "risks", "控制点", risks, "half", "grid"),
      region("actions", "actions", "改进动作", actions, "full", "grid"),
      region("context", "context", "补充信息", remaining, "full", "grid"),
    ].filter(Boolean);
  }
  return [
    region("metrics", "metrics", "关键结果", metrics, "full", "horizontal"),
    region("capabilities", "capabilities", "信息结构", capabilities, "half", "grid"),
    region("evidence", "evidence", "依据与背景", evidence, "half", "grid"),
    region("process", "process", "关系链路", process, "full", "dagre-lr"),
    region("actions", "actions", "推进动作", actions, "half", "grid"),
    region("risks", "risks", "风险约束", risks, "half", "grid"),
    region("context", "context", "补充信息", remaining, "full", "grid"),
  ].filter(Boolean);
}

export function planScenes(graph) {
  const signal = scoreSignals(graph);
  const thesisNode = thesis(graph);
  const candidates = [
    {
      archetype: "capability-system",
      score: 42 + Math.min(32, signal.capabilities * 6) + Math.min(14, signal.stages * 3) + Math.min(12, signal.metrics * 4),
      reasons: [`${signal.capabilities} 个能力节点`, `${signal.stages} 个链路节点`, `${signal.metrics} 项结果指标`],
    },
    {
      archetype: "review-dashboard",
      score: 40 + Math.min(30, signal.metrics * 8) + Math.min(14, signal.actions * 4) + Math.min(12, signal.risks * 4) + Math.min(10, signal.evidence * 2),
      reasons: [`${signal.metrics} 项结果指标`, `${signal.actions} 项动作`, `${signal.risks} 项风险约束`],
    },
    {
      archetype: "process-system",
      score: 36 + Math.min(42, signal.stages * 8) + Math.min(12, signal.explicitRelations * 3) + Math.min(10, signal.capabilities * 2),
      reasons: [`${signal.stages} 个有序节点`, `${signal.explicitRelations} 条显式关系`],
    },
    {
      archetype: "information-map",
      score: 55 + Math.min(20, graph.nodes.filter((node) => IMPORTANT.has(node.importance)).length),
      reasons: ["通用信息保全候选"],
    },
  ].map((candidate, index) => {
    const regions = buildRegions(graph, candidate.archetype, thesisNode);
    const sourceNodeIds = [...new Set([thesisNode.id, ...regions.flatMap((item) => item.nodeIds)])];
    return {
      version: "6.0-alpha.1",
      sceneId: `${graph.graphId}-${candidate.archetype}-${index + 1}`,
      archetype: candidate.archetype,
      title: graph.title,
      subtitle: graph.subtitle || "",
      thesisNodeId: thesisNode.id,
      style: "feishu-blue",
      score: Math.min(100, candidate.score),
      reasons: candidate.reasons,
      regions,
      sourceNodeIds,
    };
  });
  return candidates.sort((a, b) => b.score - a.score || a.archetype.localeCompare(b.archetype));
}

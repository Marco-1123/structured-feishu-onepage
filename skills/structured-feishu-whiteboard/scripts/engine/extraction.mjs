import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SIGNALS = {
  numeric: /(?:\d+(?:\.\d+)?%?|[一二三四五六七八九十]+(?:项|个|类|周|月|阶段))/u,
  risk: /风险|约束|问题|不足|缺失|异常|尚未|依赖|不一致|待确认|瓶颈/u,
  action: /下一步|下一阶段|计划|应当|应该|需要|建议|推进|建立|统一|完成|固化|优化/u,
  process: /流程|链路|依次|阶段|输入|输出|从.+到|经过/u,
  evidence: /证据|数据显示|结果说明|调研|验证|样本|依据|连续/u
};

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function draftFingerprint(draft) {
  const semanticDraft = {
    graphId: draft.graphId,
    title: draft.title,
    subtitle: draft.subtitle || "",
    sourceRef: draft.sourceRef,
    sourceDecisions: draft.sourceDecisions || [],
    nodes: draft.nodes || [],
    edges: draft.edges || []
  };
  return sha256(JSON.stringify(canonicalize(semanticDraft)));
}

export function normalizeSource(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

export function sourceUnits(source) {
  return normalizeSource(source)
    .split(/\n\s*\n+/)
    .map((text) => text.trim())
    .filter((text) => text && !/^#\s+/u.test(text))
    .map((text, index) => {
      const signals = Object.entries(SIGNALS).filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
      return {
        id: `U${String(index + 1).padStart(2, "0")}`,
        text,
        hash: sha256(text).slice(0, 16),
        signals,
        protected: signals.length > 0
      };
    });
}

export function buildExtractionPacket(source, sourceRef) {
  const normalized = normalizeSource(source);
  const title = normalized.match(/^#\s+(.+)$/mu)?.[1]?.trim() || "未命名 OnePage";
  return {
    version: "6.0-alpha.4",
    protocol: "evidence-ledger-v1",
    sourceRef,
    sourceSha256: sha256(normalized),
    title,
    units: sourceUnits(normalized)
  };
}

export function buildDraftTemplate(packet, graphId) {
  return {
    version: "6.0-alpha.4-draft",
    graphId,
    title: packet.title,
    subtitle: "",
    sourceRef: packet.sourceRef,
    sourceDecisions: packet.units.map((unit) => ({ unitId: unit.id, decision: "unreviewed", nodeIds: [], reason: "" })),
    nodes: [],
    edges: []
  };
}

function normalizeQuote(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
}

function numericTokens(value) {
  return [...String(value || "").matchAll(/(?<![A-Za-z])\d+(?:\.\d+)?%?(?![A-Za-z])/g)].map((match) => match[0]);
}

function citesNumericToken(citedText, token) {
  if (citedText.includes(token)) return true;
  const plain = token.replace(/%$/, "");
  const chinese = { "0": "零", "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九", "10": "十" }[plain];
  if (!chinese) return false;
  if (citedText.includes(chinese)) return true;
  return plain === "2" && citedText.includes("两");
}

function semanticTokens(value) {
  const normalized = String(value || "").normalize("NFKC").toLowerCase();
  const tokens = [];
  for (const word of normalized.match(/[a-z][a-z0-9._/-]*|\d+(?:\.\d+)?%?/g) || []) {
    if (word.length > 1) tokens.push(word);
  }
  for (const sequence of normalized.match(/[\p{Script=Han}]{2,}/gu) || []) {
    for (let index = 0; index < sequence.length - 1; index += 1) tokens.push(sequence.slice(index, index + 2));
  }
  return new Set(tokens);
}

function validateClaimGrounding(node, citedText) {
  const issues = [];
  const claimText = [node.headline, node.detail, node.measure?.display, node.control].filter(Boolean).join(" ");
  for (const token of numericTokens(claimText)) {
    if (!citesNumericToken(citedText, token)) issues.push(`node ${node.id} introduces uncited numeric token ${token}`);
  }
  const claimTokens = semanticTokens(claimText);
  const sourceTokens = semanticTokens(citedText);
  if (claimTokens.size >= 5) {
    const overlap = [...claimTokens].filter((token) => sourceTokens.has(token)).length / claimTokens.size;
    if (overlap < 0.15) issues.push(`node ${node.id} semantic claim is not supported by its cited units (${overlap.toFixed(2)})`);
  }
  return issues;
}

export function sealDraft(packet, draft) {
  const issues = [];
  const units = new Map(packet.units.map((unit) => [unit.id, unit]));
  const nodes = new Map((draft.nodes || []).map((node) => [node.id, node]));
  const decisions = new Map();

  for (const decision of draft.sourceDecisions || []) {
    if (!units.has(decision.unitId)) issues.push(`unknown source unit: ${decision.unitId}`);
    if (decisions.has(decision.unitId)) issues.push(`duplicate source decision: ${decision.unitId}`);
    decisions.set(decision.unitId, decision);
  }

  for (const unit of packet.units) {
    const decision = decisions.get(unit.id);
    if (!decision || !["preserve", "merge", "drop"].includes(decision.decision)) {
      issues.push(`${unit.id} has not been reviewed`);
      continue;
    }
    if (decision.decision === "drop") {
      if (unit.protected) issues.push(`${unit.id} contains protected information and cannot be dropped`);
      if (String(decision.reason || "").trim().length < 6) issues.push(`${unit.id} drop reason is too weak`);
      continue;
    }
    if (!decision.nodeIds?.length) issues.push(`${unit.id} has no destination nodes`);
    for (const id of decision.nodeIds || []) if (!nodes.has(id)) issues.push(`${unit.id} references unknown node ${id}`);

    const represented = (decision.nodeIds || []).map((id) => nodes.get(id)).filter(Boolean);
    const representedText = represented.map((node) => [node.headline, node.detail, node.sourceQuote, node.measure?.display].filter(Boolean).join(" ")).join(" ");
    for (const token of numericTokens(unit.text)) if (!representedText.includes(token)) issues.push(`${unit.id} drops numeric token ${token}`);
  }

  for (const node of draft.nodes || []) {
    if (!node.sourceUnitIds?.length) {
      issues.push(`node ${node.id} has no sourceUnitIds`);
      continue;
    }
    const cited = node.sourceUnitIds.map((id) => units.get(id)).filter(Boolean);
    if (cited.length !== node.sourceUnitIds.length) issues.push(`node ${node.id} cites an unknown source unit`);
    const haystack = normalizeQuote(cited.map((unit) => unit.text).join("\n"));
    const citedText = cited.map((unit) => unit.text).join("\n");
    const quote = normalizeQuote(node.sourceQuote);
    if (quote.length < 4 || !haystack.includes(quote)) issues.push(`node ${node.id} sourceQuote is not inside its cited units`);
    issues.push(...validateClaimGrounding(node, citedText));
    if (node.kind === "risk" && draft.version === "6.0-alpha.4-draft" && !String(node.control || "").trim()) {
      issues.push(`risk node ${node.id} requires an explicit control measure`);
    }
  }

  const semanticKeys = new Map();
  for (const node of draft.nodes || []) {
    const key = normalizeQuote(`${node.kind}:${node.headline}:${node.detail || ""}`);
    if (semanticKeys.has(key)) issues.push(`nodes ${semanticKeys.get(key)} and ${node.id} duplicate the same meaning`);
    semanticKeys.set(key, node.id);
  }

  if (issues.length) return { issues };
  return {
    issues: [],
    graph: {
      ...draft,
      version: "6.0-alpha.4",
      extraction: {
        protocol: packet.protocol,
        sourceSha256: packet.sourceSha256,
        sourceUnitCount: packet.units.length,
        draftSha256: draftFingerprint(draft),
        sealedAt: new Date().toISOString()
      }
    }
  };
}

export function verifySealedGraph(graph, cwd = process.cwd()) {
  const sourcePath = path.isAbsolute(graph.sourceRef) ? graph.sourceRef : path.resolve(cwd, graph.sourceRef);
  if (!fs.existsSync(sourcePath)) return [`source snapshot not found: ${sourcePath}`];
  const packet = buildExtractionPacket(fs.readFileSync(sourcePath, "utf8"), graph.sourceRef);
  const draft = { ...graph, version: graph.version === "6.0-alpha.4" ? "6.0-alpha.4-draft" : "6.0-alpha.3-draft" };
  const sealed = sealDraft(packet, draft);
  const issues = [...sealed.issues];
  if (graph.extraction?.sourceSha256 !== packet.sourceSha256) issues.push("source fingerprint does not match the sealed graph");
  if (graph.extraction?.protocol !== "evidence-ledger-v1") issues.push("graph was not sealed by the evidence-ledger protocol");
  if (graph.version === "6.0-alpha.4" && graph.extraction?.draftSha256 !== draftFingerprint(graph)) {
    issues.push("content graph changed after it was sealed");
  }
  return issues;
}

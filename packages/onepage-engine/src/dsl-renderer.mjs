const PAGE_WIDTH = 1800;
const INNER_WIDTH = 1704;

const palette = {
  canvas: "#F5F7FA",
  surface: "#FFFFFF",
  soft: "#F0F4FF",
  muted: "#F2F3F5",
  border: "#D8DEE8",
  ink: "#1F2329",
  secondary: "#646A73",
  accent: "#3370FF",
  accentDark: "#245BDB",
  success: "#168570",
  warning: "#B56A2D",
  risk: "#9A5B42",
  connector: "#A6B0BF"
};

function textNode(value, size = 14, color = palette.ink, bold = false, width = "fill-container", align = "left") {
  return {
    type: "text",
    width,
    height: "fit-content",
    text: [{ content: String(value || ""), fontSize: size, color, ...(bold ? { bold: true } : {}) }],
    fontSize: size,
    textColor: color,
    textAlign: align,
    verticalAlign: "top"
  };
}

function frame({ id, layout = "vertical", width = "fill-container", height = "fit-content", gap = 0, padding = 0, fillColor, borderColor, borderWidth, borderRadius, alignItems = "stretch", justifyContent, layoutOptions, children = [] }) {
  return {
    type: "frame",
    ...(id ? { id } : {}),
    width,
    height,
    layout,
    gap,
    padding,
    alignItems,
    ...(justifyContent ? { justifyContent } : {}),
    ...(layoutOptions ? { layoutOptions } : {}),
    ...(fillColor ? { fillColor } : {}),
    ...(borderColor ? { borderColor } : {}),
    ...(borderWidth ? { borderWidth } : {}),
    ...(borderRadius ? { borderRadius } : {}),
    children
  };
}

function statusColor(node) {
  if (node.status === "risk" || node.kind === "risk") return palette.risk;
  if (node.status === "warning" || node.kind === "constraint" || node.kind === "unresolved") return palette.warning;
  if (node.status === "good") return palette.success;
  return palette.accent;
}

function balancedRows(items, maxColumns) {
  if (!items.length) return [];
  const rows = Math.ceil(items.length / maxColumns);
  const base = Math.floor(items.length / rows);
  let extra = items.length % rows;
  const result = [];
  let cursor = 0;
  for (let row = 0; row < rows; row += 1) {
    const count = base + (extra-- > 0 ? 1 : 0);
    result.push(items.slice(cursor, cursor + count));
    cursor += count;
  }
  return result;
}

function contentCard(node, variant = "default") {
  const color = statusColor(node);
  const children = [];
  if (variant === "metric" && node.measure?.display) {
    children.push(textNode(node.headline, 13, palette.secondary, true));
    children.push(textNode(node.measure.display, 30, color, true));
    if (node.detail) children.push(textNode(node.detail, 13, palette.secondary));
  } else {
    children.push(textNode(node.headline, 15, palette.ink, true));
    if (node.detail) children.push(textNode(node.detail, 13, palette.secondary));
  }
  return frame({
    id: `node-${node.id}`,
    layout: "horizontal",
    gap: 12,
    padding: [14, 16],
    fillColor: variant === "metric" ? palette.soft : palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "stretch",
    children: [
      { type: "rect", width: 5, height: "fill-container(56)", fillColor: color, borderColor: color, borderWidth: 1, borderRadius: 3 },
      frame({ layout: "vertical", gap: 5, padding: 0, children })
    ]
  });
}

function processCard(node) {
  return frame({
    id: `node-${node.id}`,
    width: 270,
    height: "fit-content(90)",
    layout: "vertical",
    gap: 6,
    padding: [16, 18],
    fillColor: palette.surface,
    borderColor: palette.accent,
    borderWidth: 2,
    borderRadius: 10,
    children: [
      textNode(node.headline, 15, palette.ink, true, "fill-container"),
      ...(node.detail ? [textNode(node.detail, 12, palette.secondary)] : [])
    ]
  });
}

function regionBody(region, graph) {
  const map = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes = region.nodeIds.map((id) => map.get(id)).filter(Boolean);
  if (region.role === "process") {
    const ordered = [...nodes].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const explicit = graph.edges.filter((edge) => region.nodeIds.includes(edge.from) && region.nodeIds.includes(edge.to) && edge.type === "precedes");
    const edges = explicit.length
      ? explicit.map((edge) => [ `node-${edge.from}`, `node-${edge.to}`, edge.label || "" ])
      : ordered.slice(1).map((node, index) => [ `node-${ordered[index].id}`, `node-${node.id}` ]);
    return frame({
      id: `dagre-${region.id}`,
      layout: "dagre",
      width: 1600,
      height: "fit-content(150)",
      gap: 0,
      padding: 20,
      alignItems: "center",
      layoutOptions: { rankdir: ordered.length > 5 ? "TB" : "LR", nodesep: 34, edgesep: 18, ranksep: 70, edges },
      children: ordered.map(processCard)
    });
  }

  const maxColumns = region.role === "metrics" ? 3 : nodes.length >= 5 ? 3 : nodes.length >= 2 ? 2 : 1;
  const rows = balancedRows(nodes, maxColumns);
  return frame({
    layout: "vertical",
    gap: 12,
    padding: 0,
    children: rows.map((row) => frame({
      layout: "horizontal",
      gap: 12,
      padding: 0,
      alignItems: "stretch",
      children: row.map((node) => contentCard(node, region.role === "metrics" ? "metric" : "default"))
    }))
  });
}

function renderRegion(region, graph, width = "fill-container") {
  return frame({
    id: `region-${region.id}`,
    width,
    layout: "vertical",
    gap: 14,
    padding: 20,
    fillColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 10,
    children: [
      textNode(region.title, 19, palette.ink, true),
      regionBody(region, graph)
    ]
  });
}

function composeRegions(regions, graph) {
  const result = [];
  for (let index = 0; index < regions.length;) {
    const current = regions[index];
    const next = regions[index + 1];
    if (current.width === "full" || !next) {
      result.push(renderRegion(current, graph));
      index += 1;
      continue;
    }
    const pairable = (current.width === "two-thirds" && next.width === "third")
      || (current.width === "third" && next.width === "two-thirds")
      || (current.width === "half" && next.width === "half");
    if (!pairable) {
      result.push(renderRegion(current, graph));
      index += 1;
      continue;
    }
    const leftWidth = current.width === "two-thirds" ? 1110 : current.width === "third" ? 570 : "fill-container";
    const rightWidth = next.width === "two-thirds" ? 1110 : next.width === "third" ? 570 : "fill-container";
    result.push(frame({
      layout: "horizontal",
      gap: 20,
      padding: 0,
      alignItems: "stretch",
      children: [renderRegion(current, graph, leftWidth), renderRegion(next, graph, rightWidth)]
    }));
    index += 2;
  }
  return result;
}

export function renderSceneToDsl(scene, graph) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const thesis = byId.get(scene.thesisNodeId);
  const page = frame({
    id: "onepage-root",
    layout: "vertical",
    width: PAGE_WIDTH,
    height: "fit-content",
    gap: 24,
    padding: 48,
    fillColor: palette.canvas,
    alignItems: "stretch",
    children: [
      frame({
        layout: "vertical",
        gap: 8,
        padding: 0,
        children: [
          textNode(scene.title, 30, palette.ink, true),
          ...(scene.subtitle ? [textNode(scene.subtitle, 15, palette.secondary)] : [])
        ]
      }),
      frame({
        id: "thesis-block",
        layout: "horizontal",
        gap: 18,
        padding: [22, 24],
        fillColor: palette.surface,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 10,
        children: [
          { type: "rect", width: 7, height: "fill-container(88)", fillColor: palette.accent, borderColor: palette.accent, borderWidth: 1, borderRadius: 4 },
          frame({ layout: "vertical", gap: 8, padding: 0, children: [
            textNode("核心判断", 14, palette.accentDark, true),
            textNode(thesis?.headline || "", 22, palette.ink, true),
            ...(thesis?.detail ? [textNode(thesis.detail, 14, palette.secondary)] : [])
          ]})
        ]
      }),
      ...composeRegions(scene.regions, graph)
    ]
  });
  return { version: 2, nodes: [{ ...page, x: 0, y: 0, width: PAGE_WIDTH }] };
}

export { PAGE_WIDTH, INNER_WIDTH };


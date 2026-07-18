const MAX_W = 4500;
const MIN_W = 2600;
const PAGE_MARGIN = 120;
const COLORS = {
  bg: "#F5F7FA", surface: "#FFFFFF", ink: "#172033", secondary: "#667085",
  border: "#D7DFEA", blue: "#3370FF", blue2: "#5B6DE2", blueSoft: "#EEF3FF",
  green: "#159F85", greenSoft: "#E9F7F3", amber: "#A56A43", amberSoft: "#F8F0EA",
  navy: "#111827", grid: "#E8EDF4"
};

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textWidth(value, size) {
  return [...String(value || "")].reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? size : size * 0.56), 0);
}

function wrap(value, width, size, maxLines = 2) {
  const chars = [...String(value || "")];
  const lines = [];
  let line = "";
  for (const char of chars) {
    if (char === "\n" || textWidth(line + char, size) > width) {
      if (line) lines.push(line);
      line = char === "\n" ? "" : char;
      if (lines.length === maxLines) break;
    } else line += char;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.join("").length < chars.filter((char) => char !== "\n").length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[，。；、,.\s]+$/u, "")}…`;
  }
  return lines;
}

function t(x, y, value, size = 24, color = COLORS.ink, weight = 400, anchor = "start") {
  const readableSize = Math.max(16, size);
  return `<text x="${x}" y="${y}" font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif" font-size="${readableSize}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function multiline(x, y, value, width, size = 24, color = COLORS.secondary, weight = 400, maxLines = 2, lineHeight = 1.35) {
  const readableSize = Math.max(16, size);
  return wrap(value, width, readableSize, maxLines).map((line, index) => t(x, y + index * readableSize * lineHeight, line, readableSize, color, weight)).join("");
}

function centeredMultiline(x, y, value, width, size = 16, color = COLORS.secondary, weight = 400, maxLines = 2, lineHeight = 1.3) {
  const readableSize = Math.max(16, size);
  return wrap(value, width, readableSize, maxLines).map((item, index) => t(x, y + index * readableSize * lineHeight, item, readableSize, color, weight, "middle")).join("");
}

function sourceGroup(nodeOrId, markup) {
  const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.id;
  return id ? `<g data-source-node-id="${esc(id)}">${markup}</g>` : markup;
}

function rect(x, y, width, height, fill = COLORS.surface, stroke = COLORS.border, radius = 14, sw = 2) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function line(x1, y1, x2, y2, color = COLORS.border, sw = 3) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

function arrow(x1, y, x2, color = COLORS.blue) {
  return `${line(x1, y, x2 - 14, y, color, 4)}<path d="M ${x2 - 18} ${y - 9} L ${x2} ${y} L ${x2 - 18} ${y + 9}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function sectionShell(x, y, width, height, title, subtitle = "") {
  return `${rect(x, y, width, height)}${t(x + 34, y + 46, title, 27, COLORS.ink, 700)}${subtitle ? multiline(x + 34, y + 78, subtitle, width - 68, 18, COLORS.secondary, 400, 1) : ""}`;
}

function nodeText(node) {
  return node.detail ? `${node.headline}｜${node.detail}` : node.headline;
}

function renderMetricBand(unit, x, y, width, height) {
  const gap = 18;
  const primary = unit.nodes.slice(0, unit.primaryCount || 5);
  const secondary = unit.nodes.slice(primary.length);
  const cardHeight = secondary.length ? height - 54 : height;
  const cardW = (width - gap * (primary.length - 1)) / primary.length;
  let out = primary.map((node, index) => {
    const cx = x + index * (cardW + gap);
    return sourceGroup(node, `${rect(cx, y, cardW, cardHeight, COLORS.surface)}${t(cx + 26, y + 40, node.headline, 20, COLORS.secondary, 600)}${t(cx + 26, y + 101, node.measure?.display || node.detail || "", 43, COLORS.blue2, 750)}${multiline(cx + 26, y + 139, node.detail || "", cardW - 52, 17, COLORS.secondary, 400, 2)}${rect(cx + 26, y + cardHeight - 40, 112, 28, COLORS.blueSoft, COLORS.blueSoft, 6, 1)}${t(cx + 82, y + cardHeight - 19, node.measure?.direction === "down" ? "效率改善" : "阶段结果", 16, COLORS.blue, 700, "middle")}`);
  }).join("");
  if (secondary.length) {
    const miniGap = 10;
    const miniW = (width - miniGap * (secondary.length - 1)) / secondary.length;
    secondary.forEach((node, index) => {
      const cx = x + index * (miniW + miniGap);
      const summary = [node.headline, node.measure?.display, node.detail].filter(Boolean).join("｜");
      out += sourceGroup(node, `${rect(cx, y + height - 68, miniW, 68, index < 2 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 7, 1)}${centeredMultiline(cx + miniW / 2, y + height - 39, summary, miniW - 18, 16, index < 2 ? COLORS.blue2 : COLORS.secondary, 650, 2)}`);
    });
  }
  return out;
}

function renderTrend(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "用连续变化判断是否形成稳定趋势");
  const values = unit.values || [];
  const min = Math.min(...values), max = Math.max(...values);
  const left = x + 58, right = x + width - 44, top = y + 120, bottom = y + height - 58;
  out += line(left, bottom, right, bottom, COLORS.border, 2);
  const points = values.map((value, index) => {
    const px = left + index * ((right - left) / Math.max(1, values.length - 1));
    const py = bottom - ((value - min) / Math.max(1, max - min)) * (bottom - top);
    return { px, py, value };
  });
  out += `<polyline points="${points.map((p) => `${p.px},${p.py}`).join(" ")}" fill="none" stroke="${COLORS.blue2}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
  for (const point of points) out += `<circle cx="${point.px}" cy="${point.py}" r="8" fill="${COLORS.surface}" stroke="${COLORS.blue2}" stroke-width="5"/>${t(point.px, point.py - 18, `${point.value}%`, 16, COLORS.ink, 700, "middle")}`;
  return sourceGroup(unit.nodes[0], out);
}

function renderProcess(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "从入口到沉淀的主链路，重点环节单独标识");
  const count = unit.nodes.length;
  const gap = 46;
  const cardW = (width - 68 - gap * (count - 1)) / count;
  const cy = y + 112;
  unit.nodes.forEach((node, index) => {
    const cx = x + 34 + index * (cardW + gap);
    const warning = node.status === "warning" || node.status === "risk";
    out += sourceGroup(node, `${rect(cx, cy, cardW, height - 142, warning ? COLORS.amberSoft : COLORS.blueSoft, warning ? COLORS.amber : COLORS.border, 12, 2)}${t(cx + 22, cy + 40, String(index + 1).padStart(2, "0"), 17, warning ? COLORS.amber : COLORS.blue, 750)}${multiline(cx + 22, cy + 78, node.headline, cardW - 44, 23, COLORS.ink, 700, 2)}${multiline(cx + 22, cy + 134, node.detail || "", cardW - 44, 16, COLORS.secondary, 400, 3)}`);
    if (index < count - 1) out += arrow(cx + cardW + 8, cy + (height - 142) / 2, cx + cardW + gap - 8);
  });
  return out;
}

function renderLayers(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "层级结构既展示职责，也呈现成熟度差异");
  const start = y + 108;
  const h = (height - 132) / unit.nodes.length;
  unit.nodes.forEach((node, index) => {
    const yy = start + index * h;
    const warn = node.status === "warning";
    out += sourceGroup(node, `${rect(x + 34 + index * 10, yy, width - 68 - index * 20, h - 9, warn ? COLORS.amberSoft : index % 2 ? "#F7F9FC" : COLORS.blueSoft, warn ? COLORS.amber : COLORS.border, 8, 1.5)}${t(x + 55 + index * 10, yy + 30, node.headline, 19, COLORS.ink, 700)}${multiline(x + 210 + index * 10, yy + 30, node.detail || "", width - 285 - index * 20, 16, COLORS.secondary, 400, 2)}`);
  });
  return out;
}

function renderMaturity(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "成熟能力用于复用，薄弱能力进入治理主线");
  const start = y + 118;
  const rowH = (height - 142) / unit.nodes.length;
  unit.nodes.forEach((node, index) => {
    const level = Number((node.headline.match(/L([1-5])/i) || [0, 2])[1]);
    const yy = start + index * rowH;
    out += sourceGroup(node, `${t(x + 34, yy + 22, node.headline, 18, COLORS.ink, 700)}${rect(x + 210, yy + 3, width - 254, 20, COLORS.grid, COLORS.grid, 10, 1)}${rect(x + 210, yy + 3, (width - 254) * (level / 5), 20, level <= 2 ? COLORS.amber : COLORS.blue2, level <= 2 ? COLORS.amber : COLORS.blue2, 10, 1)}${multiline(x + 34, yy + 52, node.detail || "", width - 68, 16, COLORS.secondary, 400, 1)}`);
  });
  return out;
}

function renderEvidenceSamples(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "用样本规模说明结论的可信基础");
  const values = numericTokens(unit.nodes.map(nodeText).join(" ")).slice(0, 4);
  const labels = ["任务记录", "用户访谈", "阶段报告", "失败案例"];
  const gap = 14, cardW = (width - 68 - gap * 1) / 2, cardH = (height - 130 - gap) / 2;
  values.forEach((value, index) => {
    const cx = x + 34 + (index % 2) * (cardW + gap);
    const cy = y + 102 + Math.floor(index / 2) * (cardH + gap);
    out += rect(cx, cy, cardW, cardH, index === 0 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 10, 1.5);
    out += t(cx + 20, cy + 43, value, 31, index === 0 ? COLORS.blue2 : COLORS.ink, 750);
    out += t(cx + 20, cy + 72, labels[index], 15, COLORS.secondary, 600);
  });
  const headlines = unit.nodes.map((node) => node.headline).filter(Boolean).slice(0, 3).join(" · ");
  out += centeredMultiline(x + width / 2, y + height - 18, headlines, width - 68, 12, COLORS.secondary, 500, 1);
  return out;
}

function renderEvidenceDashboard(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "样本规模与失败结构共同决定结论可信度");
  const nodes = unit.displayNodes || unit.nodes;
  const gap = 10, cols = width >= 1500 ? 3 : 2, cardW = (width - 68 - gap * (cols - 1)) / cols;
  const cardH = 98;
  nodes.forEach((node, index) => {
    const cx = x + 34 + (index % cols) * (cardW + gap);
    const cy = y + 102 + Math.floor(index / cols) * (cardH + gap);
    const values = numericTokens(nodeText(node));
    const metric = node.measure?.display || (values.length ? String(values[0]) : "依据");
    out += sourceGroup(node, `${rect(cx, cy, cardW, cardH, index === 0 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 9, 1)}${t(cx + 15, cy + 31, metric, 22, index === 0 ? COLORS.blue2 : COLORS.ink, 750)}${multiline(cx + 15, cy + 57, node.headline, cardW - 30, 16, COLORS.ink, 650, 2)}${multiline(cx + 15, cy + 82, node.detail || "", cardW - 30, 16, COLORS.secondary, 400, 2)}`);
  });
  const distribution = unit.values || [];
  const colors = [COLORS.blue2, "#7B8BE8", COLORS.amber, "#C69673", COLORS.green];
  const total = distribution.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = x + 34;
  const chartY = y + 116 + Math.ceil(nodes.length / cols) * (cardH + gap);
  distribution.forEach((value, index) => {
    const w = (width - 68) * (value / total);
    out += rect(cursor, chartY, w, 34, colors[index], colors[index], 0, 0);
    if (w > 54) out += t(cursor + w / 2, chartY + 24, `${value}%`, 16, "#FFFFFF", 750, "middle");
    cursor += w;
  });
  return out;
}

function numericTokens(value) {
  return [...String(value || "").matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function renderStacked(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "不同失败类型占比决定治理优先级");
  const values = unit.values || [];
  const colors = [COLORS.blue2, "#7B8BE8", COLORS.amber, "#C69673", COLORS.green];
  const labels = ["口径", "数据", "权限", "知识", "其他"];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let cursor = x + 34;
  values.forEach((value, index) => {
    const w = (width - 68) * (value / total);
    out += rect(cursor, y + 124, w, 48, colors[index], colors[index], 0, 0);
    if (w > 70) out += t(cursor + w / 2, y + 156, `${value}%`, 16, "#FFFFFF", 750, "middle");
    cursor += w;
  });
  values.forEach((value, index) => {
    const yy = y + 210 + index * 34;
    out += `<circle cx="${x + 43}" cy="${yy - 6}" r="7" fill="${colors[index]}"/>${t(x + 62, yy, `${labels[index]} ${value}%`, 16, COLORS.ink, 600)}`;
  });
  return sourceGroup(unit.nodes[0], out);
}

function renderOptions(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "按收益、成本与风险形成可解释推荐");
  const start = y + 104;
  const rowH = (height - 130) / unit.nodes.length;
  unit.nodes.forEach((node, index) => {
    const yy = start + index * rowH;
    const chosen = node.recommended === true;
    out += sourceGroup(node, `${rect(x + 34, yy, width - 68, rowH - 12, chosen ? COLORS.blueSoft : "#F8FAFC", chosen ? COLORS.blue : COLORS.border, 10, chosen ? 2.5 : 1.5)}${rect(x + 52, yy + 18, 58, 28, chosen ? COLORS.blue : COLORS.grid, chosen ? COLORS.blue : COLORS.grid, 6, 1)}${t(x + 81, yy + 39, String.fromCharCode(65 + index), 16, chosen ? "#FFFFFF" : COLORS.secondary, 750, "middle")}${multiline(x + 128, yy + 34, node.headline, width * 0.42, 19, COLORS.ink, 700, 2)}${multiline(x + width * 0.52, yy + 34, node.detail || "", width * 0.42, 16, COLORS.secondary, 400, 2)}`);
  });
  return out;
}

function renderRisk(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "风险与控制成对呈现，不制造孤立告警");
  if (unit.pairs.length === 1) {
    const pair = unit.pairs[0];
    const top = y + 104;
    const innerHeight = height - 128;
    const split = x + Math.max(300, width * 0.42);
    const color = pair.severity === "high" ? COLORS.amber : COLORS.blue2;
    const markup = `${rect(x + 34, top, width - 68, innerHeight, pair.severity === "high" ? COLORS.amberSoft : "#F8FAFC", COLORS.border, 10, 1)}`
      + `<circle cx="${x + 62}" cy="${top + innerHeight / 2 - 12}" r="8" fill="${color}"/>`
      + multiline(x + 84, top + innerHeight / 2 - 4, pair.risk, split - x - 112, 21, COLORS.ink, 750, 2)
      + line(split, top + 24, split, top + innerHeight - 24, COLORS.border, 2)
      + t(split + 28, top + innerHeight / 2 - 31, "控制措施", 16, color, 700)
      + multiline(split + 28, top + innerHeight / 2 + 2, pair.control, x + width - split - 72, 18, COLORS.secondary, 500, 3);
    return out + sourceGroup(pair.sourceNodeId, markup);
  }
  const start = y + 104;
  const cols = unit.pairs.length > 4 ? 2 : 1;
  const rows = Math.ceil(unit.pairs.length / cols);
  const gap = 10;
  const cardW = (width - 68 - gap * (cols - 1)) / cols;
  const rowH = (height - 128 - gap * (rows - 1)) / rows;
  unit.pairs.forEach((pair, index) => {
    const cx = x + 34 + (index % cols) * (cardW + gap);
    const yy = start + Math.floor(index / cols) * (rowH + gap);
    const color = pair.severity === "high" ? COLORS.amber : COLORS.blue2;
    out += sourceGroup(pair.sourceNodeId, `${rect(cx, yy, cardW, rowH, pair.severity === "high" ? COLORS.amberSoft : "#F8FAFC", COLORS.border, 9, 1)}<circle cx="${cx + 22}" cy="${yy + 27}" r="6" fill="${color}"/>${multiline(cx + 39, yy + 31, pair.risk, cardW - 55, 16, COLORS.ink, 700, 2)}${multiline(cx + 18, yy + 66, `控制：${pair.control}`, cardW - 36, 16, COLORS.secondary, 400, 2)}`);
  });
  return out;
}

function renderInsightCluster(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "用不同图形语言并列呈现架构、成熟度、约束与治理信号");
  const gap = 16;
  const cardW = (width - 68 - gap * (unit.entries.length - 1)) / unit.entries.length;
  const top = y + 102;
  const cardH = height - 126;
  unit.entries.forEach((entry, index) => {
    const node = entry.nodes[0];
    const cx = x + 34 + index * (cardW + gap);
    const warning = entry.type === "risk-control" || node.status === "warning" || node.status === "risk";
    const accent = warning ? COLORS.amber : entry.type === "maturity-bars" ? COLORS.green : COLORS.blue2;
    let markup = rect(cx, top, cardW, cardH, warning ? COLORS.amberSoft : index === 0 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 10, 1);
    markup += t(cx + 20, top + 30, entry.title, 16, accent, 700);
    if (entry.type === "layer-stack" && entry.nodes.length > 1) {
      out += markup;
      const rowTop = top + 47;
      const rowGap = 7;
      const rowH = (cardH - 61 - rowGap * (entry.nodes.length - 1)) / entry.nodes.length;
      entry.nodes.forEach((item, itemIndex) => {
        const yy = rowTop + itemIndex * (rowH + rowGap);
        out += sourceGroup(item, `${rect(cx + 16, yy, cardW - 32, rowH, itemIndex === 0 ? COLORS.surface : "#F8FAFC", COLORS.border, 7, 1)}${multiline(cx + 28, yy + 26, item.headline, cardW * 0.42, 16, COLORS.ink, 700, 2)}${multiline(cx + cardW * 0.48, yy + 26, item.detail || "", cardW * 0.46, 16, COLORS.secondary, 400, 2)}`);
      });
      return;
    } else if (entry.type === "maturity-bars") {
      const level = Number((node.headline.match(/L([1-5])/i) || [0, 2])[1]);
      markup += t(cx + 20, top + 78, `L${level}`, 34, accent, 750);
      markup += rect(cx + 92, top + 54, cardW - 116, 18, COLORS.grid, COLORS.grid, 9, 1);
      markup += rect(cx + 92, top + 54, (cardW - 116) * (level / 5), 18, accent, accent, 9, 1);
      markup += multiline(cx + 20, top + 112, node.headline, cardW - 40, 18, COLORS.ink, 700, 2);
      markup += multiline(cx + 20, top + 158, node.detail || "", cardW - 40, 16, COLORS.secondary, 500, 2);
    } else if (entry.type === "risk-control") {
      const pair = entry.pairs[0];
      markup += multiline(cx + 20, top + 72, pair.risk, cardW - 40, 20, COLORS.ink, 750, 2);
      markup += multiline(cx + 20, top + 119, `控制：${pair.control}`, cardW - 40, 16, COLORS.secondary, 500, 2);
    } else {
      markup += multiline(cx + 20, top + 72, node.headline, cardW - 40, 20, COLORS.ink, 750, 2);
      markup += multiline(cx + 20, top + 119, node.detail || "", cardW - 40, 16, COLORS.secondary, 500, 2);
      markup += rect(cx + 20, top + cardH - 24, Math.max(80, cardW * 0.36), 6, accent, accent, 3, 0);
    }
    out += sourceGroup(node, markup);
  });
  return out;
}

function renderCause(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "把问题按根因聚类，而不是继续平铺描述");
  const cols = unit.nodes.length > 3 ? 2 : 1;
  const gap = 14, cardW = (width - 68 - gap * (cols - 1)) / cols;
  const rows = Math.ceil(unit.nodes.length / cols), cardH = (height - 126 - gap * (rows - 1)) / rows;
  unit.nodes.forEach((node, index) => {
    const cx = x + 34 + (index % cols) * (cardW + gap);
    const cy = y + 102 + Math.floor(index / cols) * (cardH + gap);
    out += sourceGroup(node, `${rect(cx, cy, cardW, cardH, "#F8FAFC", COLORS.border, 9, 1.5)}<circle cx="${cx + 25}" cy="${cy + 27}" r="7" fill="${node.status === "warning" ? COLORS.amber : COLORS.blue2}"/>${multiline(cx + 44, cy + 32, node.headline, cardW - 62, 18, COLORS.ink, 700, 2)}${multiline(cx + 20, cy + 82, node.detail || "", cardW - 40, 16, COLORS.secondary, 400, 3)}`);
  });
  return out;
}

function renderRoadmap(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "阶段目标、里程碑与时间责任放在同一条路径上");
  const n = unit.nodes.length;
  const left = x + 175, right = x + width - 175, cy = y + 178;
  out += line(left, cy, right, cy, COLORS.blue2, 5);
  unit.nodes.forEach((node, index) => {
    const px = left + index * ((right - left) / Math.max(1, n - 1));
    out += sourceGroup(node, `<circle cx="${px}" cy="${cy}" r="13" fill="${COLORS.surface}" stroke="${COLORS.blue2}" stroke-width="6"/>${centeredMultiline(px, cy - 38, node.headline, Math.max(210, (right - left) / n - 30), 16, COLORS.ink, 700, 2)}${centeredMultiline(px, cy + 50, node.detail || "", Math.max(210, (right - left) / n - 30), 16, COLORS.secondary, 400, 2)}`);
  });
  return out;
}

function renderList(unit, x, y, width, height, numbered = false) {
  let out = sectionShell(x, y, width, height, unit.title, numbered ? "明确责任、时间与验收口径" : "保留关键事实，并降低重复表达");
  if (unit.span === 12 && unit.nodes.length >= 2) {
    const gap = 14;
    const cardW = (width - 68 - gap * (unit.nodes.length - 1)) / unit.nodes.length;
    unit.nodes.forEach((node, index) => {
      const cx = x + 34 + index * (cardW + gap);
      let nodeMarkup = rect(cx, y + 101, cardW, height - 126, index === 0 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 8, 1);
      if (numbered) {
        nodeMarkup += `<circle cx="${cx + 25}" cy="${y + 129}" r="14" fill="${COLORS.surface}" stroke="${COLORS.blue}" stroke-width="2"/>${t(cx + 25, y + 134, index + 1, 16, COLORS.blue, 750, "middle")}`;
      } else nodeMarkup += `<circle cx="${cx + 23}" cy="${y + 128}" r="6" fill="${COLORS.blue2}"/>`;
      nodeMarkup += multiline(cx + 48, y + 129, node.headline, cardW - 70, 16, COLORS.ink, 700, 2);
      nodeMarkup += multiline(cx + 20, y + 180, node.detail || "", cardW - 40, 16, COLORS.secondary, 400, 2);
      out += sourceGroup(node, nodeMarkup);
    });
    return out;
  }
  const start = y + 103;
  const rowH = (height - 126) / unit.nodes.length;
  unit.nodes.forEach((node, index) => {
    const yy = start + index * rowH;
    let nodeMarkup = rect(x + 34, yy, width - 68, rowH - 9, index === 0 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 8, 1);
    if (numbered) {
      nodeMarkup += `<circle cx="${x + 58}" cy="${yy + 27}" r="14" fill="${COLORS.surface}" stroke="${COLORS.blue}" stroke-width="2"/>${t(x + 58, yy + 33, index + 1, 16, COLORS.blue, 750, "middle")}`;
    } else nodeMarkup += `<circle cx="${x + 56}" cy="${yy + 27}" r="6" fill="${COLORS.blue2}"/>`;
    nodeMarkup += multiline(x + 82, yy + 27, node.headline, width - 140, 16, COLORS.ink, 700, 1);
    nodeMarkup += multiline(x + 82, yy + 50, node.detail || "", width - 140, 16, COLORS.secondary, 400, 1);
    out += sourceGroup(node, nodeMarkup);
  });
  return out;
}

function renderOutcomeGrid(unit, x, y, width, height) {
  let out = sectionShell(x, y, width, height, unit.title, "保留补充结果，同时避免重复占据主指标区");
  const cols = 2, gap = 12, cardW = (width - 68 - gap) / 2;
  const rows = Math.ceil(unit.nodes.length / cols), cardH = (height - 126 - gap * (rows - 1)) / rows;
  unit.nodes.forEach((node, index) => {
    const cx = x + 34 + (index % cols) * (cardW + gap);
    const cy = y + 102 + Math.floor(index / cols) * (cardH + gap);
    out += sourceGroup(node, `${rect(cx, cy, cardW, cardH, index < 2 ? COLORS.blueSoft : "#F8FAFC", COLORS.border, 8, 1)}${t(cx + 18, cy + 32, node.measure?.display || node.headline, node.measure?.display ? 22 : 16, index < 2 ? COLORS.blue2 : COLORS.ink, 750)}${multiline(cx + 18, cy + 60, node.headline, cardW - 36, 16, COLORS.secondary, 500, 2)}`);
  });
  return out;
}

function renderUnit(unit, x, y, width, height) {
  const renderers = {
    "metric-band": renderMetricBand, "trend-chart": renderTrend, "process-chain": renderProcess,
    "layer-stack": renderLayers, "maturity-bars": renderMaturity, "evidence-samples": renderEvidenceSamples, "evidence-dashboard": renderEvidenceDashboard,
    "stacked-distribution": renderStacked, "option-comparison": renderOptions, "risk-control": renderRisk,
    "cause-map": renderCause, roadmap: renderRoadmap, "insight-cluster": renderInsightCluster,
    "action-list": (u, a, b, c, d) => renderList(u, a, b, c, d, true),
    "decision-panel": (u, a, b, c, d) => renderList(u, a, b, c, d, true),
    "outcome-grid": renderOutcomeGrid, "evidence-ledger": renderList, "information-grid": renderList
  };
  return (renderers[unit.type] || renderList)(unit, x, y, width, height);
}

function pack(units, startY, canvasWidth) {
  const x0 = PAGE_MARGIN, available = canvasWidth - PAGE_MARGIN * 2, gap = 24, col = (available - gap * 11) / 12;
  const positions = [];
  const rows = [];
  for (const unit of units) {
    let row = rows.find((item) => item.used + unit.span <= 12);
    if (!row) {
      row = { used: 0, units: [] };
      rows.push(row);
    }
    row.units.push(unit);
    row.used += unit.span;
  }
  let y = startY;
  for (const row of rows) {
    const rowHeight = Math.max(...row.units.map((item) => item.height));
    let x = x0;
    for (const item of row.units) {
      const width = col * item.span + gap * (item.span - 1);
      positions.push({ unit: item, x, y, width, height: rowHeight });
      x += width + gap;
    }
    y += rowHeight + gap;
  }
  return { positions, height: y + 82 };
}

export function renderCompositionToSvg(composition) {
  const metric = composition.units.find((unit) => unit.type === "metric-band");
  const others = composition.units.filter((unit) => unit !== metric);
  const headerY = 80;
  let startY = 430;
  if (metric) startY += metric.height + 24;
  const preliminary = pack(others, startY, MAX_W);
  const height = preliminary.height;
  const canvasWidth = Math.round(Math.min(MAX_W, Math.max(MIN_W, height * 1.78)));
  const contentWidth = canvasWidth - PAGE_MARGIN * 2;
  const packed = pack(others, startY, canvasWidth);
  const metricMarkup = metric ? renderMetricBand(metric, PAGE_MARGIN, 430, contentWidth, metric.height) : "";
  let body = `<rect width="${canvasWidth}" height="${height}" fill="${COLORS.bg}"/>`;
  body += `<rect x="0" y="0" width="${canvasWidth}" height="18" fill="${COLORS.blue2}"/>`;
  body += t(120, headerY + 46, composition.title, 48, COLORS.ink, 750);
  if (composition.subtitle) body += multiline(120, headerY + 90, composition.subtitle, contentWidth * 0.72, 22, COLORS.secondary, 400, 1);
  body += rect(PAGE_MARGIN, 205, contentWidth, 190, COLORS.surface, COLORS.border, 14, 2);
  body += `<rect x="120" y="205" width="12" height="190" rx="6" fill="${COLORS.blue2}"/>`;
  body += t(165, 250, "核心判断", 19, COLORS.blue2, 750);
  body += sourceGroup(composition.thesis, `${multiline(165, 302, composition.thesis.headline, contentWidth - 100, 30, COLORS.ink, 750, 2)}${composition.thesis.detail ? multiline(165, 365, composition.thesis.detail, contentWidth - 100, 17, COLORS.secondary, 400, 1) : ""}`);
  body += metricMarkup;
  for (const position of packed.positions) body += renderUnit(position.unit, position.x, position.y, position.width, position.height);
  body += t(120, height - 34, `信息覆盖 ${composition.sourceNodeIds.length} 个语义节点 · ${composition.grammarTypes.length} 种图形语法 · 自动构图`, 16, COLORS.secondary, 500);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${height}" viewBox="0 0 ${canvasWidth} ${height}">${body}</svg>`;
}

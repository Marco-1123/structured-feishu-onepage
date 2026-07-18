---
name: structured-feishu-whiteboard
description: >
  Turn reports, plans, research, meeting notes, webpages, Feishu documents, or
  free text into an information-preserving, well-composed, editable Feishu
  OnePage whiteboard. Use for reviews, capability maps, plans, decisions and
  process overviews where content completeness and visual structure matter.
---

# Structured Feishu Whiteboard V6 Alpha.4

Use this Skill as the only workflow and runtime. Resolve `SKILL_DIR` to the
absolute directory containing this `SKILL.md`. Do not handwrite SVG, coordinates, scene JSON, or a
historical template. Do not call a second whiteboard-generation Skill to redraw
the result.

## Workflow

1. Save the complete material as a local UTF-8 source snapshot.
2. Prepare the evidence ledger through the only extraction entry:

```bash
node "$SKILL_DIR/scripts/engine/extract-content.mjs" \
  --source "$SOURCE_FILE" \
  --output-dir "$EXTRACTION_DIR"
```

3. Read every numbered evidence unit and complete the generated `content-draft.json`. Every unit must be marked `preserve`, `merge` or `drop`; protected units cannot be dropped. Mark an option `recommended: true` only when the source explicitly recommends it. Every risk needs an explicit `riskLevel` and source-grounded `control`; do not hide either meaning inside generic detail text.
4. Seal the graph using the same entry:

```bash
node "$SKILL_DIR/scripts/engine/extract-content.mjs" \
  --source "$SOURCE_FILE" \
  --draft "$EXTRACTION_DIR/content-draft.json" \
  --output-dir "$EXTRACTION_DIR"
```

5. Run the only rendering entry with the sealed graph:

```bash
node "$SKILL_DIR/scripts/engine/run.mjs" \
  --graph "$EXTRACTION_DIR/content-graph.json" \
  --output-dir "$RUN_DIR"
```

6. Inspect `whiteboard.png` and `manifest.json`. A passing manifest is necessary
   but the Agent must also reject a page that is visually head-heavy, mechanically
   repetitive, or dominated by unused space.
7. Use `lark-doc` to create a document and `lark-whiteboard` to write `whiteboard.json` as an editable board.
8. Query the written board back as raw nodes and as an image. The queried board
   must preserve node count, visible text, minimum type size and page bounds.
   Inspect the Feishu-side image; local rendering alone is not sufficient.

## Boundaries

- The Agent classifies evidence units and writes a draft; it cannot bypass the evidence ledger or directly author renderable geometry.
- The composition compiler aggregates related facts into visual units and selects graph grammar from the material itself.
- The deterministic renderer owns layout, typography, color semantics and quality checks.
- The user is not asked to choose versions, renderers or templates.
- V3-V5 runners and examples are not part of this repository and cannot be selected.
- A result is not accepted unless every semantic node has a visible final-SVG group, every full headline and numeric claim remains visible, complex material uses multiple appropriate visual grammars, the OnePage aspect ratio is within the quality range, native whiteboard checks report no errors or text occlusion, and the Feishu round trip preserves the generated board.
- The renderer cannot infer a recommendation from option order, convert a risk into a control, or replace source meaning with a generic label.

## Alpha limitation

This alpha replaces scene templates with one composition compiler and packages
the complete runtime inside the Skill. It remains `prototype` until blind
cross-Agent runs reproduce the same evidence coverage, grammar selection and
whole-page composition.

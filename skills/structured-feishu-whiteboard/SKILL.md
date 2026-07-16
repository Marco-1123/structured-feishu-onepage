---
name: structured-feishu-whiteboard
description: >
  Turn reports, plans, research, meeting notes, webpages, Feishu documents, or
  free text into an information-preserving, well-composed, editable Feishu
  OnePage whiteboard. Use for reviews, capability maps, plans, decisions and
  process overviews where content completeness and visual structure matter.
---

# Structured Feishu Whiteboard V6 Alpha.2

Use this Skill as a thin workflow wrapper. Do not handwrite SVG, coordinates or a historical template.

## Workflow

1. Save the complete material as a local UTF-8 source snapshot.
2. Prepare the evidence ledger through the only extraction entry:

```bash
node packages/onepage-engine/src/extract-content.mjs \
  --source <source.md> \
  --output-dir <extraction-directory>
```

3. Read every numbered evidence unit and complete the generated `content-draft.json`. Every unit must be marked `preserve`, `merge` or `drop`; protected units cannot be dropped.
4. Seal the graph using the same entry:

```bash
node packages/onepage-engine/src/extract-content.mjs \
  --source <source.md> \
  --draft <content-draft.json> \
  --output-dir <extraction-directory>
```

5. Run the only rendering entry with the sealed graph:

```bash
node packages/onepage-engine/src/run.mjs \
  --graph <content-graph.json> \
  --output-dir <run-directory>
```

6. Inspect the selected preview and manifest. Production delivery remains disabled while `maturity` is `prototype`.
7. Use `lark-doc` to create a document and `lark-whiteboard` to write `whiteboard.json` as an editable board.

## Boundaries

- The Agent classifies evidence units and writes a draft; it cannot bypass the evidence ledger or directly author a renderable graph.
- The engine owns scene selection, layout, typography, color semantics and quality checks.
- The native Feishu DSL owns Flex/Dagre sizing and connector routing.
- The user is not asked to choose versions, renderers or templates.
- V3-V5 runners and examples are not part of this repository and cannot be selected.
- A result is not accepted unless important-content coverage is 100%, the OnePage aspect ratio is within the quality range, and native whiteboard checks report no overflow, overlap or occlusion.

## Alpha limitation

This alpha fixes the extraction protocol and validates it against a blind corpus. It remains `prototype` until cross-Agent runs reproduce the same evidence coverage and semantic scene family.

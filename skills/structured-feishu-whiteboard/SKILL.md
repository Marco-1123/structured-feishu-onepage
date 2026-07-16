---
name: structured-feishu-whiteboard
description: >
  Turn reports, plans, research, meeting notes, webpages, Feishu documents, or
  free text into an information-preserving, well-composed, editable Feishu
  OnePage whiteboard. Use for reviews, capability maps, plans, decisions and
  process overviews where content completeness and visual structure matter.
---

# Structured Feishu Whiteboard V6 Alpha

Use this Skill as a thin workflow wrapper. Do not handwrite SVG, coordinates or a historical template.

## Workflow

1. Read the complete source material.
2. Build a source-grounded content graph following `references/content-graph-contract.md` and `schemas/content-graph.schema.json`.
3. Run the only engine entry:

```bash
node packages/onepage-engine/src/run.mjs \
  --graph <content-graph.json> \
  --output-dir <run-directory>
```

4. For Alpha validation, inspect the selected preview and manifest. Production delivery remains disabled while `maturity` is `prototype`.
5. Use `lark-doc` to create a document and `lark-whiteboard` to write `whiteboard.json` as an editable board.

## Boundaries

- The Agent owns source reading and source-grounded graph extraction.
- The engine owns scene selection, layout, typography, color semantics and quality checks.
- The native Feishu DSL owns Flex/Dagre sizing and connector routing.
- The user is not asked to choose versions, renderers or templates.
- V3-V5 runners and examples are not part of this repository and cannot be selected.

## Alpha limitation

This alpha validates the new engine architecture. Cross-Agent production release requires a fixed content-graph extraction service and visual review gate; until then, the manifest must identify the result as `prototype`.

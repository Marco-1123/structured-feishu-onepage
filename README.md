# structured-feishu-onepage

V6 clean-room rebuild of `structured-feishu-whiteboard`.

The repository separates the user-facing Skill from the OnePage compiler:

```text
source-grounded content graph
  -> scene candidates
  -> native Feishu whiteboard DSL
  -> render and quality gates
  -> editable whiteboard
```

V6 deliberately does not copy the historical V3-V5 renderers. It uses the native whiteboard DSL layout primitives for text sizing, Flex composition, Dagre topology and connector routing.

## Alpha validation

```bash
npm run validate:alpha
```

The validation uses three source structures: a capability overview, an operating review and an end-to-end process. Every selected result must pass source grounding, important-content coverage, semantic composition, aspect-ratio and native whiteboard overflow/overlap checks.

Generated files are written to `runs/`. The manifest records the selected scene and all quality evidence. V6 remains an alpha until the content-graph extraction step is also fixed and cross-Agent results pass the same gate.

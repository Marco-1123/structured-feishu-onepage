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

## Alpha demo

```bash
npm test
npm run demo
```

The generated files are written to `runs/audit-assistant/`.


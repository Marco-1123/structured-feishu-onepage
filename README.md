# structured-feishu-onepage

V6 clean-room rebuild of `structured-feishu-whiteboard`.

The repository separates the user-facing Skill from the OnePage compiler:

```text
numbered evidence ledger
  -> reviewed and sealed content graph
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

The validation uses six source structures spanning capability overviews, operating reviews, processes, strategy proposals, decisions and project plans. Every selected result must pass source grounding, important-content coverage, semantic composition, aspect-ratio and native whiteboard overflow/overlap checks.

Alpha.2 adds an evidence ledger before the content graph. Every source paragraph must be explicitly preserved, merged or dropped; protected facts, numbers, risks, actions and relationships cannot be silently discarded. Generated files are written to `runs/`. V6 remains an alpha until blind cross-Agent runs reproduce the same evidence coverage and semantic scene family.

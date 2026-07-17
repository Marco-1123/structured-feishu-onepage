# structured-feishu-onepage

V6 clean-room rebuild of `structured-feishu-whiteboard`.

The repository separates the user-facing Skill from the OnePage compiler:

```text
numbered evidence ledger
  -> reviewed and sealed content graph
  -> relationship aggregation
  -> visual grammar selection
  -> adaptive two-dimensional composition
  -> deterministic SVG and editable Feishu nodes
  -> render and quality gates
  -> editable whiteboard
```

V6 deliberately does not copy the historical V3-V5 renderers. Alpha.3 has one
self-contained runtime inside the Skill. It preserves the evidence ledger, then
aggregates semantic relationships into charts, processes, architecture, options,
risks, actions and roadmaps before laying out the page.

## Alpha validation

```bash
npm run validate:alpha
```

The validation uses six source structures spanning capability overviews, operating reviews, processes, strategy proposals, decisions and project plans. Every selected result must pass source grounding, important-content coverage, semantic composition, aspect-ratio and native whiteboard overflow/overlap checks.

Every source paragraph must be explicitly preserved, merged or dropped;
protected facts, numbers, risks, actions and relationships cannot be silently
discarded. Generated files are written to `runs/`. V6 remains an alpha until
blind cross-Agent runs reproduce the same evidence coverage, visual grammar and
whole-page composition.

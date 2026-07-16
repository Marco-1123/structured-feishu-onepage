# Content Graph Contract — Alpha.2

The sealed content graph is the only semantic input accepted by the V6 engine. Agents cannot write it directly.

## Required extraction loop

1. Run `extract-content` without a draft. It creates numbered evidence units and a draft template.
2. Read every evidence unit and complete every `sourceDecision` as `preserve`, `merge` or `drop`.
3. Each node must cite `sourceUnitIds` and an exact `sourceQuote` from those units.
4. Run the same command with `--draft`. Only a passing draft is sealed as `content-graph.json`.
5. Pass only the sealed graph to `onepage-engine`.

- Read the full source before creating nodes.
- Every node has one atomic meaning and a verbatim `sourceQuote`.
- Preserve all critical, high and medium information unless the source repeats the same meaning.
- Use explicit edges only when the source supports the relationship.
- Do not invent metrics, risks, actions, sequence, actors or causality to qualify a visual scene.
- Keep the full meaning in `headline` and `detail`; the renderer, not the Agent, controls visible wrapping.
- Layout, coordinates, card sizes, colors and component names are forbidden in the content graph.
- Units containing numbers, risks, actions, process relationships or evidence signals are protected and cannot be dropped.
- Every number in a protected unit must remain visible in at least one destination node.

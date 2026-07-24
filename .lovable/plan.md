# Circuit Sage v2 — Build Plan

The spec (Master Build Spec v2) is a 13-milestone roadmap. It is far too large for a single message, and section 14 explicitly says "hand these to Lovable as separate milestones. Verify each before starting the next." I'll follow that order.

## What I propose for this turn

Ship **M1 + start of M2** — the smallest thing that makes every later milestone verifiable.

### M1 — The test matrix (this turn)

- New file `src/lib/circuit-model.ts` — the `CircuitModel`, `Component`, `Quantity`, `Waveform`, `ControlRef`, `Node`, `Port`, `Coupling`, `AnalysisRequest` types from §3. Types only, no logic. `Quantity` is a struct, never a string.
- New file `src/test/matrix/` — one `.problem.ts` per row, each exporting `{ id, source, model, questions, expected, tolerance }`. Sourced from the two core-course lists in §10.
- Seed with ~15 rows covering: series/parallel reduction, divider, nodal, mesh, supernode, superposition, Thévenin, Norton, max power, ideal op-amp, first-order RC/RL, second-order RLC (all three damping cases), phasor SS, AC power. Rest stubbed with `it.todo`.
- New file `src/test/matrix/runner.test.ts` — iterates every row, calls a `solve(model, question)` shim that currently throws `NOT_IMPLEMENTED`. All rows red on purpose. This is the "done" definition for §9.

### M2 start — Preflight skeleton

- New file `src/lib/preflight.ts` — returns `{ blocking: Issue[], warnings: Issue[] }`. Implements the blocking checks from §4 (dangling terminal, no reference node, unresolved control ref, unit mismatch, fusion errors, transient with null initial + no switch history, ambiguous dot, v-source loop / i-source cut set).
- Preflight tests in `src/test/preflight.test.ts` — one failing model per blocking rule, one passing model.

### What I am NOT touching this turn

- `useAuth`, tier config, Stripe wiring, existing solver components (`QuickSolverTab`, `DCAnalysisTab`, etc.), edge functions, landing page, design tokens. Per §14: keep existing wiring.
- Old `src/lib/circuit-solver.ts` etc. stay untouched. M2's later half re-wires them to the new model; that's a separate turn.

## Technical notes

- Vitest already configured (`vitest.config.ts`, `src/test/example.test.ts`).
- `Quantity.magnitude` is a `number` in base SI. `unit` is a tagged string (`"ohm" | "farad" | "henry" | "volt" | "amp" | "hertz" | "second"`). `prefix` is view-only.
- `Component.confidence` splits `exists` and `value` per §3.
- `Component.provenance` records `from: 'drawing' | 'text' | 'both'` for the §2.2 checksum.
- `AnalysisRequest.at` accepts `'0-' | '0+' | 'inf' | number | 'expression'` as first-class values (§3.1).

## After this turn — subsequent milestones

Each is its own turn, in order, verified against the test matrix:

- **M2 finish** — port existing solvers to consume `CircuitModel`; matrix rows go green.
- **M3** — self-verification (analytic vs numeric independent path).
- **M4** — page-read pipeline (clean genre only), fusion errors surfaced.
- **M5** — worked math view with KaTeX + live component refs.
- **M6** — drawings, in the §5.2 teaching order.
- **M7** — assumption ledger.
- **M8** — landing page at `/`, solver moved to `/solve`.
- **M9** — export (PDF/DOCX/LaTeX/SPICE/CSV/SVG) + comparison mode.
- **M10** — real components (E-series, ratings, tolerance, Monte Carlo, sensitivity).
- **M11** — synthesis (narrow set).
- **M12** — remaining input genres.
- **M13** — 3D voltage terrain.

Approve to start M1.

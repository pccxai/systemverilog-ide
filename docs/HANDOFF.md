# Handoff notes

This document is a placeholder for two boundaries the scaffold CLI does
**not** yet talk to:

1. The `pccx-lab` CLI / core boundary (analysis backend).
2. The xsim runner / log surfacing path inside `pccx-lab`.

Both will be wired up only after `pccx-lab` formalises its CLI / core
contract. Until then, this repo intentionally stops at the diagnostics
envelope schema — see [`schema/diagnostics-v0.json`](../schema/diagnostics-v0.json).

## pccx-lab handoff (planned)

When the `pccx-lab` CLI exposes a stable `analyze` subcommand that
emits diagnostics in (or convertible to) the v0 envelope, this CLI is
expected to:

1. Resolve the `pccx-lab` binary on `$PATH` or via `PCCX_LAB_BIN`.
2. Forward the file under inspection through that binary.
3. Validate the response against `schema/diagnostics-v0.json`.
4. Re-emit the response from this CLI without re-analysing.

The IDE side (later: VS Code extension, GUI shell, MCP-controlled
flows) consumes that same envelope. There is no private back channel
between the GUI and `pccx-lab` internals.

## xsim handoff (planned)

xsim runs and log surfacing remain on the `pccx-lab` side. This CLI is
expected only to:

1. Pass through a `run` request to `pccx-lab`.
2. Translate the resulting log / report into the same diagnostics
   envelope where it makes sense, or surface a structured run-summary
   document (envelope version to be defined alongside the lab CLI).

## Open questions

- Whether the envelope grows a `metadata` object at v1, and what
  fields belong inside (e.g. `commit`, `pccx-lab-version`).
- Whether multi-file batches are represented as one envelope per file
  or one envelope with a list of `source` entries.
- How verification status (xsim pass/fail counts) is layered on top of
  the diagnostics envelope.

These are intentionally unresolved while the scaffold matures.

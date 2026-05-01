# pccx-systemverilog-ide

SystemVerilog IDE layer for the PCCX tooling stack.

## What this repo is

The IDE-adjacent surface that is being **spun out of [pccx-lab][pccx-lab]**.
This is not a greenfield project — the initial code base traces back to
IDE-shaped work that already lives in `pccx-lab`. As that work matures
its CLI / core boundary, the IDE-side pieces will land here while
verification, trace analysis, and diagnostics remain in `pccx-lab`.

## Status

Public surface is intentionally minimal while the `pccx-lab` CLI / core
boundary is being stabilized. The IDE will follow that boundary; it does
not duplicate analysis logic locally.

## Integration model

`pccx-lab` is **CLI-first**. The IDE consumes the same CLI / core
contract that the lab CLI itself uses. VS Code extensions and any
MCP-controlled flows ride on top of the same contract; they do not get a
private back channel into the lab internals.

Development order is fixed:

1. CLI / core boundary first (in `pccx-lab`).
2. IDE GUI surface second (in this repo).
3. VS Code extension and MCP-controlled flows on top.

If a feature would need a side channel that bypasses the CLI / core
contract, that is a signal the contract needs to grow first — not a
signal to add a back door from the GUI.

## Initial track (near-term)

- SystemVerilog navigation backed by `pccx-lab` analysis.
- Diagnostics surfaced from the same place the lab CLI surfaces them.
- xsim run launching and log handoff via the CLI / core boundary.
- Project-aware view of `pccx-lab` artifacts (traces, run reports,
  verification status).

## Later track (deferred)

- AI workers can interact with `pccx-lab` through a controlled MCP
  interface; the IDE surfaces those flows but does not own the
  contract.
- Evolutionary generate / simulate / evaluate / refine loop, again
  driven through the lab boundary.
- VS Code extension distribution.

These items are explicitly *deferred* — not part of the near-term
surface — and depend on the CLI / core boundary in `pccx-lab` being
formal enough to bind to.

## Non-goals

- Not a Vivado replacement.
- No claim of complete LSP coverage today.
- This repo is not labelled as stable, and there is no commitment to a
  frozen plugin ABI yet.
- No autonomous hardware design claim.
- No automatic merge or release actions driven by the IDE.

## Related

- [pccxai/pccx][pccx] — spec / docs / roadmap / release coordination
- [pccxai/pccx-lab][pccx-lab] — verification lab + CLI / core boundary
- [pccxai/pccx-FPGA-NPU-LLM-kv260][pccx-fpga] — RTL / KV260 / hardware evidence
- [pccxai/pccx-llm-launcher][pccx-launcher] — user-facing local LLM launcher

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

[pccx]: https://github.com/pccxai/pccx
[pccx-lab]: https://github.com/pccxai/pccx-lab
[pccx-fpga]: https://github.com/pccxai/pccx-FPGA-NPU-LLM-kv260
[pccx-launcher]: https://github.com/pccxai/pccx-llm-launcher

# systemverilog-ide

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

## Current scaffold

The repository currently contains a placeholder Python CLI that emits
the **diagnostics envelope** the IDE expects to consume from
`pccx-lab`. The CLI does not perform real semantic analysis — its
checks are file-shape level only (file exists, file non-empty,
`module` / `endmodule` present). The envelope schema is the artifact
that matters; analysis arrives later, through `pccx-lab`.

```bash
# Diagnostics check — JSON output (default)
python -m pccx_ide_cli check fixtures/ok_module.sv
python -m pccx_ide_cli check fixtures/missing_endmodule.sv

# Diagnostics check — human-readable text output
python -m pccx_ide_cli check fixtures/ok_module.sv --format text
python -m pccx_ide_cli check fixtures/missing_endmodule.sv --format text

# Diagnostics check — pccx-lab backend (requires binary)
PCCX_LAB_BIN=/path/to/pccx-lab \
    python -m pccx_ide_cli check fixtures/ok_module.sv --backend pccx-lab --format text

# Module index (early scaffold — not a full parser)
python -m pccx_ide_cli index fixtures/modules/simple_module.sv
python -m pccx_ide_cli index fixtures/modules/ --format text

# Module index with name filter (exact, case-sensitive)
python -m pccx_ide_cli index fixtures/modules/ --query simple_mod
python -m pccx_ide_cli index fixtures/modules/ --query simple_mod --format text

# Module locate (early navigation scaffold — not LSP, not stable API)
python -m pccx_ide_cli locate fixtures/modules/ simple_mod
python -m pccx_ide_cli locate fixtures/modules/ simple_mod --format text

# xsim log handoff scaffold (parses existing log files only)
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format json
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format text

# Print the diagnostics schema
python -m pccx_ide_cli schema
```

Diagnostics text output format:
```
backend: scaffold
source: fixtures/missing_endmodule.sv
1 diagnostic
fixtures/missing_endmodule.sv:1:1: error: PCCX-SCAFFOLD-003: `module` declared but no matching `endmodule` found
```

Module index text output format:
```
source: fixtures/modules/
3 modules
fixtures/modules/simple_module.sv:1:1: module simple_mod
fixtures/modules/two_modules.sv:1:1: module mod_a
fixtures/modules/two_modules.sv:3:1: module mod_b
```

Module locate text output format (one match, exit 0):
```
module simple_mod
fixtures/modules/simple_module.sv:1:0
```

No match exits 1. Multiple matches exit 2 with all candidates listed.
`locate` is an early navigation scaffold, exact name only, not semantic
navigation, not LSP, not a stable API. A future editor bridge can consume
this output.

`xsim-log` is an early handoff scaffold. It parses existing synthetic
xsim-style log files into diagnostics-like JSON or text output. It does
not run xsim or Vivado, does not prove hardware correctness, and does
not claim full Vivado/xsim coverage. The output shape is pre-stable; a
future `pccx-lab` integration may provide richer log and report handoff.

Tests are run with:

```bash
python -m pytest -q
```

The envelope shape is fixed in [`schema/diagnostics-v0.json`](./schema/diagnostics-v0.json).
Handoff notes for the eventual `pccx-lab` and xsim integration paths
live in [`docs/HANDOFF.md`](./docs/HANDOFF.md).

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

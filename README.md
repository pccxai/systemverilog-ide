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

## Architecture roles

- `systemverilog-ide` is the editor cockpit: VS Code commands,
  presentation boundaries, opt-in live workspace command shape, and
  future context bundle construction.
- `pccx-lab` is the CLI-first verification/tooling backend. Reusable
  analysis and validation behavior should flow through the facade and
  CLI/core contract instead of being duplicated here.
- `pccx-llm-launcher` is a future local LLM/chat backend candidate for
  local coding-assistant mode. This repository currently contains only
  boundary work for AI-assisted SystemVerilog development workflow
  experiments: AI assistant status/context commands, no AI provider calls,
  no pccx-llm-launcher runtime calls yet, and no MCP server implementation.

## Initial track (near-term)

- SystemVerilog navigation through the CLI/editor bridge boundary.
- Diagnostics surfaced from the same place the lab CLI surfaces them.
- Existing xsim log handoff through the CLI / core boundary; xsim run
  launching remains a planned integration path.
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

# Module/declaration index (early scaffold — not a full parser)
python -m pccx_ide_cli index fixtures/modules/simple_module.sv
python -m pccx_ide_cli index fixtures/modules/ --format text

# Module index with name filter (exact, case-sensitive)
python -m pccx_ide_cli index fixtures/modules/ --query simple_mod
python -m pccx_ide_cli index fixtures/modules/ --query simple_mod --format text

# Declaration locate (early navigation scaffold — not LSP, not stable API)
python -m pccx_ide_cli locate fixtures/modules/ simple_mod
python -m pccx_ide_cli locate fixtures/modules/ pkg_defs --kind package
python -m pccx_ide_cli locate fixtures/modules/ bus_if --kind interface
python -m pccx_ide_cli locate fixtures/modules/ simple_mod --format text

# Declaration export for editor bridge consumers (pre-stable)
python -m pccx_ide_cli declarations fixtures/modules/ --format json

# xsim log handoff scaffold (parses existing log files only)
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format json
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format text

# Editor problem export scaffold (pre-stable)
python -m pccx_ide_cli problems from-check fixtures/missing_endmodule.sv --format json
python -m pccx_ide_cli problems from-xsim-log fixtures/xsim/mixed.log --format text

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

`index` also emits a pre-stable `declarations[]` JSON list for simple
`module`, `package`, and `interface` declarations.  This is scanner-based
navigation support, not semantic resolution or a full parser.

Declaration locate text output format (one match, exit 0):
```
module simple_mod
fixtures/modules/simple_module.sv:1:1
```

No match exits 1. Multiple matches exit 2 with all candidates listed.
`locate` defaults to module-only compatibility and can target
`--kind module|package|interface|any`. It is an early scanner-based
navigation scaffold, exact name only, not semantic navigation, not LSP,
not a stable API. A future editor bridge can consume this output.

`declarations` exports the same pre-stable module/package/interface
records used by `index` without the legacy module-only wrapper. It is a
CLI bridge scaffold, not semantic resolution or a full parser.

`xsim-log` is an early handoff scaffold. It parses existing synthetic
xsim-style log files into diagnostics-like JSON or text output. It does
not run xsim or Vivado, does not prove hardware correctness, and does
not claim full Vivado/xsim coverage. The output shape is pre-stable; a
future `pccx-lab` integration may provide richer log and report handoff.

`problems` is an early editor bridge scaffold. It exports
editor-friendly problem records from existing local diagnostics and
xsim-log parsing. It does not implement LSP, a VS Code extension,
a JetBrains plugin, or any GUI. It does not run xsim or Vivado. The
output shape is pre-stable; future editor bridges may consume it.

The external editor bridge CLI contract is documented in
[`docs/EDITOR_BRIDGE_CONTRACT.md`](./docs/EDITOR_BRIDGE_CONTRACT.md).
It is a pre-stable CLI contract, not an editor extension implementation.

Tests are run with:

```bash
python -m pytest -q
bash scripts/editor-bridge-smoke.sh
```

The current pre-stable envelope shape is described in
[`schema/diagnostics-v0.json`](./schema/diagnostics-v0.json).
Handoff notes for the eventual `pccx-lab` and xsim integration paths
live in [`docs/HANDOFF.md`](./docs/HANDOFF.md).

The experimental VS Code prototype under
[`editors/vscode-prototype`](./editors/vscode-prototype) keeps
checked-example mode as the safe default. Live workspace commands are
opt-in and require an explicit configuration gate; the current local
coding-assistant mode work is limited to AI assistant status and
token-saving context bundle commands with no provider calls.  The
guarded Extension Host runtime smoke uses only the controlled fixture
under `editors/vscode-prototype/test/fixtures/live-workspace`.

## Later track (deferred)

- Local coding-assistant mode can propose interactions with `pccx-lab`
  through a controlled tool boundary; the IDE surfaces those flows but
  does not own the reusable analysis contract.
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

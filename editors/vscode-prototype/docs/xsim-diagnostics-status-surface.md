# xsim Diagnostics Status Surface

This document describes the VS Code prototype boundary for existing
`xsim-log` problem JSON. It is an experimental, read-only status surface
over JSON that has already been produced by:

```bash
python -m pccx_ide_cli problems from-xsim-log <log-file> --format json
```

The implementation lives in:

- `src/xsim-diagnostics-status-surface.mjs`
- `test/xsim-diagnostics-status-surface.test.mjs`
- `../../docs/examples/editor-bridge/problems-xsim-mixed.example.json`

## What It Does

The surface validates the `editor-problems` payload shape for
`source_kind: xsim-log` and returns deterministic summary data:

- total problem count
- counts by severity
- located, unlocated, and coded problem counts
- relative source-file references with per-file counts
- read-only safety flags
- bounded limitations for context bundle use

`pccxSystemVerilog.buildAIContextBundle` can include the same summary as
an `xsimDiagnostics` section. That context section is summary-only and
does not include raw xsim log lines, full logs, private paths, secrets,
model artifact paths, or hardware dumps.

## Surface Sketch

The current local text surface is intentionally small:

```text
xsim Diagnostics Summary
source: fixtures/xsim/mixed.log
sourceKind: xsim-log
diagnostics: 5
severity: error=2 warning=2 info=1 hint=0
locations: located=2 unlocated=3
readOnly: yes
dataOnly: yes
execution: no xsim, no Vivado, no pccx-lab, no launcher, no shell, no hardware
```

Future UI presentation can map the same summary into a compact status
panel or diagnostics-context badge. Any inline editor diagnostics still
come from the existing adapter problem conversion path.

## What It Does Not Do

This boundary does not:

- run xsim or Vivado
- execute `pccx-lab`
- execute `pccx-llm-launcher`
- spawn shell commands
- read raw log files in the UI layer
- echo raw log lines into context bundles
- access hardware or KV260 runtime paths
- load model weights
- call providers or network APIs
- implement MCP
- implement LSP
- upload telemetry
- write back to launcher, lab, or repository state
- commit to API or ABI stability

The `pccx-lab` CLI/core boundary remains the owner for reusable
verification and diagnostics behavior. This status surface is only an
IDE-side summary over already-produced local JSON.

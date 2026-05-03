# Diagnostics and xsim Integration Plan

This document records the planning boundary for
`pccxai/systemverilog-ide#3`. It covers the diagnostic schema draft,
read-only xsim log integration path, and editor surface sketches. It is
planning documentation only: it does not add xsim, Vivado, pccx-lab,
launcher, shell, provider, hardware, MCP, or LSP execution.

## Shared Diagnostic Schema Draft

The IDE consumes diagnostics as `editor-problems` JSON. The current
checked examples are:

- [`problems-check-missing-endmodule.example.json`](examples/editor-bridge/problems-check-missing-endmodule.example.json)
- [`problems-xsim-mixed.example.json`](examples/editor-bridge/problems-xsim-mixed.example.json)

The same adapter shape can carry diagnostics derived from the built-in
scaffold, from the pccx-lab CLI/core diagnostics envelope, or from an
existing xsim-style log parser. pccx-lab remains the reusable
verification and analysis owner; this repository only maps data into an
editor-facing problem list.

Top-level fields:

| Field | Required | Meaning |
|---|---:|---|
| `kind` | yes | Always `editor-problems` for this adapter surface. |
| `tool` | yes | Producer id, currently `pccx-ide-cli`. |
| `source_kind` | yes | `check` for file diagnostics or `xsim-log` for existing log diagnostics. |
| `source` | yes | Repository-relative or supplied local input reference. |
| `problems` | yes | Deterministically sorted problem records. |

Problem fields:

| Field | Required | Meaning |
|---|---:|---|
| `severity` | yes | `error`, `warning`, `info`, or `hint`. |
| `message` | yes | Short diagnostic message for editor presentation. |
| `source_kind` | yes | Matches the top-level source kind. |
| `file` | optional | Relative source file when the diagnostic is located. |
| `line` | optional | 1-based source line when located. |
| `column` | optional | 1-based source column when located. |
| `code` | optional | Tool diagnostic code such as `PCCX-SCAFFOLD-003`, `VRFC 10-1234`, or `XSIM 43-9999`. |
| `raw` | optional | Original xsim-style line for CLI traceability; omitted from context summaries. |

Mapping notes:

- pccx-lab diagnostics enter through the `check --backend pccx-lab`
  CLI/core boundary and are normalized before schema validation.
- Existing xsim log diagnostics enter through `problems from-xsim-log`.
- Located xsim diagnostics may include `file`, `line`, and `column`.
  Unlocated diagnostics remain valid and are surfaced in summary views.
- Future waveform or time references should be added as bounded optional
  fields only after a checked pccx-lab report/log contract exists. The
  IDE should not infer waveform state from raw logs.

## Read-Only xsim Path

Current path:

```text
existing xsim-style log file
  -> python -m pccx_ide_cli problems from-xsim-log <log-file> --format json
  -> editor-problems JSON
  -> adapter diagnostics, status summary, and context summary
```

The VS Code prototype summary is documented in
[`../editors/vscode-prototype/docs/xsim-diagnostics-status-surface.md`](../editors/vscode-prototype/docs/xsim-diagnostics-status-surface.md).
It records total count, severity counts, located/unlocated counts, coded
count, relative file counts, and safety flags. Context bundles include
the summary only; they do not include raw log lines or full logs.

Future pccx-lab integration should preserve the same direction:

```text
pccx-lab CLI/core log or report summary
  -> checked JSON contract
  -> IDE adapter
  -> editor-problems JSON or bounded status summary
  -> UI surface
```

The IDE should not run xsim or Vivado, invoke pccx-lab to parse logs
without an explicit reviewed command boundary, read raw logs in the UI
layer, or treat a log summary as hardware evidence.

## Surface Sketches

Inline annotations:

```text
src/top.sv:12
  error VRFC 10-1234  module declaration failed
```

Rules:

- use `file`, `line`, and `column` only when present
- mark unlocated diagnostics in a separate summary row
- keep `source_kind` visible in hover/detail text
- do not display raw xsim lines by default

Problems panel:

```text
Problems
  xsim-log  5
    error    2
    warning  2
    info     1
  files
    src/top.sv   1
    src/warn.sv  1
  unlocated      3
```

Jump-to-source:

```text
select located problem -> open file -> reveal 1-based line/column mapped to editor position
select unlocated problem -> open summary detail, not a guessed file
```

Log viewer:

```text
xsim Diagnostics Summary
source: fixtures/xsim/mixed.log
diagnostics: 5
located: 2
unlocated: 3
execution: none
```

The log viewer is a summary view over already-produced JSON. A full raw
log viewer needs a separate reviewed data contract.

Status/context badge:

```text
xsim: 5 diagnostics, 2 located, read-only
```

The badge may feed the bounded context bundle as `xsimDiagnostics`. It
must remain summary-only.

## Non-Goals

- no xsim or Vivado execution
- no pccx-lab execution from this planning slice
- no launcher execution
- no shell command expansion
- no provider, network, telemetry, or upload flow
- no hardware access, KV260 runtime path, model load, or model weight path
- no MCP or LSP implementation
- no package distribution or stable compatibility claim
- no repository write-back

## Validation

Focused checks for this planning boundary:

```bash
python -m pytest -q
bash scripts/editor-bridge-smoke.sh
bash scripts/check-editor-bridge-examples.sh
bash scripts/vscode-adapter-smoke.sh
python3 scripts/check-source-headers.py
git diff --check
```

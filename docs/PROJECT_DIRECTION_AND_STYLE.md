# Project Direction and Style

This document pins the repository hygiene, direction, and style rules for
`systemverilog-ide` before approved runner UX expands further.

## Current Role

`systemverilog-ide` remains a pccx-lab spin-out and a
data-boundary-first editor cockpit. It may present diagnostics,
navigation, context, proposal, status, and approved validation surfaces,
but those surfaces consume data and contracts through controlled adapters.

The repository must not become a launcher/lab execution island. Reusable
analysis, validation, runtime ownership, and hardware evidence stay behind
the owning repo boundaries.

## Direction Sync: May 3, 2026

- `pccx-FPGA-NPU-LLM-kv260` remains active v002/v0.2.0 bring-up and
  evidence work. No KV260 inference works claim. No Gemma 3N E4B on
  KV260 claim. No 20 tok/s achieved claim. No timing closure claim.
- `pccx-llm-launcher` owns launcher-facing local LLM workflow direction
  and has diagnostics handoff plus runtime readiness contract work. This
  repository may consume checked diagnostics handoff and runtime readiness
  data through explicit read-only boundaries, but it does not call the
  launcher.
- `pccx-lab` remains CLI-first and GUI-second. Its diagnostics handoff
  validator is a separate CLI/core boundary; this repository does not
  invoke it and does not bypass pccx-lab ownership.

Development order stays fixed: CLI/core/data boundary first, editor
presentation second, controlled execution only after explicit allowlisted
approval boundaries. Approved runner UX work must preserve the existing
fixed-command, no-shell, bounded-output, disabled-by-default model.

## Safety Boundaries

- No launcher execution.
- No pccx-lab execution from this repository.
- No pccx-lab diagnostics handoff validator invocation.
- No arbitrary shell execution.
- No LSP implementation.
- No MCP runtime implementation.
- No model provider integration.
- No KV260 runtime integration.
- No telemetry, upload, write-back, release, or tag flow.
- No production-ready claim.
- No stable release claim.
- No stable API/ABI claim.
- No marketplace-ready claim.
- No KV260 inference works claim.
- No Gemma 3N E4B on KV260 claim.
- No 20 tok/s achieved claim.
- No timing closure claim.

Keep diagnostics handoff, runtime readiness, launcher status, pccx-lab
command descriptors, context bundles, validation proposals, patch
proposals, and validation result caches as data surfaces unless a later
PR explicitly extends a reviewed boundary with tests.

## Engineering Direction

Preserve the Jim Keller-inspired engineering direction already used in
this repository:

- target-first design
- deep modules with simple external contracts
- evidence over optimism
- readable code for ordinary engineers
- validation-driven changes
- no shallow module churn
- no broad rewrite without tests
- preserve physical/verification/runtime evidence boundaries
- do not hide architecture risk behind polished UI

Direction changes should show target, boundary, evidence, and validation
impact before they polish presentation.

## SystemVerilog and RTL-Adjacent Style

Preserve local naming and comment conventions in fixtures, examples, and
future RTL-adjacent content:

- preserve signal naming such as `input logic IN_*`
- preserve signal naming such as `output logic OUT_*`
- preserve existing internal local naming patterns in the touched file
- preserve section comments such as `// ===| Section |===`
- preserve aligned multi-line comments where already used
- do not mass-rename signals
- do not introduce software-style OOP patterns into synthesizable RTL examples

Fixture changes should stay small and test-driven. Do not reformat or
renarrate RTL-adjacent examples just to make them look more like software.

## JavaScript and VS Code Prototype Style

Preserve the existing prototype style:

- preserve existing module/import/export style
- preserve deterministic JSON output style
- preserve bounded output patterns
- preserve no-shell/no-runtime/no-provider boundary checks
- keep adapter/context/proposal/runner boundaries explicit and small

The VS Code prototype should remain a thin cockpit over checked examples,
opt-in live workspace commands, normalized context, status, proposals, and
approved validation command results. It should not absorb launcher,
pccx-lab, model provider, MCP, LSP, hardware, telemetry, upload, or
write-back responsibility.

## Source Header Policy

New code files and changed legacy code files need the repository header:

```text
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai
```

For Python and shell, use `#` comments. For files with a shebang, keep
the shebang first and put the two header lines immediately after it.

The guard is:

```bash
python3 scripts/check-source-headers.py
```

`scripts/source-header-legacy-baseline.json` records the hash of existing
tracked code files that predate this policy and still lack headers. New
code files without headers fail the guard. Changed legacy code files also
fail until the required header is added.

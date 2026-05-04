# Handoff notes

This document describes the controlled integration boundary between
`pccx-ide` (this CLI) and `pccx-lab`.

Tracked handoff paths:

1. The `pccx-lab` CLI / core boundary (analysis backend) — **wired**.
2. The xsim runner / log surfacing path inside `pccx-lab` — **planned**.
   Existing xsim-log problem JSON can be summarized locally as a
   read-only IDE status/context surface.
3. The launcher diagnostics handoff JSON consumer — **read-only fixture
   boundary**.
4. The launcher runtime readiness JSON consumer — **read-only fixture
   boundary**.
5. The launcher device/session status JSON consumer — **read-only fixture
   boundary**.

Direction and style rules for preserving those boundaries are pinned in
[`PROJECT_DIRECTION_AND_STYLE.md`](./PROJECT_DIRECTION_AND_STYLE.md).
The SystemVerilog workflow planning boundary is documented in
[`SYSTEMVERILOG_WORKFLOW_BOUNDARY.md`](./SYSTEMVERILOG_WORKFLOW_BOUNDARY.md).
The evolutionary loop planning boundary is documented in
[`EVOLUTIONARY_LOOP_PLAN.md`](./EVOLUTIONARY_LOOP_PLAN.md).
The external editor integration planning boundary is documented in
[`EXTERNAL_EDITOR_INTEGRATION_PLAN.md`](./EXTERNAL_EDITOR_INTEGRATION_PLAN.md).
The module organization workflow is documented in
[`MODULE_ORGANIZATION_WORKFLOW.md`](./MODULE_ORGANIZATION_WORKFLOW.md).
The diagnostics/xsim planning boundary for issue #3 is tracked in
[`DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md`](./DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md).

---

## direction sync (May 3, 2026)

`systemverilog-ide` remains a data-boundary-first editor cockpit spun out
of `pccx-lab`. It consumes CLI/core and diagnostics handoff data through
controlled adapters; it does not become a launcher/lab execution island.

Current cross-repo direction:

- `pccx-FPGA-NPU-LLM-kv260` remains active v002/v0.2.0 bring-up and
  evidence work. This handoff does not claim KV260 inference works, does
  not claim Gemma 3N E4B runs on KV260, does not claim 20 tok/s achieved,
  and does not claim timing closure.
- `pccx-llm-launcher` owns launcher-facing local LLM workflow direction,
  diagnostics handoff contract work, and runtime readiness data for the
  planned Gemma 3N E4B plus KV260 path. This repository consumes checked
  launcher data only through read-only adapter surfaces.
- `pccx-lab` remains CLI-first and GUI-second. Its diagnostics handoff
  validator remains outside this repository; this repository does not
  invoke that validator.

Approved runner UX work must preserve the current fixed-command,
allowlisted, no-shell, bounded-output, user-approved boundary. It must not
add launcher execution, pccx-lab execution, model provider calls, MCP/LSP
runtime, KV260 runtime integration, telemetry, upload, or write-back.

## pccx-lab diagnostics handoff (active)

This repository expects the pccx-lab CLI/core boundary to expose
`analyze <path> [--format json]` with an early diagnostics envelope.  The
`pccx-ide check --backend pccx-lab` flag wires this path when the
pccx-lab binary is configured.

### Usage

```bash
# Default: built-in scaffold checks (no external binary needed)
python -m pccx_ide_cli check fixtures/ok_module.sv

# Opt-in: forward through pccx-lab CLI / core boundary
PCCX_LAB_BIN=/path/to/pccx-lab \
    python -m pccx_ide_cli check fixtures/ok_module.sv --backend pccx-lab

# pccx-lab on PATH (PCCX_LAB_BIN takes priority if both are set)
python -m pccx_ide_cli check fixtures/ok_module.sv --backend pccx-lab
```

### PCCX_LAB_BIN resolution order

1. `PCCX_LAB_BIN` environment variable (non-empty, absolute path).
2. `pccx-lab` on `$PATH` via `shutil.which`.
3. Hard error with a clear message — no silent fallback to scaffold
   analysis when the pccx-lab backend is explicitly requested.

A missing binary is a configuration error, not a graceful degradation
case.  The scaffold analysis will never substitute silently.

### Adapter rules

Two narrow transformations are applied to the raw pccx-lab output before
schema validation and forwarding:

1. **`_note` stripped** — pccx-lab includes a `_note` comment field that
   is explicitly described as "not a stable API contract".  It is a
   comment, not data.  It is removed before validation.

2. **line/column 0 → 1** — pccx-lab uses `line: 0, column: 0` to
   indicate an unknown source location.  The `diagnostics-v0.json`
   schema requires `minimum: 1`.  Values below 1 are clamped to 1 per
   diagnostic.

No other transformations are applied.  Any unknown top-level field
beyond `_note` causes a schema validation error rather than silent
discard — drift between pccx-lab and the v0 schema should surface
loudly while both sides are pre-stable.

### Exit codes

Exit codes pass through from pccx-lab to the CLI caller:

| pccx-lab exit | meaning | CLI exit |
|---|---|---|
| 0 | no diagnostics | 0 |
| 1 | diagnostics found | 1 |
| 2 | I/O error | 2 |

Internal CLI errors (JSON parse failure, schema validation failure) also
exit 2 with a message on stderr.

### Claims

- The default scaffold remains available for local development and
  testing without any external binary.
- The pccx-lab backend is opt-in; it requires explicit `--backend pccx-lab`.
- pccx-lab output is an early diagnostics envelope — pre-stable, not a
  committed API contract.
- This CLI does not implement a full SystemVerilog semantic parser.
- This CLI does not implement an LSP server.
- There is no stable plugin ABI claim.
- There is no full IDE replacement claim.

---

## launcher diagnostics handoff consumer (read-only)

The VS Code prototype includes a small adapter for
`pccx.diagnosticsHandoff.v0` launcher diagnostics handoff JSON. The
adapter reads a local JSON value supplied by tests or future UI code,
validates the expected field shape, and returns deterministic summary
data.

The checked fixture lives at
`docs/examples/diagnostics-handoff/launcher-diagnostics-handoff.example.json`.

`pccxSystemVerilog.showDiagnosticsHandoffSummary` is a prototype status
surface over the adapter output. It consumes the deterministic consumer
summary as data, returns JSON for tests or future UI code, and writes a
small local text summary to the prototype output channel. It does not
read raw handoff JSON in the UI layer.

The local workflow context bundle can include the same diagnostics handoff
summary as bounded context. It records the schema and handoff IDs,
diagnostic counts, descriptor references, transport kinds, and read-only
safety flags. Missing or invalid handoff data remains local unavailable
or invalid context and does not trigger execution.

Validation command proposals may reuse only that normalized context
bundle section as proposal preflight data. The proposal output can show
that the handoff summary is available, unavailable, or invalid, and it
keeps issue/preflight notes bounded for local UI or context display. The
proposal layer does not parse raw handoff JSON and does not add launcher,
pccx-lab, validator, shell, provider, runtime, MCP, LSP, marketplace,
telemetry, upload, or write-back flows.

Validation proposal preflight audit is the next bounded data-only handoff
before the approved runner path. It re-checks the proposal ID, fixed
command template, existing approved-runner allowlist membership, blocked
launcher/pccx-lab/shell paths, pccx-lab diagnostics handoff validator
wording, unsupported execution wording, and diagnostics handoff
context-only handling. The audit returns bounded JSON/text status and
does not execute commands or expand the runner allowlist.

This path is data-only. It does not execute `pccx-llm-launcher`, does not
execute `pccx-lab`, does not invoke the pccx-lab validator command, does
not spawn shell commands, does not implement MCP or LSP, does not call
providers, and does not touch hardware.

The pccx-lab validator remains a separate CLI/core boundary. The IDE
consumer is for future presentation and context use, not for bypassing
launcher or lab ownership.

---

## xsim diagnostics status surface (read-only)

The VS Code prototype includes a small status surface for existing
`problems from-xsim-log` JSON. The checked local example lives at
`docs/examples/editor-bridge/problems-xsim-mixed.example.json`.
This read-only context work tracks `pccxai/systemverilog-ide#3`.

The surface consumes adapter output as data and returns bounded summary
fields: source kind, tool, total problem count, counts by severity,
located and unlocated problem counts, coded problem count, relative file
counts, limitations, and safety flags.

The local workflow context bundle can include the same summary as
`xsimDiagnostics`. That context section is summary-only and does not
include raw xsim log lines or full logs.

This path does not run xsim or Vivado, execute `pccx-lab`, execute
`pccx-llm-launcher`, spawn shell commands, read raw log files in the UI
layer, echo raw log lines into context bundles, access hardware or KV260
runtime paths, load model weights, call providers, implement MCP or LSP,
package for marketplace distribution, upload telemetry, or write back
state.

The pccx-lab CLI/core boundary remains the owner for reusable
verification and diagnostics behavior. This IDE status surface is only a
small presentation/context summary over already-produced local JSON.
The schema draft, read-only xsim path, and text surface sketches are
recorded in
[`DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md`](./DIAGNOSTICS_XSIM_INTEGRATION_PLAN.md).

---

## launcher runtime readiness consumer (read-only)

The VS Code prototype includes a small adapter for
`pccx.runtimeReadiness.v0` launcher runtime readiness JSON. The checked
local example lives at
`docs/examples/runtime-readiness/launcher-runtime-readiness.gemma3n-e4b-kv260.example.json`.
This read-only context work is tracked by `pccxai/systemverilog-ide#58`
and follows the launcher readiness contract/status work in
`pccxai/pccx-llm-launcher#21` and `pccxai/pccx-llm-launcher#22`.

The current consumed launcher answer is
`blocked_not_yet_evidence_backed` for Gemma 3N E4B plus KV260. The
consumer returns deterministic bounded summary data: readiness and
evidence state, target model and device, timing state, bitstream state,
implementation state, KV260 smoke state, runtime evidence state,
throughput state, blocker count/list, and read-only safety flags.

The status surface and context bundle treat this summary as data only.
Missing or invalid readiness data is reported as unavailable or invalid
context. The context does not parse raw launcher JSON in UI/proposal
layers and does not execute a backend command.

Current evidence represented by the launcher data:

- xsim evidence is present.
- Vivado synthesis evidence is present.
- Timing remains blocked.
- Implementation remains blocked.
- Bitstream generation is not proven.
- KV260 board smoke and runtime evidence are absent.
- Throughput measurement is absent; the throughput value remains a target
  only.

This path does not execute `pccx-llm-launcher`, execute `pccx-lab`, invoke
the pccx-lab validator, access the FPGA repository, execute KV260 runtime
code, load model weights, call providers, implement MCP or LSP, package
for marketplace distribution, upload telemetry, or write back state. It
does not claim KV260 inference works, does not claim Gemma 3N E4B runs on
KV260, and does not claim measured throughput.

---

## launcher device/session status consumer (read-only)

The VS Code prototype includes a small adapter for
`pccx.deviceSessionStatus.v0` launcher device/session status JSON. The
checked local example lives at
`docs/examples/device-session-status/launcher-device-session-status.gemma3n-e4b-kv260.example.json`.
This read-only context work is tracked by `pccxai/systemverilog-ide#61`
and follows the launcher status panel work in
`pccxai/pccx-llm-launcher#2` and `pccxai/pccx-llm-launcher#10`, plus the
pccx-lab validation boundary in `pccxai/pccx-lab#50`.

The current consumed launcher answer is
`device_session_status_placeholder_blocked`. The consumer returns bounded
summary data for target device/model, connection state, discovery state,
authentication state, runtime state, model load state, session state, log
stream state, diagnostics state, readiness state, status-panel rows,
discovery path count, flow step count, error count, pccx-lab diagnostics
placeholder state, and read-only safety flags.

The status surface and context bundle treat this summary as data only.
Missing or invalid device/session data is reported as unavailable or
invalid context. The context does not parse raw launcher JSON in UI layers
and does not execute a backend command.

This path does not execute `pccx-llm-launcher`, execute `pccx-lab`, invoke
the pccx-lab validator, open serial ports, write serial data, scan
networks, execute SSH, attempt authentication, access hardware, execute
KV260 runtime code, load model weights, call providers, implement MCP or
LSP, package for marketplace distribution, upload telemetry, or write back
state. It does not claim KV260 inference works, does not claim Gemma 3N E4B
runs on KV260, and does not claim measured throughput.

---

## module index scaffold (active, pre-stable)

`pccx-ide index` scans `.sv` and `.v` files for simple `module`,
`package`, and `interface` declarations and emits a lightweight index.
This is an early scaffold intended to support future navigation and
editor-bridge work — it is not a full SystemVerilog parser.

### Usage

```bash
# JSON output (default)
python -m pccx_ide_cli index fixtures/modules/simple_module.sv

# Human-readable text output
python -m pccx_ide_cli index fixtures/modules/ --format text
```

### Output shape (JSON)

```json
{
  "kind": "module-index",
  "tool": "pccx-ide-scaffold",
  "source": "<path passed on CLI>",
  "declarations": [
    { "kind": "module", "name": "simple_mod", "file": "<abs-path>", "line": 1, "column": 1 }
  ],
  "modules": [
    { "name": "simple_mod", "file": "<abs-path>", "line": 1, "column": 1 }
  ]
}
```

### Parser limitations

- Single-line `//` comments are skipped.
- Non-nested block comments (`/* ... */`) are stripped by the scanner;
  nested block comments are not supported.
- `package` and `interface` support is scanner-based: simple declaration
  lines only, no imports, modports, macro expansion, or semantic resolution.
- `class`, `program`, and `checker` declarations are ignored.
- No semantic analysis.  Column is the 1-indexed position of the
  `module`, `package`, or `interface` keyword.

### Scope

- pccx-lab backend is diagnostics-only for now.  `index` always uses the
  built-in scaffold scanner.
- `modules[]` remains for compatibility; `declarations[]` carries the
  declaration kind.
- `locate` defaults to module-only compatibility and can opt into
  `--kind package`, `--kind interface`, or `--kind any`.
- No stable ABI or API contract — the output shape may change before v1.

---

## declaration locate scaffold (active, pre-stable)

`pccx-ide locate` scans `.sv` and `.v` files for a single declaration by
exact name.  The default remains module-only for compatibility; callers can
opt into `--kind module|package|interface|any`.  This is an early navigation
scaffold — not semantic navigation, not an LSP implementation, and not a
stable API.  A future editor bridge can consume this output, but the shape may
change before v1.

### Usage

```bash
# Locate a module — JSON output (default)
python -m pccx_ide_cli locate fixtures/modules/ simple_mod

# Locate a package or interface
python -m pccx_ide_cli locate fixtures/modules/ pkg_defs --kind package
python -m pccx_ide_cli locate fixtures/modules/ bus_if --kind interface

# Locate — human-readable text output
python -m pccx_ide_cli locate fixtures/modules/ simple_mod --format text
```

### Output shape (JSON)

```json
{
  "kind": "locate",
  "tool": "pccx-ide-cli",
  "source": "line-scanner",
  "query": "simple_mod",
  "declaration_kind": "module",
  "matches": [
    { "kind": "module", "name": "simple_mod", "module": "simple_mod", "file": "<path>", "line": 1, "column": 1 }
  ]
}
```

### Exit codes

| exit | meaning |
|------|---------|
| 0    | exactly one match |
| 1    | no match found |
| 2    | multiple matches (ambiguous) |

### Constraints

- Exact case-sensitive name match only.
- Uses the same line scanner as `index` — same parser limitations apply
  (scanner-based block comment handling, no semantic analysis).
- `column` is the same 1-indexed keyword column emitted by `index`.
- Output shape is pre-stable; not a committed API contract.

---

## declaration export scaffold (active, pre-stable)

`pccx-ide declarations` exposes the scanner declaration records directly for
editor bridge consumers.  It is a thin wrapper over the `index`
`declarations[]` data and keeps legacy module-only `modules[]` out of the
result.

```bash
python -m pccx_ide_cli declarations fixtures/modules/ --format json
python -m pccx_ide_cli declarations fixtures/modules/ --format text
```

JSON output uses:

```json
{
  "kind": "declarations",
  "tool": "pccx-ide-cli",
  "source": "<path passed on CLI>",
  "declarations": [
    { "kind": "package", "name": "pkg_defs", "file": "<path>", "line": 1, "column": 1 }
  ]
}
```

The output is pre-stable, scanner-based, and not semantic resolution.

---

## module organization scaffold (active, pre-stable)

`pccx-ide organization` exposes scanner-based module boundary spans and a
small hierarchy seed for editor/project organization workflows.
`hierarchy`, `dependencies`, `module-summary`, `port-usage`, and
`refactor-impact` expose focused read-only views for trees, dependency
impact, conservative header/port summaries, target port usage summaries,
and target-specific refactor review data. They build on the same local
scanner used by `index`,
`declarations`, and `locate`.

```bash
python -m pccx_ide_cli organization fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli organization fixtures/organization/hierarchy_top.sv --format text
python -m pccx_ide_cli module-summary fixtures/organization/hierarchy_top.sv --format json
python -m pccx_ide_cli port-usage fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
python -m pccx_ide_cli refactor-impact fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
python -m pccx_ide_cli refactor-plan fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
```

JSON output uses:

```json
{
  "kind": "module-organization",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "modules": [
    {
      "name": "top_mod",
      "file": "<path>",
      "start_line": 9,
      "start_column": 1,
      "end_line": 15,
      "end_column": 1,
      "span_lines": 7,
      "complete": true
    }
  ],
  "hierarchy": {
    "edges": [],
    "roots": [],
    "unresolved": []
  }
}
```

The refactoring section is proposal-only and reports `writes_files: false`.
`module-summary` reports scanner-detected module headers and simple
ANSI-style port metadata as display data only.
`port-usage` reports a target module's conservative port declarations,
direct dependents, and scanner-detected usage-site connection summaries
as display data only.
`refactor-impact` reports a target module declaration, dependent
instantiation references, and direct dependency references as display
data only.
`refactor-plan` emits a separate proposal-only envelope for rename-module,
extract-port, and move-module requests. These commands do not apply
refactors, move files, execute validation, invoke `pccx-lab`, invoke the
launcher, run xsim or Vivado, access hardware, upload telemetry, or write back
state. The full scope and limitations are tracked in
[`MODULE_ORGANIZATION_WORKFLOW.md`](./MODULE_ORGANIZATION_WORKFLOW.md).

---

## xsim log handoff scaffold (active, pre-stable)

`pccx-ide xsim-log` parses an existing xsim-style log file and emits a
small diagnostics-like document for future editor integration.

### Usage

```bash
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format json
python -m pccx_ide_cli xsim-log fixtures/xsim/mixed.log --format text
```

### Output shape (JSON)

```json
{
  "tool": "pccx-ide-cli",
  "kind": "xsim-log",
  "source": "<path passed on CLI>",
  "diagnostics": [
    {
      "severity": "error",
      "code": "VRFC 10-1234",
      "message": "syntax error near token ';'",
      "raw_line": "ERROR: [VRFC 10-1234] syntax error near token ';'"
    }
  ]
}
```

### Scope

- Parses existing log files only; it does not run xsim or Vivado.
- Uses synthetic fixtures in this repository; no hardware logs are
  required.
- Supports only simple severity-prefixed lines, file:line diagnostics,
  file:line:column diagnostics, and simple bracket codes.
- Unknown lines are ignored.
- This does not prove hardware correctness and is not a full
  Vivado/xsim parser.
- Output is pre-stable.  Future `pccx-lab` integration may provide
  richer log and report handoff.

---

## editor problem export scaffold (active, pre-stable)

`pccx-ide problems` exports editor-friendly problem records from
existing local diagnostics and xsim-log parsing.  It is a bridge surface
for future editor integration, not an editor integration by itself.
The external editor bridge contract is tracked in
[`EDITOR_BRIDGE_CONTRACT.md`](./EDITOR_BRIDGE_CONTRACT.md).

### Usage

```bash
python -m pccx_ide_cli problems from-check fixtures/missing_endmodule.sv --format json
python -m pccx_ide_cli problems from-xsim-log fixtures/xsim/mixed.log --format text
```

### Output shape (JSON)

```json
{
  "tool": "pccx-ide-cli",
  "kind": "editor-problems",
  "source_kind": "check",
  "source": "<path passed on CLI>",
  "problems": [
    {
      "source_kind": "check",
      "severity": "error",
      "code": "PCCX-SCAFFOLD-003",
      "message": "`module` declared but no matching `endmodule` found",
      "file": "<source file>",
      "line": 1,
      "column": 1
    }
  ]
}
```

### Scope

- `from-check` uses the built-in scaffold diagnostics path only.
- `from-xsim-log` uses the local xsim-log parser.
- Valid inputs exit 0 even when problems are exported; path and format
  errors fail clearly.
- Does not implement LSP, a VS Code extension, a JetBrains plugin, or a
  GUI.
- Does not run xsim or Vivado.
- Output is pre-stable.  Future editor bridges may consume this shape.

---

## Open questions

- Whether the envelope grows a `metadata` object at v1, and what
  fields belong inside (e.g. `commit`, `pccx-lab-version`).
- Whether multi-file batches are represented as one envelope per file
  or one envelope with a list of `source` entries.
- How verification status (xsim pass/fail counts) is layered on top of
  the diagnostics envelope.
- Whether the `additionalProperties: false` constraint on diagnostics
  should relax at v1 to allow forward-compatible extension fields.
- How a future local workflow mode should pass token-saving
  context bundles to pccx-llm-launcher or an MCP-style controlled tool
  boundary.  The current VS Code prototype only has boundary types,
  status/context commands, and tests: no provider/runtime calls, no local chat
  backend runtime calls, no MCP server implementation, and no direct
  execution of command or validation proposals.  Validation proposal
  preflight audit remains a bounded review step before any approved
  runner invocation.

These are intentionally unresolved while both sides mature.

---

*See also*:
[engineering discipline](https://github.com/pccxai/pccxai/blob/main/docs/ENGINEERING_DISCIPLINE.md) —
org-level rules covering interface-first work and gray-box delegation that govern
how workflow-boundary work interacts with the pccx-lab boundary from this IDE layer.

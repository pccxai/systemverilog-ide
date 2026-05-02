# Handoff notes

This document describes the controlled integration boundary between
`pccx-ide` (this CLI) and `pccx-lab`.

Two handoff paths are tracked:

1. The `pccx-lab` CLI / core boundary (analysis backend) — **wired**.
2. The xsim runner / log surfacing path inside `pccx-lab` — **planned**.

---

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
- How a future local coding-assistant mode should pass token-saving
  context bundles to pccx-llm-launcher or an MCP-style controlled tool
  boundary.  The current VS Code prototype only has boundary types,
  status/context commands, and tests: no AI provider calls, no local chat
  backend runtime calls, no MCP server implementation, and no direct
  execution of command or validation proposals.

These are intentionally unresolved while both sides mature.

---

*See also*:
[AI-assisted engineering discipline](https://github.com/pccxai/pccxai/blob/main/docs/AI_ASSISTED_ENGINEERING.md) —
org-level rules covering interface-first work and gray-box delegation that govern
how AI-assisted work interacts with the pccx-lab boundary from this IDE layer.

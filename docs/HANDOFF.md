# Handoff notes

This document describes the controlled integration boundary between
`pccx-ide` (this CLI) and `pccx-lab`.

Two handoff paths are tracked:

1. The `pccx-lab` CLI / core boundary (analysis backend) — **wired**.
2. The xsim runner / log surfacing path inside `pccx-lab` — **planned**.

---

## pccx-lab diagnostics handoff (active)

`pccx-lab` now exposes `analyze <path> [--format json]` which emits an
early diagnostics envelope.  The `pccx-ide check --backend pccx-lab`
flag wires this path.

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

`pccx-ide index` scans `.sv` and `.v` files for `module` declarations and
emits a lightweight index.  This is an early scaffold intended to support
future navigation and editor-bridge work — it is not a full SystemVerilog
parser.

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
  "modules": [
    { "name": "simple_mod", "file": "<abs-path>", "line": 1, "column": 1 }
  ]
}
```

### Parser limitations

- Single-line `//` comments are skipped.
- Block comments (`/* ... */`) are **not** parsed — a `module` keyword
  inside a block comment will be reported as a false positive.
- `package`, `interface`, and `class` declarations are ignored.
- No semantic analysis.  Column is the 1-indexed position of the `module`
  keyword.

### Scope

- pccx-lab backend is diagnostics-only for now.  `index` always uses the
  built-in scaffold scanner.
- No stable ABI or API contract — the output shape may change before v1.

---

## module locate scaffold (active, pre-stable)

`pccx-ide locate` scans `.sv` and `.v` files for a single module declaration
by exact name.  This is an early navigation scaffold — not semantic navigation,
not an LSP implementation, and not a stable API.  A future editor bridge can
consume this output, but the shape may change before v1.

### Usage

```bash
# Locate a module — JSON output (default)
python -m pccx_ide_cli locate fixtures/modules/ simple_mod

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
  "matches": [
    { "module": "simple_mod", "file": "<path>", "line": 1, "column": 0 }
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
  (no block comment handling, no semantic analysis).
- `column` is always 0 in locate output (column position not resolved at
  this stage).
- Output shape is pre-stable; not a committed API contract.

---

## xsim handoff (planned)

xsim runs and log surfacing remain on the `pccx-lab` side.  This CLI is
expected to:

1. Pass through a `run` request to `pccx-lab`.
2. Translate the resulting log / report into the same diagnostics
   envelope where it makes sense, or surface a structured run-summary
   document (envelope version to be defined alongside the lab CLI).

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

These are intentionally unresolved while both sides mature.

---

*See also*:
[AI-assisted engineering discipline](https://github.com/pccxai/pccxai/blob/main/docs/AI_ASSISTED_ENGINEERING.md) —
org-level rules covering interface-first work and gray-box delegation that govern
how AI workers interact with the pccx-lab boundary from this IDE layer.

# Module Organization Workflow

## Status

This is a pre-stable, scanner-based workflow for organizing modular RTL
projects. It adds a read-only `organization` CLI surface that reports
module boundary spans and a small hierarchy seed for editor navigation and
reviewed refactoring planning.

It is not a full SystemVerilog parser, not semantic elaboration, not an LSP
implementation, and not a write-capable refactoring engine.

## CLI Surface

```bash
python -m pccx_ide_cli organization <path> --format json
python -m pccx_ide_cli organization <path> --format text
```

`<path>` may be a `.sv` / `.v` file or a directory. Directory scans follow the
same recursive scanner rules as `index` and `declarations`.

The JSON envelope uses:

```json
{
  "kind": "module-organization",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "modules": [],
  "hierarchy": {
    "edges": [],
    "roots": [],
    "unresolved": []
  },
  "refactoring": {
    "mode": "proposal-only",
    "writes_files": false
  },
  "limitations": []
}
```

The shape is pre-stable and may change while the editor bridge matures.

## Module Boundary Detection

Each `modules[]` record describes one scanner-detected `module` declaration:

```json
{
  "name": "top_mod",
  "file": "fixtures/organization/hierarchy_top.sv",
  "start_line": 9,
  "start_column": 1,
  "end_line": 15,
  "end_column": 1,
  "span_lines": 7,
  "complete": true
}
```

The scanner matches simple declaration lines and the next visible
`endmodule` line. If no end marker is found, `complete` is `false` and the end
fields are `null`.

## Hierarchy Seed

`hierarchy.edges[]` records single-line instantiation candidates inside
complete module spans:

```json
{
  "parent": "top_mod",
  "child": "leaf_mod",
  "instance": "u_leaf",
  "file": "fixtures/organization/hierarchy_top.sv",
  "line": 12,
  "column": 5,
  "resolved": true
}
```

`resolved` means the child type matches a module declaration found in the same
scan. `roots[]` lists known modules that are not resolved children, and
`unresolved[]` lists candidate child types without a local declaration.

This is a visualization seed for editor trees and review workflows. It does
not run elaboration, expand macros, interpret generate blocks, or replace
vendor tooling.

## Refactoring Boundary

Refactoring remains proposal-only. The current workflow provides candidate
inputs for later helpers:

- module boundary spans
- scanner-based hierarchy edges
- planned helper names for rename, extract-port, and move-module workflows

The CLI does not write files, apply patches, rename symbols, move modules,
edit ports, run validation, execute shell commands, invoke `pccx-lab`, invoke
the launcher, access hardware, upload telemetry, or perform automatic
repository actions.

Future write-capable helpers must be reviewed as a separate boundary and
should route through explicit proposal and approval steps before any file
mutation.

## Limitations

- Scanner-based module declarations and `endmodule` matching only.
- Single-line instantiation candidates only.
- No preprocessor, macro, generate-block, package import, modport, class,
  interface semantic, or elaboration support.
- Duplicate module names are not semantically resolved.
- JSON output is pre-stable.

## Issue Alignment

This workflow advances
[`systemverilog-ide#8`](https://github.com/pccxai/systemverilog-ide/issues/8)
with read-only module boundary detection, a hierarchy visualization seed, and
a proposal-only refactoring boundary.

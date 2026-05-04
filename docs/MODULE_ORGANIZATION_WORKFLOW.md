# Module Organization Workflow

## Status

This is a pre-stable, scanner-based workflow for organizing modular RTL
projects. It adds read-only `organization`, `hierarchy`, `dependencies`,
and `module-summary` CLI surfaces that report module boundary spans,
scanner-based hierarchy data, direct dependency impact data, and
conservative module header/port summaries for editor navigation and
reviewed refactoring planning.

It is not a full SystemVerilog parser, not semantic elaboration, not an LSP
implementation, and not a write-capable refactoring engine.

## CLI Surface

```bash
python -m pccx_ide_cli organization <path> --format json
python -m pccx_ide_cli organization <path> --format text
python -m pccx_ide_cli hierarchy <path> --format json
python -m pccx_ide_cli hierarchy <path> --format text
python -m pccx_ide_cli dependencies <path> --format json
python -m pccx_ide_cli dependencies <path> --format text
python -m pccx_ide_cli module-summary <path> --format json
python -m pccx_ide_cli module-summary <path> --format text
python -m pccx_ide_cli refactor-plan <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-plan <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-plan <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
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

The focused hierarchy view uses the same scanner data but emits a
tree-oriented shape for editor consumers:

```json
{
  "kind": "module-hierarchy-view",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "view_state": "available_as_data",
  "module_count": 2,
  "edge_count": 1,
  "roots": [],
  "tree": [],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The hierarchy view is display data only. It does not write files, apply
refactors, run validation, execute shell commands, invoke `pccx-lab`,
invoke the launcher, call providers, touch hardware, upload telemetry, or
perform automatic repository actions.

The dependency view uses the same scanner data and emits direct dependency
and dependent summaries for refactor-impact review:

```json
{
  "kind": "module-dependency-view",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "dependency_state": "available_as_data",
  "module_count": 2,
  "edge_count": 1,
  "resolved_edge_count": 1,
  "unresolved_edge_count": 0,
  "impact": [],
  "reverse_edges": [],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The dependency view is display data only. It does not write files, apply
refactors, generate patches, run validation, execute shell commands,
invoke `pccx-lab`, invoke the launcher, call providers, touch hardware,
upload telemetry, or perform automatic repository actions.

The module summary view reports conservative scanner-detected module
header and port metadata:

```json
{
  "kind": "module-summary-view",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "summary_state": "available_as_data",
  "module_count": 2,
  "port_count": 2,
  "modules": [
    {
      "name": "top_mod",
      "header": {
        "complete": true,
        "start_line": 9,
        "end_line": 11,
        "line_count": 3
      },
      "ports": [
        {
          "name": "clk",
          "direction": "input",
          "width": null,
          "line": 10,
          "state": "detected"
        }
      ],
      "readiness": {
        "state": "ready-for-review",
        "reasons": []
      }
    }
  ],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The module summary view is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell
commands, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

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

This is a visualization seed for editor trees and review workflows. The
`hierarchy` command renders it as JSON or text tree data, and the
`dependencies` command renders direct dependency and dependent data. The
`module-summary` command renders conservative module header and port data.
These commands do not run elaboration, expand macros, interpret generate
blocks, or replace vendor tooling.

## Module Header And Port Summary

`module-summary` scans each module declaration header up to the first
semicolon inside the module boundary and reports conservative port records.
It detects simple ANSI-style `input`, `output`, and `inout` declarations,
including inherited direction for follow-on comma-separated names when the
scanner can preserve that context.

This is intended as review input for editor sidebars and later
proposal-only refactoring helpers. It is not a full SystemVerilog parser:
non-ANSI body declarations, parameter elaboration, macros, interfaces,
modports, packages, and semantic type resolution are outside this
boundary.

## Refactoring Boundary

Refactoring remains proposal-only. The current workflow provides candidate
inputs for later helpers:

- module boundary spans
- scanner-based hierarchy edges
- direct dependency and dependent summaries
- conservative module header and port summaries
- planned helper names for rename, extract-port, and move-module workflows

The CLI does not write files, apply patches, rename symbols, move modules,
edit ports, run validation, execute shell commands, invoke `pccx-lab`, invoke
the launcher, access hardware, upload telemetry, or perform automatic
repository actions.

Future write-capable helpers must be reviewed as a separate boundary and
should route through explicit proposal and approval steps before any file
mutation.

## Refactoring Proposal Plan

`refactor-plan` is the next reviewed boundary for module organization. It
does not apply a refactor. It emits a proposal envelope that a UI or
maintainer workflow can review before any write-capable helper exists.

Supported proposal actions:

- `rename-module`
- `extract-port`
- `move-module`

Each envelope includes the requested action, scanner-detected module span,
preflight status, blocked reasons when inputs are missing or unsafe, planned
review steps, and safety flags. Example shape:

```json
{
  "kind": "module-refactor-proposal",
  "proposal_state": "proposal-only",
  "action": "rename-module",
  "writes_files": false,
  "preflight": {
    "status": "ready-for-review",
    "requires_approval_before_write": true,
    "reasons": []
  },
  "safety": {
    "applies_patch": false,
    "writes_files": false,
    "runs_validation": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

Blocked proposals still return JSON so editor consumers can display why a
request is not ready for review. For example, a missing module, missing
required input, absolute destination path, or invalid identifier produces
`preflight.status: "blocked"` with reasons.

This boundary is intentionally limited to proposal metadata. It does not
rewrite symbols, edit ports, move files, generate patches, run validation,
execute shell commands, invoke `pccx-lab`, invoke the launcher, call
providers, touch hardware, upload telemetry, or perform automatic repository
actions.

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
with read-only module boundary detection, a focused hierarchy view, a
direct dependency view, conservative module header/port summaries, and a
proposal-only refactoring boundary.

# Module Organization Workflow

## Status

This is a pre-stable, scanner-based workflow for organizing modular RTL
projects. It adds read-only `organization`, `hierarchy`, `dependencies`,
`module-summary`, `port-usage`, `module-context`, `refactor-impact`,
`validation-plan`, `refactor-review`, `refactor-approval`, and
`refactor-application` CLI surfaces
that report module boundary spans, scanner-based hierarchy data, direct
dependency impact data, conservative module header/port summaries, target port
usage summaries, target module context bundles, target-specific refactor impact
data, proposal-only validation command descriptors, a summary-only review
packet, approval decision metadata, and application request metadata for editor
navigation and reviewed refactoring planning.

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
python -m pccx_ide_cli port-usage <path> --module <name> --format json
python -m pccx_ide_cli port-usage <path> --module <name> --format text
python -m pccx_ide_cli module-context <path> --module <name> --format json
python -m pccx_ide_cli module-context <path> --module <name> --format text
python -m pccx_ide_cli refactor-impact <path> --module <name> --format json
python -m pccx_ide_cli refactor-impact <path> --module <name> --format text
python -m pccx_ide_cli refactor-plan <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-plan <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-plan <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli validation-plan <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli validation-plan <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli validation-plan <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli refactor-review <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-review <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-review <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli refactor-approval <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-approval <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-approval <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli refactor-application <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-application <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-application <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
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

The port usage view reports a target module's conservative port
declarations and scanner-detected dependent instantiation usage sites:

```json
{
  "kind": "module-port-usage-view",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "target": "leaf_mod",
  "usage_state": "available_as_data",
  "writes_files": false,
  "preflight": {
    "status": "ready-for-review",
    "requires_approval_before_write": true,
    "reasons": []
  },
  "ports": [
    {
      "name": "clk",
      "direction": "input",
      "width": null,
      "line": 5,
      "state": "detected"
    }
  ],
  "usage_sites": [
    {
      "parent": "top_mod",
      "child": "leaf_mod",
      "instance": "u_leaf",
      "connection_style": "named",
      "connection_names": ["clk"],
      "semantically_resolved": false
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

The port usage view is display data only. It uses the existing
instantiation scanner and bounded connection text from the candidate
instantiation statement; it does not semantically resolve named or
ordered port connections. It does not write files, apply refactors,
generate patches, run validation, execute shell commands, invoke
`pccx-lab`, invoke the launcher, call providers, touch hardware, upload
telemetry, or perform automatic repository actions.

The module context bundle combines the existing target-specific view
outputs into a bounded editor context packet:

```json
{
  "kind": "module-context-bundle",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "target": "leaf_mod",
  "context_state": "available_as_data",
  "writes_files": false,
  "preflight": {
    "status": "ready-for-review",
    "requires_approval_before_write": true,
    "reasons": []
  },
  "summary_context": {},
  "dependency_context": {},
  "port_context": {},
  "refactor_context": {
    "review_target_count": 2,
    "writes_files": false
  },
  "source_views": [],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The module context bundle is display/context data only. It summarizes
the existing `module-summary`, `dependencies`, `port-usage`, and
`refactor-impact` surfaces for a named module. It does not write files,
apply refactors, move files, generate patches, run validation, execute
shell commands, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository
actions.

The refactor impact view reports target-specific review data for a module:

```json
{
  "kind": "module-refactor-impact-view",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "target": "leaf_mod",
  "impact_state": "available_as_data",
  "writes_files": false,
  "preflight": {
    "status": "ready-for-review",
    "requires_approval_before_write": true,
    "reasons": []
  },
  "direct_dependencies": [],
  "direct_dependents": ["top_mod"],
  "dependent_edges": [],
  "dependency_edges": [],
  "review_targets": [],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The refactor impact view is review data only. It does not write files,
apply refactors, move files, generate patches, run validation, execute
shell commands, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

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
The `port-usage` command renders a target module's conservative port data
and dependent instantiation connection summaries.
The `module-context` command bundles target summary, dependency,
port-usage, and refactor-impact review data for editor context panes.
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

## Port Usage Review

`port-usage` accepts a target module name and reports the target's
scanner-detected ANSI-style port declarations, direct dependent modules,
and dependent instantiation usage sites. For each usage site it reports
the candidate instance location and a bounded connection summary such as
named connection names or ordered connection count.

This view is intended as review input for editor sidebars and future
proposal-only port refactoring helpers. Connection data is not
semantically resolved: macros, interfaces, generate blocks, parameter
elaboration, implicit connections, and type compatibility are outside
this boundary.

## Module Context Bundle

`module-context` accepts a target module name and returns one read-only
context packet assembled from the existing scanner-derived summary,
dependency, port-usage, and refactor-impact views. The bundle is meant
for editor context panes that need a compact target module snapshot
without making separate UI-layer assumptions about the individual view
shapes.

This command does not create a new analysis engine. It does not write
files, apply refactors, generate patches, run validation, execute shell
commands, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

## Refactor Impact Review

`refactor-impact` accepts a target module name and reports scanner-detected
review targets for rename, extract-port, and move-module planning. It
includes the target declaration when the target is unambiguous, direct
dependent instantiation references, direct dependency instantiation
references, unresolved dependency names, and preflight reasons when the
target is missing, ambiguous, or has an incomplete boundary.

This surface is intentionally target-specific review data. It does not
prepare a patch, rewrite symbols, edit ports, move files, or execute
validation. Write-capable helpers remain a separate future boundary.

## Refactoring Boundary

Refactoring remains proposal-only. The current workflow provides candidate
inputs for later helpers:

- module boundary spans
- scanner-based hierarchy edges
- direct dependency and dependent summaries
- conservative module header and port summaries
- target-specific port usage summaries
- target-specific module context bundles
- target-specific refactor impact review data
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

## Validation Proposal Plan

`validation-plan` adds a proposal-only validation planning envelope for a
reviewed refactor request. It reuses the same requested action fields as
`refactor-plan`, returns the refactor preflight status, and emits fixed
argument-array command descriptors that an editor or maintainer workflow can
review later.

Example shape:

```json
{
  "kind": "module-refactor-validation-plan",
  "validation_state": "proposal-only",
  "action": "rename-module",
  "command_descriptor_count": 8,
  "writes_files": false,
  "preflight": {
    "status": "ready-for-review",
    "requires_explicit_approval_before_run": true,
    "reasons": []
  },
  "validation_groups": [
    {
      "phase": "pre-change-review",
      "status": "proposal-only",
      "commands": [
        {
          "id": "module-context",
          "argv": ["python", "-m", "pccx_ide_cli", "module-context", "<path>", "--module", "<name>", "--format", "json"],
          "fixed_argv": true,
          "shell": false,
          "state": "proposed-not-run"
        }
      ]
    }
  ],
  "safety": {
    "read_only": true,
    "emits_command_descriptors": true,
    "writes_files": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

Blocked plans still return JSON. The pre-change review descriptors remain
available as data, while post-change validation descriptors are withheld until
the refactor preflight is ready for review.

The command descriptors are proposed-not-run data. This boundary does not
execute validation, execute shell commands, write files, apply refactors,
generate patches, invoke `pccx-lab`, invoke the launcher, run vendor tools,
call providers, touch hardware, upload telemetry, or perform automatic
repository actions.

## Refactor Review Packet

`refactor-review` adds a summary-only review packet over the existing
`module-context`, `refactor-plan`, and `validation-plan` boundaries. It is a
one-call packet for editor review panes and maintainer handoff notes before
any write-capable helper exists.

Example shape:

```json
{
  "kind": "module-refactor-review-packet",
  "packet_state": "proposal-only",
  "review_state": "ready-for-review",
  "action": "rename-module",
  "writes_files": false,
  "context_summary": {
    "context_state": "available_as_data",
    "summary_available": true,
    "review_target_count": 2,
    "usage_site_count": 1
  },
  "proposal_summary": {
    "planned_step_count": 4,
    "writes_files": false
  },
  "validation_summary": {
    "validation_state": "proposal-only",
    "command_descriptor_count": 8,
    "phases": []
  },
  "safety": {
    "read_only": true,
    "summarizes_command_descriptors": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The packet intentionally summarizes validation descriptors by phase and command
ID only. It does not include command argv; consumers that need the fixed-argv
descriptor list should call `validation-plan` directly.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
or perform automatic repository actions.

## Refactor Approval Decision

`refactor-approval` adds proposal-only approval decision metadata over the
existing `refactor-review` packet. It is a one-call gate for editor review
panes and maintainer handoff notes to show that no approval has been recorded,
or that the preflight is blocked, before any write-capable helper exists.

Example shape:

```json
{
  "kind": "module-refactor-approval-decision",
  "decision_state": "not-approved",
  "action": "rename-module",
  "writes_files": false,
  "approval_decision": {
    "approved": false,
    "approver": "not-recorded",
    "decision": "not-approved",
    "reason": "explicit approval not recorded",
    "requires_explicit_user_approval_before_run": true,
    "requires_explicit_user_approval_before_write": true
  },
  "packet_summary": {
    "kind": "module-refactor-review-packet",
    "review_state": "ready-for-review",
    "validation_state": "proposal-only",
    "command_descriptor_count": 8,
    "validation_phases": []
  },
  "safety": {
    "read_only": true,
    "decision_metadata_only": true,
    "approval_granted": false,
    "summarizes_command_descriptors": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The decision intentionally records `approved: false`. It summarizes validation
descriptor phases by command ID only and does not include command argv;
consumers that need the fixed-argv descriptor list should call
`validation-plan` directly.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
grant approval, or perform automatic repository actions.

## Refactor Application Request

`refactor-application` adds proposal-only application request metadata over the
existing `refactor-approval` decision. It is a one-call gate for editor review
panes and maintainer handoff notes to show that a reviewed refactor still has
not been accepted for write execution and has not been applied.

Example shape:

```json
{
  "kind": "module-refactor-application-request",
  "application_state": "not-accepted",
  "action": "rename-module",
  "writes_files": false,
  "application_request": {
    "accepted": false,
    "applied": false,
    "decision": "not-accepted",
    "reason": "approval not granted",
    "required_approval_decision": "not-approved",
    "result": "not_applied",
    "requires_explicit_user_approval_before_run": true,
    "requires_explicit_user_approval_before_write": true
  },
  "approval_summary": {
    "kind": "module-refactor-approval-decision",
    "approved": false,
    "decision_state": "not-approved",
    "review_state": "ready-for-review",
    "validation_state": "proposal-only",
    "command_descriptor_count": 8,
    "validation_phases": []
  },
  "safety": {
    "read_only": true,
    "application_metadata_only": true,
    "approval_granted": false,
    "request_accepted": false,
    "summarizes_command_descriptors": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The request intentionally records `accepted: false` and `applied: false`.
It summarizes the approval decision and validation descriptor phases by command
ID only and does not include command argv; consumers that need the fixed-argv
descriptor list should call `validation-plan` directly.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
accept an application request, apply a refactor, grant approval, or perform
automatic repository actions.

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
direct dependency view, conservative module header/port summaries,
target-specific port usage summaries, target-specific module context
bundles, target-specific refactor impact review data, and a
proposal-only refactoring, validation planning, review packet, approval
decision, and application request boundary.

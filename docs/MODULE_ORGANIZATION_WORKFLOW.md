# Module Organization Workflow

## Status

This is a pre-stable, scanner-based workflow for organizing modular RTL
projects. It adds read-only `organization`, `hierarchy`, `dependencies`,
`hierarchy-cycles`, `unresolved-instances`, `module-roots`, `module-leaves`,
`module-orphans`, `module-depths`, `module-paths`, `module-edges`,
`module-reachability`, `module-order`, `module-fanout`, `module-fanin`,
`module-health`,
`module-summary`,
`boundary-audit`, `module-duplicates`, `refactor-candidates`, `port-usage`,
`module-context`, `refactor-impact`,
`validation-plan`, `refactor-review`, `refactor-approval`,
`refactor-application`, `refactor-result`, `refactor-handoff`,
`refactor-checklist`, and
`refactor-session` CLI surfaces that report module boundary spans,
scanner-based hierarchy data, direct dependency impact data, hierarchy cycle
report metadata, unresolved instantiation report metadata, root-candidate
report metadata, leaf-candidate report metadata, orphan-candidate report
metadata, depth-level report metadata, hierarchy path report metadata,
`module-edge-report` metadata, `module-reachability-report` metadata,
`module-order-report` metadata,
`module-fanout-report` metadata,
`module-fanin-report` metadata,
module graph health summary metadata,
conservative module header/port summaries, duplicate-name report metadata,
target port usage summaries, target module context bundles, target-specific
refactor impact data, boundary audit data, refactor
candidate metadata for editor action menus, proposal-only validation command
descriptors, a summary-only review packet, approval decision metadata,
application request metadata, and application result metadata plus refactor
handoff metadata, refactor checklist metadata, and refactor session status
metadata for editor navigation and reviewed refactoring planning.

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
python -m pccx_ide_cli hierarchy-cycles <path> --format json
python -m pccx_ide_cli hierarchy-cycles <path> --format text
python -m pccx_ide_cli unresolved-instances <path> --format json
python -m pccx_ide_cli unresolved-instances <path> --format text
python -m pccx_ide_cli module-roots <path> --format json
python -m pccx_ide_cli module-roots <path> --format text
python -m pccx_ide_cli module-leaves <path> --format json
python -m pccx_ide_cli module-leaves <path> --format text
python -m pccx_ide_cli module-orphans <path> --format json
python -m pccx_ide_cli module-orphans <path> --format text
python -m pccx_ide_cli module-depths <path> --format json
python -m pccx_ide_cli module-depths <path> --format text
python -m pccx_ide_cli module-paths <path> --format json
python -m pccx_ide_cli module-paths <path> --format text
python -m pccx_ide_cli module-edges <path> --format json
python -m pccx_ide_cli module-edges <path> --format text
python -m pccx_ide_cli module-reachability <path> --format json
python -m pccx_ide_cli module-reachability <path> --format text
python -m pccx_ide_cli module-order <path> --format json
python -m pccx_ide_cli module-order <path> --format text
python -m pccx_ide_cli module-fanout <path> --format json
python -m pccx_ide_cli module-fanout <path> --format text
python -m pccx_ide_cli module-fanin <path> --format json
python -m pccx_ide_cli module-fanin <path> --format text
python -m pccx_ide_cli module-health <path> --format json
python -m pccx_ide_cli module-health <path> --format text
python -m pccx_ide_cli module-summary <path> --format json
python -m pccx_ide_cli module-summary <path> --format text
python -m pccx_ide_cli boundary-audit <path> --format json
python -m pccx_ide_cli boundary-audit <path> --format text
python -m pccx_ide_cli module-duplicates <path> --format json
python -m pccx_ide_cli module-duplicates <path> --format text
python -m pccx_ide_cli refactor-candidates <path> --format json
python -m pccx_ide_cli refactor-candidates <path> --format text
python -m pccx_ide_cli refactor-readiness <path> --format json
python -m pccx_ide_cli refactor-readiness <path> --format text
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
python -m pccx_ide_cli refactor-result <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-result <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-result <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli refactor-handoff <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-handoff <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-handoff <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli refactor-checklist <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-checklist <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-checklist <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
python -m pccx_ide_cli refactor-session <path> --action rename-module --module <name> --new-name <name> --format json
python -m pccx_ide_cli refactor-session <path> --action extract-port --module <name> --port-name <name> --direction input --format text
python -m pccx_ide_cli refactor-session <path> --action move-module --module <name> --destination rtl/<name>.sv --format json
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

The hierarchy cycle report uses resolved scanner dependency edges and emits
cycle-warning metadata for editor consumers:

```json
{
  "kind": "module-hierarchy-cycle-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "cycle_state": "cycles-detected",
  "has_cycles": true,
  "cycle_count": 1,
  "cycles": [
    {
      "cycle_id": "cycle-1",
      "module_path": ["alpha_mod", "beta_mod", "alpha_mod"],
      "summary": "alpha_mod -> beta_mod -> alpha_mod",
      "edges": []
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

The hierarchy cycle report is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

The unresolved instantiation report uses scanner dependency edges that did
not resolve to a module declaration in the scanned input:

```json
{
  "kind": "module-unresolved-instance-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "unresolved-instances-detected",
  "has_unresolved_instances": true,
  "unresolved_instance_count": 1,
  "unresolved_modules": ["missing_child"],
  "unresolved_instances": [
    {
      "unresolved_id": "unresolved-1",
      "parent": "unresolved_top",
      "target_module": "missing_child",
      "instance": "u_missing",
      "resolution_state": "unresolved"
    }
  ],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The unresolved instantiation report is display data only. It does not write
files, apply refactors, generate patches, run validation, execute shell
commands, emit command argv, invoke `pccx-lab`, invoke the launcher, call
providers, touch hardware, upload telemetry, or perform automatic repository
actions.

The root-candidate report uses scanner hierarchy roots to identify modules
that are not instantiated by another resolved module in the scanned input:

```json
{
  "kind": "module-root-candidate-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "roots-detected",
  "root_count": 1,
  "root_names": ["top_mod"],
  "roots": [
    {
      "name": "top_mod",
      "root_state": "root-candidate",
      "direct_dependencies": ["leaf_mod"],
      "unresolved_dependencies": [],
      "reason": "not instantiated by another resolved module"
    }
  ],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The root-candidate report is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

The leaf-candidate report uses scanner hierarchy edges to identify modules
that do not instantiate another resolved module in the scanned input:

```json
{
  "kind": "module-leaf-candidate-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "leaves-detected",
  "leaf_count": 1,
  "leaf_names": ["leaf_mod"],
  "leaves": [
    {
      "name": "leaf_mod",
      "leaf_state": "leaf-candidate",
      "direct_dependents": ["top_mod"],
      "unresolved_dependencies": [],
      "reason": "does not instantiate another resolved module"
    }
  ],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The leaf-candidate report is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

The orphan-candidate report uses scanner hierarchy edges to identify modules
with no resolved dependencies and no resolved dependents in the scanned input:

```json
{
  "kind": "module-orphan-candidate-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "orphans-detected",
  "orphan_count": 1,
  "orphan_names": ["orphan_mod"],
  "orphans": [
    {
      "name": "orphan_mod",
      "orphan_state": "orphan-candidate",
      "direct_dependencies": [],
      "direct_dependents": [],
      "unresolved_dependencies": [],
      "reason": "no resolved dependencies or dependents detected by scanner"
    }
  ],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The orphan-candidate report is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

The depth report groups modules by resolved scanner hierarchy depth from
root candidates:

```json
{
  "kind": "module-depth-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "depths-detected",
  "depth_count": 2,
  "max_depth": 1,
  "levels": [
    {
      "depth": 0,
      "module_names": ["top_mod"]
    },
    {
      "depth": 1,
      "module_names": ["leaf_mod"]
    }
  ],
  "unplaced_module_names": [],
  "safety": {
    "read_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The depth report is display data only. It does not write files, apply
refactors, generate patches, run validation, execute shell commands, emit
command argv, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

The hierarchy path report enumerates scanner-detected root-to-leaf paths and
blocked unresolved path terminals:

```json
{
  "kind": "module-path-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "paths-detected",
  "path_count": 2,
  "complete_path_count": 2,
  "blocked_path_count": 0,
  "root_names": ["fanout_top"],
  "leaf_names": ["fanout_child_b", "fanout_leaf"],
  "paths": [
    {
      "path_id": "path-1",
      "module_path": ["fanout_top", "fanout_child_a", "fanout_leaf"],
      "instance_path": ["u_child_a", "u_leaf"],
      "path_state": "complete-root-to-leaf",
      "refactor_preflight_state": "ready-for-review"
    }
  ],
  "safety": {
    "read_only": true,
    "path_report_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The hierarchy path report is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

The module edge report lists scanner-detected direct instantiation edges and
marks unresolved targets as blocked:

```json
{
  "kind": "module-edge-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "edges-detected",
  "edge_count": 3,
  "resolved_edge_count": 3,
  "unresolved_edge_count": 0,
  "edges": [
    {
      "edge_id": "edge-1",
      "parent": "fanout_child_a",
      "child": "fanout_leaf",
      "instance": "u_leaf",
      "resolution_state": "resolved"
    }
  ],
  "safety": {
    "read_only": true,
    "edge_report_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The module edge report is display data only. It does not write files, apply
refactors, generate patches, run validation, execute shell commands, emit
command argv, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

The reachability report summarizes transitive dependencies and dependents from
resolved scanner edges:

```json
{
  "kind": "module-reachability-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "reachability-detected",
  "reachable_module_count": 4,
  "max_transitive_dependency_count": 3,
  "max_transitive_dependent_count": 2,
  "modules": [
    {
      "name": "fanout_top",
      "transitive_dependencies": [
        "fanout_child_a",
        "fanout_child_b",
        "fanout_leaf"
      ],
      "transitive_dependents": []
    }
  ],
  "safety": {
    "read_only": true,
    "reachability_report_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The reachability report is display data only. It does not write files, apply
refactors, generate patches, run validation, execute shell commands, emit
command argv, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

The module order report summarizes a dependency-first module review order from
resolved scanner edges:

```json
{
  "kind": "module-order-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "order-detected",
  "order_direction": "dependency-first",
  "ordered_module_names": [
    "fanout_child_b",
    "fanout_leaf",
    "fanout_child_a",
    "fanout_top"
  ],
  "max_dependency_level": 2,
  "modules": [
    {
      "name": "fanout_top",
      "order_index": 4,
      "dependency_level": 2,
      "direct_dependencies": ["fanout_child_a", "fanout_child_b"]
    }
  ],
  "safety": {
    "read_only": true,
    "order_report_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false,
    "runs_build": false,
    "runs_compile": false
  },
  "limitations": []
}
```

The module order report is display data only. It does not write files, apply
refactors, generate patches, run validation, run builds or compilers, execute
shell commands, emit command argv, invoke `pccx-lab`, invoke the launcher, call
providers, touch hardware, upload telemetry, or perform automatic repository
actions.

The fanin report ranks modules by scanner-detected resolved direct dependents:

```json
{
  "kind": "module-fanin-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "fanin-detected",
  "fanin_count": 3,
  "max_direct_dependent_count": 1,
  "fanin_names": ["fanout_child_a", "fanout_child_b", "fanout_leaf"],
  "modules": [
    {
      "name": "fanout_child_a",
      "rank": 1,
      "direct_dependents": ["fanout_top"],
      "direct_dependent_count": 1,
      "fanin_state": "has-resolved-fanin"
    }
  ],
  "safety": {
    "read_only": true,
    "fanin_report_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The fanin report is display data only. It does not write files, apply
refactors, generate patches, run validation, execute shell commands, emit
command argv, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

The module graph health summary combines scanner-detected root, leaf, depth,
cycle, unresolved-instantiation, and duplicate-name signals for editor status
panes:

```json
{
  "kind": "module-graph-health-summary",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "health_state": "ready-for-review",
  "ready_for_review": true,
  "root_names": ["top_mod"],
  "leaf_names": ["leaf_mod"],
  "max_depth": 1,
  "health_cards": [
    {
      "card_id": "root-candidates",
      "status": "roots-detected"
    },
    {
      "card_id": "hierarchy-cycles",
      "status": "no-cycles-detected"
    }
  ],
  "safety": {
    "read_only": true,
    "graph_health_summary_only": true,
    "writes_files": false,
    "emits_command_descriptors": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The module graph health summary is display data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

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

The boundary audit view reports scanner-detected module boundary
completeness and whether those boundaries are ready for reviewed
refactor planning:

```json
{
  "kind": "module-boundary-audit",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "audit_state": "available_as_data",
  "refactor_readiness": "ready-for-review",
  "module_count": 2,
  "complete_module_count": 2,
  "incomplete_module_count": 0,
  "modules": [],
  "blocked_reasons": [],
  "writes_files": false,
  "safety": {
    "read_only": true,
    "boundary_audit_only": true,
    "writes_files": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The boundary audit is status data only. It does not write files, apply
refactors, generate patches, run validation, execute shell commands,
invoke `pccx-lab`, invoke the launcher, run vendor tools, call providers,
touch hardware, upload telemetry, or perform automatic repository actions.

The duplicate module report surfaces scanner-detected ambiguous module
declaration names that would block unambiguous refactor planning:

```json
{
  "kind": "module-duplicate-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "duplicates-detected",
  "module_count": 3,
  "duplicate_name_count": 1,
  "duplicate_names": ["dup_mod"],
  "duplicates": [],
  "blocked_reasons": ["ambiguous module name: dup_mod"],
  "safety": {
    "read_only": true,
    "duplicate_report_only": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The duplicate-name report is status data only. It does not write files,
apply refactors, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, run vendor
tools, call providers, touch hardware, upload telemetry, or perform
automatic repository actions.

The module file report groups scanner-detected module declarations by
source file for file-layout and move-module review:

```json
{
  "kind": "module-file-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "multi-module-review",
  "file_count": 1,
  "module_count": 2,
  "single_module_file_count": 0,
  "multi_module_file_count": 1,
  "files": [
    {
      "file": "fixtures/organization/hierarchy_top.sv",
      "layout_state": "multi-module-file",
      "refactor_preflight_state": "ready-for-review",
      "module_names": ["leaf_mod", "top_mod"],
      "modules": []
    }
  ],
  "safety": {
    "read_only": true,
    "file_layout_report_only": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "moves_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The module file report is display data only. It does not move modules,
rewrite declarations, generate patches, run validation, execute shell
commands, emit command argv, invoke `pccx-lab`, invoke the launcher, run
vendor tools, call providers, touch hardware, upload telemetry, or perform
automatic repository actions.

The module span report ranks scanner-detected module declaration spans for
large-module review:

```json
{
  "kind": "module-span-report",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "report_state": "spans-detected",
  "module_count": 2,
  "complete_module_count": 2,
  "incomplete_module_count": 0,
  "min_span_lines": 4,
  "max_span_lines": 7,
  "modules": [
    {
      "rank": 1,
      "name": "top_mod",
      "file": "fixtures/organization/hierarchy_top.sv",
      "start_line": 9,
      "end_line": 15,
      "span_lines": 7,
      "span_state": "ready-for-review"
    }
  ],
  "safety": {
    "read_only": true,
    "span_report_only": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The module span report is display data only. It does not rewrite modules,
extract code, generate patches, run validation, execute shell commands,
emit command argv, invoke `pccx-lab`, invoke the launcher, run vendor tools,
call providers, touch hardware, upload telemetry, or perform automatic
repository actions.

The refactor candidate list reports scanner-detected modules and
proposal-only helper action metadata for editor menus:

```json
{
  "kind": "module-refactor-candidate-list",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "candidate_state": "available_as_data",
  "module_count": 2,
  "ready_module_count": 2,
  "blocked_module_count": 0,
  "actions": [
    {
      "action": "rename-module",
      "proposal_command": "refactor-plan",
      "required_inputs": ["new_name"],
      "proposal_only": true,
      "writes_files": false
    }
  ],
  "candidates": [],
  "safety": {
    "read_only": true,
    "candidate_metadata_only": true,
    "action_enablement_only": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The candidate list is action-enablement metadata only. It does not include
command argv, does not record requested refactor inputs, and does not create a
proposal. Consumers that need a reviewed proposal envelope should call
`refactor-plan` with explicit inputs.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
or perform automatic repository actions.

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

The port connection audit compares a target module's scanner-detected
ANSI-style port names with scanner-detected named instantiation
connections:

```json
{
  "kind": "module-port-connection-audit",
  "tool": "pccx-ide-cli",
  "scanner": "line-scanner",
  "source": "<path passed on CLI>",
  "target": "child_mod",
  "audit_state": "review-required",
  "ready_for_review": false,
  "writes_files": false,
  "declared_port_names": ["clk", "rst_n", "done_o"],
  "usage_site_count": 4,
  "ready_site_count": 1,
  "review_site_count": 3,
  "missing_named_port_count": 2,
  "unknown_named_port_count": 1,
  "usage_sites": [
    {
      "parent": "top_mod",
      "child": "child_mod",
      "instance": "u_missing",
      "connection_style": "named",
      "named_connections": ["clk", "extra_i"],
      "missing_named_ports": ["rst_n", "done_o"],
      "unknown_named_ports": ["extra_i"],
      "semantically_resolved": false
    }
  ],
  "safety": {
    "read_only": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "applies_refactor": false,
    "runs_validation": false
  },
  "limitations": []
}
```

The port connection audit is display data only. It does not semantically
resolve ordered, wildcard, macro, generate-block, or interface/modport
connections. Ordered and wildcard connection sites are marked for manual
review. It does not write files, apply refactors, generate patches, run
validation, execute shell commands, emit command argv, invoke `pccx-lab`,
invoke the launcher, call providers, touch hardware, upload telemetry, or
perform automatic repository actions.

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
The `refactor-candidates` command lists scanner-detected modules and
proposal-only helper action metadata for editor action menus.
The `refactor-readiness` command emits summary-only readiness metadata over
the boundary audit and candidate list so editor status panes can show whether
proposal-only refactor requests are ready to review.
These commands do not run elaboration, expand macros, interpret generate
blocks, or replace vendor tooling.

The readiness envelope uses:

```json
{
  "kind": "module-refactor-readiness-summary",
  "readiness_state": "ready-for-request",
  "ready_for_request": true,
  "writes_files": false,
  "safety": {
    "read_only": true,
    "readiness_summary_only": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "runs_validation": false
  }
}
```

It is not a proposal, approval, validation runner, or write path. It does not
capture requested inputs, select an action, emit command argv, run shell
commands, invoke `pccx-lab`, invoke the launcher, call providers, touch
hardware, upload telemetry, or perform automatic repository actions.

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
- refactor candidate action metadata for editor action menus
- planned helper names for rename, extract-port, and move-module workflows
- summary-only checklist metadata for maintainer review

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
required input, existing rename target, existing target port name, absolute
destination path, destination that matches the current module source file,
invalid extract-port width, invalid extract-port direction, or invalid
identifier, or an input that does not belong to the selected action produces
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

## Refactor Application Result

`refactor-result` adds proposal-only application result metadata over the
existing `refactor-application` request. It is a one-call receipt for editor
review panes and maintainer handoff notes to show that the request did not
attempt a write, did not generate a patch, did not change files, did not run
validation, and does not require rollback.

Example shape:

```json
{
  "kind": "module-refactor-application-result",
  "result_state": "not-applied",
  "action": "rename-module",
  "writes_files": false,
  "application_result": {
    "result": "not_applied",
    "result_state": "not-applied",
    "write_attempted": false,
    "patch_generated": false,
    "files_changed": [],
    "file_change_count": 0,
    "validation_run": false,
    "validation_result": "not_run",
    "rollback_required": false,
    "rollback_performed": false,
    "reason": "application request not accepted"
  },
  "application_summary": {
    "kind": "module-refactor-application-request",
    "application_state": "not-accepted",
    "accepted": false,
    "applied": false,
    "approval_decision_state": "not-approved",
    "validation_state": "proposal-only",
    "command_descriptor_count": 8,
    "validation_phases": []
  },
  "safety": {
    "read_only": true,
    "application_result_metadata_only": true,
    "approval_granted": false,
    "request_accepted": false,
    "write_attempted": false,
    "summarizes_command_descriptors": true,
    "emits_command_descriptors": false,
    "writes_files": false,
    "generates_patch": false,
    "runs_validation": false,
    "runs_shell": false,
    "rollback_required": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The result intentionally records `write_attempted: false`,
`patch_generated: false`, and an empty `files_changed` list. It summarizes the
application request and validation descriptor phases by command ID only and
does not include command argv; consumers that need the fixed-argv descriptor
list should call `validation-plan` directly.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
accept an application request, apply a refactor, perform rollback, grant
approval, or perform automatic repository actions.

## Refactor Handoff Summary

`refactor-handoff` adds summary-only refactor handoff metadata over the
existing `refactor-result` receipt. It is intended for editor review panes and
maintainer handoff notes that need a compact statement of what did not happen:
no write attempt, no generated patch, no changed files, no validation run, no
rollback requirement, no public text publication, no pull request creation, no
comment writing, and no project mutation.

Example shape:

```json
{
  "kind": "module-refactor-handoff-summary",
  "handoff_state": "ready-for-review",
  "action": "rename-module",
  "writes_files": false,
  "handoff_summary": {
    "state": "ready-for-review",
    "result_state": "not-applied",
    "result": "not_applied",
    "recommended_next_step": "review validation plan before any approval or application",
    "ready_for_maintainer_review": true,
    "public_text_ready": false,
    "pull_request_ready": false,
    "comment_ready": false,
    "files_changed": 0,
    "write_attempted": false,
    "patch_generated": false,
    "validation_run": false,
    "rollback_required": false
  },
  "application_result_summary": {
    "kind": "module-refactor-application-result",
    "result_state": "not-applied",
    "application_result": "not_applied",
    "write_attempted": false,
    "patch_generated": false,
    "file_change_count": 0,
    "validation_run": false,
    "validation_result": "not_run",
    "rollback_required": false,
    "approval_decision_state": "not-approved",
    "review_state": "ready-for-review",
    "validation_state": "proposal-only",
    "command_descriptor_count": 8,
    "validation_phases": []
  },
  "blocked_actions": [
    "file-write",
    "patch-generation",
    "refactor-application",
    "validation-run",
    "shell-command",
    "pull-request-create",
    "comment-write",
    "project-mutation"
  ],
  "safety": {
    "read_only": true,
    "handoff_summary_only": true,
    "approval_granted": false,
    "request_accepted": false,
    "write_attempted": false,
    "public_text_published": false,
    "pull_request_created": false,
    "comment_written": false,
    "project_mutation": false,
    "writes_files": false,
    "generates_patch": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The handoff intentionally summarizes validation descriptor phases by command ID
only and does not include command argv; consumers that need the fixed-argv
descriptor list should call `validation-plan` directly.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
publish public text, create pull requests, write comments, mutate projects,
accept an application request, apply a refactor, perform rollback, grant
approval, or perform automatic repository actions.

## Refactor Checklist Summary

`refactor-checklist` adds summary-only refactor checklist metadata over the
existing `refactor-handoff` summary. It is intended for editor review panes and
maintainer notes that need a compact list of gates before any write-capable
helper exists.

Example shape:

```json
{
  "kind": "module-refactor-checklist-summary",
  "checklist_state": "ready-for-review",
  "action": "rename-module",
  "writes_files": false,
  "checklist_items": [
    {
      "item_id": "preflight",
      "status": "ready-for-review",
      "required": true,
      "complete": true
    },
    {
      "item_id": "approval-gate",
      "status": "not-approved",
      "required": true,
      "complete": false
    }
  ],
  "handoff_summary": {
    "kind": "module-refactor-handoff-summary",
    "handoff_state": "ready-for-review",
    "ready_for_maintainer_review": true
  },
  "result_summary": {
    "application_result": "not_applied",
    "write_attempted": false,
    "patch_generated": false,
    "file_change_count": 0,
    "validation_run": false,
    "rollback_required": false,
    "command_descriptor_count": 8
  },
  "safety": {
    "read_only": true,
    "checklist_summary_only": true,
    "approval_granted": false,
    "request_accepted": false,
    "writes_files": false,
    "generates_patch": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The checklist intentionally summarizes review gates and command descriptor
counts only. It does not include command argv; consumers that need the
fixed-argv descriptor list should call `validation-plan` directly.

This boundary does not write files, apply refactors, move files, generate
patches, run validation, execute shell commands, invoke `pccx-lab`, invoke the
launcher, run vendor tools, call providers, touch hardware, upload telemetry,
publish public text, create pull requests, write comments, mutate projects,
accept an application request, apply a refactor, perform rollback, grant
approval, or perform automatic repository actions.

## Refactor Session Status

`refactor-session` adds summary-only refactor session status metadata over the
existing `refactor-checklist` summary. It is intended for editor status panes
and handoff dashboards that need one compact state envelope before any
write-capable helper exists.

Example shape:

```json
{
  "kind": "module-refactor-session-status",
  "session_state": "ready-for-review",
  "current_stage": "maintainer-review",
  "action": "rename-module",
  "writes_files": false,
  "session_summary": {
    "checklist_kind": "module-refactor-checklist-summary",
    "checklist_state": "ready-for-review",
    "ready_for_maintainer_review": true,
    "required_item_count": 6,
    "complete_required_count": 1,
    "incomplete_required_count": 5
  },
  "result_summary": {
    "application_result": "not_applied",
    "write_attempted": false,
    "patch_generated": false,
    "file_change_count": 0,
    "validation_run": false,
    "rollback_required": false,
    "command_descriptor_count": 8
  },
  "safety": {
    "read_only": true,
    "session_status_only": true,
    "session_persistence": false,
    "status_writeback": false,
    "notification_dispatched": false,
    "approval_granted": false,
    "request_accepted": false,
    "writes_files": false,
    "generates_patch": false,
    "runs_validation": false,
    "runs_shell": false,
    "invokes_pccx_lab": false,
    "invokes_launcher": false,
    "hardware_access": false
  }
}
```

The session status intentionally summarizes checklist items and counts only.
It does not include command argv; consumers that need the fixed-argv descriptor
list should call `validation-plan` directly.

This boundary does not persist session state, write status files, dispatch
notifications, write files, apply refactors, move files, generate patches, run
validation, execute shell commands, invoke `pccx-lab`, invoke the launcher, run
vendor tools, call providers, touch hardware, upload telemetry, publish public
text, create pull requests, write comments, mutate projects, accept an
application request, apply a refactor, perform rollback, grant approval, or
perform automatic repository actions.

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
bundles, refactor candidate action metadata, target-specific refactor
impact review data, and a
proposal-only refactoring, validation planning, review packet, approval
decision, application request, application result, handoff summary, and
checklist summary boundary.

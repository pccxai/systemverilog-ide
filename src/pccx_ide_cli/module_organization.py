# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .module_index import _strip_block_comments, scan_path

_ENDMODULE_RE = re.compile(r"^(\s*)endmodule\b")
_INSTANCE_RE = re.compile(
    r"^(\s*)([A-Za-z_]\w*)\s+(?:#\s*\([^;]*\)\s*)?([A-Za-z_]\w*)\s*\("
)

_NON_INSTANCE_WORDS: frozenset[str] = frozenset({
    "always",
    "always_comb",
    "always_ff",
    "always_latch",
    "assign",
    "case",
    "class",
    "covergroup",
    "endcase",
    "endclass",
    "endfunction",
    "endgenerate",
    "endmodule",
    "endpackage",
    "endprogram",
    "endtask",
    "for",
    "forever",
    "function",
    "generate",
    "if",
    "initial",
    "interface",
    "module",
    "package",
    "program",
    "task",
    "while",
})

LIMITATIONS: tuple[str, ...] = (
    "scanner-based module declarations and endmodule matching only",
    "single-line instantiation candidates only",
    "no preprocessor, generate-block, modport, package import, or semantic resolution",
    "refactoring helpers are proposal-only and do not write files",
    "pre-stable JSON shape",
)

HIERARCHY_VIEW_LIMITATIONS: tuple[str, ...] = (
    "scanner-based hierarchy visualization data only",
    "single-line instantiation candidates only",
    "no semantic elaboration, preprocessor expansion, generate-block expansion, or LSP",
    "no refactor application, file write, validation run, or patch generation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

REFACTOR_ACTIONS: tuple[str, ...] = (
    "rename-module",
    "extract-port",
    "move-module",
)

PROPOSAL_LIMITATIONS: tuple[str, ...] = (
    "proposal-only refactoring metadata",
    "scanner-based module boundary lookup only",
    "no symbol rewrite, port rewrite, file move, validation run, or patch generation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

_REFACTOR_REQUIRED_FIELDS: dict[str, tuple[str, ...]] = {
    "rename-module": ("new_name",),
    "extract-port": ("port_name", "direction"),
    "move-module": ("destination",),
}


def _safe_identifier(value: str | None) -> bool:
    return bool(value and re.fullmatch(r"[A-Za-z_]\w*", value))


def _refactor_safety_flags() -> dict[str, bool]:
    return {
        "applies_patch": False,
        "writes_files": False,
        "moves_files": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _hierarchy_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "writes_files": False,
        "applies_refactor": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _visible_lines(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    visible_lines: list[tuple[int, str]] = []
    in_block_comment = False
    for line_num, line in enumerate(text.splitlines(), 1):
        visible, in_block_comment = _strip_block_comments(line, in_block_comment)
        if visible.lstrip().startswith("//"):
            visible = ""
        visible_lines.append((line_num, visible))
    return visible_lines


def _find_endmodule(
    visible_lines: list[tuple[int, str]], start_line: int
) -> tuple[int | None, int | None]:
    for line_num, visible in visible_lines:
        if line_num <= start_line:
            continue
        match = _ENDMODULE_RE.match(visible)
        if match:
            return line_num, len(match.group(1)) + 1
    return None, None


def _module_boundary(
    declaration: dict[str, Any],
    visible_lines_by_file: dict[str, list[tuple[int, str]]],
) -> dict[str, Any]:
    file_name = declaration["file"]
    end_line, end_column = _find_endmodule(
        visible_lines_by_file[file_name],
        declaration["line"],
    )
    boundary: dict[str, Any] = {
        "complete": end_line is not None,
        "end_column": end_column,
        "end_line": end_line,
        "file": file_name,
        "name": declaration["name"],
        "span_lines": (
            end_line - declaration["line"] + 1
            if end_line is not None
            else None
        ),
        "start_column": declaration["column"],
        "start_line": declaration["line"],
    }
    return boundary


def _scan_instantiations(
    boundary: dict[str, Any],
    visible_lines: list[tuple[int, str]],
    known_modules: set[str],
) -> list[dict[str, Any]]:
    if not boundary["complete"]:
        return []

    edges: list[dict[str, Any]] = []
    for line_num, visible in visible_lines:
        if line_num <= boundary["start_line"] or line_num >= boundary["end_line"]:
            continue

        match = _INSTANCE_RE.match(visible)
        if not match:
            continue

        child = match.group(2)
        if child in _NON_INSTANCE_WORDS:
            continue

        edges.append({
            "child": child,
            "file": boundary["file"],
            "instance": match.group(3),
            "line": line_num,
            "column": len(match.group(1)) + 1,
            "parent": boundary["name"],
            "resolved": child in known_modules,
        })
    return edges


def _build_hierarchy(
    boundaries: list[dict[str, Any]],
    visible_lines_by_file: dict[str, list[tuple[int, str]]],
) -> dict[str, Any]:
    known_modules = {boundary["name"] for boundary in boundaries}
    edges: list[dict[str, Any]] = []
    for boundary in boundaries:
        edges.extend(
            _scan_instantiations(
                boundary,
                visible_lines_by_file[boundary["file"]],
                known_modules,
            )
        )

    resolved_children = {
        edge["child"]
        for edge in edges
        if edge["resolved"]
    }
    return {
        "edges": sorted(
            edges,
            key=lambda e: (
                e["parent"],
                e["line"],
                e["column"],
                e["child"],
                e["instance"],
            ),
        ),
        "roots": sorted(known_modules - resolved_children),
        "unresolved": sorted({
            edge["child"]
            for edge in edges
            if not edge["resolved"]
        }),
    }


def build_module_organization_export(
    source: str, path: Path
) -> dict[str, Any]:
    declarations = scan_path(path)
    module_declarations = [
        declaration
        for declaration in declarations
        if declaration["kind"] == "module"
    ]
    files = sorted({declaration["file"] for declaration in module_declarations})
    visible_lines_by_file = {
        file_name: _visible_lines(Path(file_name))
        for file_name in files
    }
    modules = [
        _module_boundary(declaration, visible_lines_by_file)
        for declaration in module_declarations
    ]
    modules.sort(key=lambda m: (m["file"], m["start_line"], m["name"]))

    return {
        "hierarchy": _build_hierarchy(modules, visible_lines_by_file),
        "kind": "module-organization",
        "limitations": list(LIMITATIONS),
        "modules": modules,
        "refactoring": {
            "candidate_inputs": [
                "module boundary spans",
                "scanner-based hierarchy edges",
            ],
            "mode": "proposal-only",
            "planned_helpers": [
                "rename module",
                "extract port",
                "move module",
            ],
            "writes_files": False,
        },
        "scanner": "line-scanner",
        "source": source,
        "tool": "pccx-ide-cli",
    }


def _module_lookup(modules: list[dict[str, Any]], name: str) -> list[dict[str, Any]]:
    return [
        module
        for module in modules
        if module["name"] == name
    ]


def _module_summary(module: dict[str, Any]) -> dict[str, Any]:
    return {
        "complete": module["complete"],
        "end_line": module["end_line"],
        "file": module["file"],
        "name": module["name"],
        "start_line": module["start_line"],
    }


def _hierarchy_tree_rows(
    modules: list[dict[str, Any]],
    hierarchy: dict[str, Any],
) -> list[dict[str, Any]]:
    modules_by_name: dict[str, dict[str, Any]] = {}
    for module in modules:
        modules_by_name.setdefault(module["name"], module)

    children_by_parent: dict[str, list[dict[str, Any]]] = {}
    for edge in hierarchy["edges"]:
        children_by_parent.setdefault(edge["parent"], []).append(edge)

    roots = hierarchy["roots"] or sorted(modules_by_name)
    rows: list[dict[str, Any]] = []

    def visit(
        module_name: str,
        depth: int,
        path: list[str],
        via_edge: dict[str, Any] | None,
    ) -> None:
        module = modules_by_name.get(module_name)
        next_path = [*path, module_name]
        row = {
            "complete": module["complete"] if module is not None else False,
            "depth": depth,
            "file": module["file"] if module is not None else via_edge["file"],
            "module": module_name,
            "path": next_path,
            "start_line": (
                module["start_line"] if module is not None else via_edge["line"]
            ),
            "state": (
                "root"
                if via_edge is None
                else "resolved" if via_edge["resolved"] else "unresolved"
            ),
            "via_instance": via_edge["instance"] if via_edge is not None else None,
            "via_parent": via_edge["parent"] if via_edge is not None else None,
        }
        rows.append(row)

        if module_name in path:
            row["state"] = "cycle"
            return

        for edge in children_by_parent.get(module_name, []):
            if edge["resolved"]:
                visit(edge["child"], depth + 1, next_path, edge)
            else:
                rows.append({
                    "complete": False,
                    "depth": depth + 1,
                    "file": edge["file"],
                    "module": edge["child"],
                    "path": [*next_path, edge["child"]],
                    "start_line": edge["line"],
                    "state": "unresolved",
                    "via_instance": edge["instance"],
                    "via_parent": edge["parent"],
                })

    for root in roots:
        visit(root, 0, [], None)
    return rows


def build_module_hierarchy_view(source: str, path: Path) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    modules = organization["modules"]
    hierarchy = organization["hierarchy"]
    modules_by_name: dict[str, dict[str, Any]] = {}
    for module in modules:
        modules_by_name.setdefault(module["name"], module)

    return {
        "edge_count": len(hierarchy["edges"]),
        "edges": hierarchy["edges"],
        "kind": "module-hierarchy-view",
        "limitations": list(HIERARCHY_VIEW_LIMITATIONS),
        "module_count": len(modules),
        "root_count": len(hierarchy["roots"]),
        "roots": [
            _module_summary(modules_by_name[root])
            for root in hierarchy["roots"]
            if root in modules_by_name
        ],
        "safety": _hierarchy_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "tool": "pccx-ide-cli",
        "tree": _hierarchy_tree_rows(modules, hierarchy),
        "unresolved": hierarchy["unresolved"],
        "view_state": "available_as_data",
    }


def _requested_change(
    action: str,
    module_name: str,
    *,
    new_name: str | None,
    port_name: str | None,
    direction: str | None,
    width: str | None,
    destination: str | None,
) -> dict[str, Any]:
    return {
        "action": action,
        "module": module_name,
        "new_name": new_name,
        "port_name": port_name,
        "direction": direction,
        "width": width,
        "destination": destination,
    }


def _planned_steps(action: str, module: dict[str, Any] | None) -> list[str]:
    if module is None:
        return []
    if action == "rename-module":
        return [
            "review scanner-detected module declaration span",
            "prepare module declaration rename proposal",
            "prepare same-file instantiation type review list",
            "require explicit approval before any file edit",
        ]
    if action == "extract-port":
        return [
            "review scanner-detected module declaration span",
            "prepare port declaration insertion proposal",
            "prepare instance connection review list",
            "require explicit approval before any file edit",
        ]
    if action == "move-module":
        return [
            "review scanner-detected module declaration span",
            "prepare destination file review note",
            "prepare source-file removal review note",
            "require explicit approval before any file move or edit",
        ]
    return []


def _preflight(
    action: str,
    module_name: str,
    matches: list[dict[str, Any]],
    requested: dict[str, Any],
) -> dict[str, Any]:
    reasons: list[str] = []
    required = _REFACTOR_REQUIRED_FIELDS[action]
    for field in required:
        if not requested[field]:
            reasons.append(f"missing required {field.replace('_', '-')}")

    if len(matches) == 0:
        reasons.append(f"module not found: {module_name}")
    elif len(matches) > 1:
        reasons.append(f"ambiguous module name: {module_name}")
    elif not matches[0]["complete"]:
        reasons.append(f"module boundary is incomplete: {module_name}")

    if action == "rename-module" and requested["new_name"]:
        if not _safe_identifier(requested["new_name"]):
            reasons.append("new-name must be a SystemVerilog-style identifier")
        if requested["new_name"] == module_name:
            reasons.append("new-name matches the current module name")

    if action == "extract-port" and requested["port_name"]:
        if not _safe_identifier(requested["port_name"]):
            reasons.append("port-name must be a SystemVerilog-style identifier")

    if action == "move-module" and requested["destination"]:
        destination = str(requested["destination"])
        if destination.startswith("/") or ".." in Path(destination).parts:
            reasons.append("destination must be a relative path inside the workspace")
        if not destination.endswith((".sv", ".v")):
            reasons.append("destination should end with .sv or .v")

    return {
        "reasons": reasons,
        "requires_approval_before_write": True,
        "status": "blocked" if reasons else "ready-for-review",
    }


def build_refactor_proposal(
    source: str,
    path: Path,
    action: str,
    module_name: str,
    *,
    new_name: str | None = None,
    port_name: str | None = None,
    direction: str | None = None,
    width: str | None = None,
    destination: str | None = None,
) -> dict[str, Any]:
    if action not in REFACTOR_ACTIONS:
        raise ValueError(f"unknown refactor action: {action}")

    organization = build_module_organization_export(source, path)
    matches = _module_lookup(organization["modules"], module_name)
    requested = _requested_change(
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    preflight = _preflight(action, module_name, matches, requested)
    selected_module = matches[0] if len(matches) == 1 else None

    return {
        "action": action,
        "kind": "module-refactor-proposal",
        "limitations": list(PROPOSAL_LIMITATIONS),
        "module": selected_module,
        "planned_steps": _planned_steps(action, selected_module),
        "preflight": preflight,
        "proposal_state": "proposal-only",
        "requested_change": requested,
        "safety": _refactor_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def format_refactor_proposal_text(proposal: dict[str, Any]) -> str:
    lines = [
        f"source: {proposal['source']}",
        f"action: {proposal['action']}",
        f"module: {proposal['requested_change']['module']}",
        f"proposal: {proposal['proposal_state']}",
        f"preflight: {proposal['preflight']['status']}",
        "writes files: no",
    ]
    module = proposal["module"]
    if module is not None:
        lines.append(
            f"boundary: {module['file']}:{module['start_line']}:"
            f"{module['start_column']}-{module['end_line']}:{module['end_column']}"
        )
    if proposal["preflight"]["reasons"]:
        for reason in proposal["preflight"]["reasons"]:
            lines.append(f"blocked: {reason}")
    else:
        for step in proposal["planned_steps"]:
            lines.append(f"plan: {step}")
    lines.append("no patch, validation, lab, launcher, provider, or hardware execution")
    return "\n".join(lines) + "\n"


def format_module_organization_text(export: dict[str, Any]) -> str:
    lines = [
        f"source: {export['source']}",
        f"{len(export['modules'])} module"
        f"{'s' if len(export['modules']) != 1 else ''}",
    ]
    for module in export["modules"]:
        end = (
            f"{module['end_line']}:{module['end_column']}"
            if module["complete"]
            else "missing"
        )
        state = "complete" if module["complete"] else "incomplete"
        lines.append(
            f"{module['file']}:{module['start_line']}:{module['start_column']}"
            f"-{end}: module {module['name']} ({state})"
        )

    hierarchy = export["hierarchy"]
    lines.append(
        f"{len(hierarchy['edges'])} hierarchy edge"
        f"{'s' if len(hierarchy['edges']) != 1 else ''}"
    )
    for edge in hierarchy["edges"]:
        state = "resolved" if edge["resolved"] else "unresolved"
        lines.append(
            f"{edge['parent']} -> {edge['child']} as {edge['instance']} "
            f"at {edge['file']}:{edge['line']}:{edge['column']} ({state})"
        )

    if hierarchy["roots"]:
        lines.append(f"roots: {', '.join(hierarchy['roots'])}")
    if hierarchy["unresolved"]:
        lines.append(f"unresolved: {', '.join(hierarchy['unresolved'])}")
    lines.append("refactoring: proposal-only, no file writes")
    return "\n".join(lines) + "\n"


def format_module_hierarchy_text(view: dict[str, Any]) -> str:
    lines = [
        f"source: {view['source']}",
        f"hierarchy view: {view['view_state']}",
        f"{view['module_count']} module"
        f"{'s' if view['module_count'] != 1 else ''}",
        f"{view['edge_count']} hierarchy edge"
        f"{'s' if view['edge_count'] != 1 else ''}",
        "tree:",
    ]
    if not view["tree"]:
        lines.append("  empty")
    for row in view["tree"]:
        indent = "  " * (row["depth"] + 1)
        if row["via_instance"] is None:
            lines.append(f"{indent}{row['module']} ({row['state']})")
        else:
            lines.append(
                f"{indent}{row['module']} as {row['via_instance']} "
                f"({row['state']})"
            )
    if view["unresolved"]:
        lines.append(f"unresolved: {', '.join(view['unresolved'])}")
    lines.append(
        "read-only: no file writes, refactors, validation, lab, launcher, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"

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
_IDENT_RE = re.compile(r"\b[A-Za-z_]\w*\b")
_PORT_DIRECTION_RE = re.compile(r"\b(input|output|inout)\b")
_PORT_WIDTH_RE = re.compile(r"(\[[^\]]+\])")
_PORT_NAMED_CONNECTION_RE = re.compile(r"\.\s*([A-Za-z_]\w*)\s*\(")
_PORT_CONNECTION_SCAN_LINE_LIMIT = 40

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

_PORT_SKIP_WORDS: frozenset[str] = frozenset({
    "bit",
    "byte",
    "input",
    "inout",
    "integer",
    "int",
    "logic",
    "longint",
    "output",
    "parameter",
    "reg",
    "shortint",
    "signed",
    "time",
    "tri",
    "var",
    "wire",
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

DEPENDENCY_VIEW_LIMITATIONS: tuple[str, ...] = (
    "scanner-based module dependency visualization data only",
    "single-line instantiation candidates only",
    "direct dependency and dependent summaries only",
    "no semantic elaboration, preprocessor expansion, generate-block expansion, or LSP",
    "no refactor application, file write, validation run, or patch generation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

MODULE_SUMMARY_LIMITATIONS: tuple[str, ...] = (
    "scanner-based module header and port summary data only",
    "ANSI-style port declarations are detected conservatively",
    "non-ANSI body declarations, parameters, macros, interfaces, and modports are not resolved",
    "no semantic elaboration, preprocessor expansion, generate-block expansion, or LSP",
    "no refactor application, file write, validation run, or patch generation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

PORT_USAGE_LIMITATIONS: tuple[str, ...] = (
    "scanner-based target module port usage data only",
    "ANSI-style target port declarations are detected conservatively",
    "instantiation candidates come from the existing line scanner",
    "connection summaries are bounded to the scanner-detected instantiation statement",
    "named and ordered port connections are not semantically resolved",
    "no semantic elaboration, preprocessor expansion, generate-block expansion, or LSP",
    "no refactor application, file write, validation run, or patch generation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

MODULE_CONTEXT_LIMITATIONS: tuple[str, ...] = (
    "scanner-based target module context bundle data only",
    "combines existing summary, dependency, port-usage, and refactor-impact views",
    "no semantic elaboration, preprocessor expansion, generate-block expansion, or LSP",
    "no refactor application, file write, validation run, or patch generation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

REFACTOR_IMPACT_LIMITATIONS: tuple[str, ...] = (
    "scanner-based target-specific refactor impact data only",
    "module declarations and single-line instantiation candidates only",
    "direct dependency and dependent references only",
    "no symbol rewrite, port rewrite, file move, validation run, or patch generation",
    "no semantic elaboration, preprocessor expansion, generate-block expansion, or LSP",
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


def _dependency_safety_flags() -> dict[str, bool]:
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


def _module_summary_safety_flags() -> dict[str, bool]:
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


def _refactor_impact_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "writes_files": False,
        "applies_refactor": False,
        "moves_files": False,
        "applies_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _port_usage_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "writes_files": False,
        "applies_refactor": False,
        "moves_files": False,
        "applies_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _module_context_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "writes_files": False,
        "applies_refactor": False,
        "moves_files": False,
        "applies_patch": False,
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


def _dependency_impact_rows(
    modules: list[dict[str, Any]],
    hierarchy: dict[str, Any],
) -> list[dict[str, Any]]:
    module_names = sorted({module["name"] for module in modules})
    dependencies_by_module: dict[str, set[str]] = {
        module_name: set()
        for module_name in module_names
    }
    dependents_by_module: dict[str, set[str]] = {
        module_name: set()
        for module_name in module_names
    }
    unresolved_by_module: dict[str, set[str]] = {
        module_name: set()
        for module_name in module_names
    }

    for edge in hierarchy["edges"]:
        parent = edge["parent"]
        child = edge["child"]
        if parent not in dependencies_by_module:
            continue
        if edge["resolved"]:
            dependencies_by_module[parent].add(child)
            dependents_by_module.setdefault(child, set()).add(parent)
        else:
            unresolved_by_module[parent].add(child)

    rows: list[dict[str, Any]] = []
    for module_name in module_names:
        dependencies = sorted(dependencies_by_module.get(module_name, set()))
        dependents = sorted(dependents_by_module.get(module_name, set()))
        unresolved = sorted(unresolved_by_module.get(module_name, set()))
        rows.append({
            "direct_dependencies": dependencies,
            "direct_dependency_count": len(dependencies),
            "direct_dependents": dependents,
            "direct_dependent_count": len(dependents),
            "impact_state": "available_as_data",
            "module": module_name,
            "unresolved_dependencies": unresolved,
            "unresolved_dependency_count": len(unresolved),
        })
    return rows


def build_module_dependency_view(source: str, path: Path) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    modules = organization["modules"]
    hierarchy = organization["hierarchy"]
    resolved_edges = [
        edge
        for edge in hierarchy["edges"]
        if edge["resolved"]
    ]

    reverse_edges = [
        {
            "dependent": edge["parent"],
            "file": edge["file"],
            "instance": edge["instance"],
            "line": edge["line"],
            "module": edge["child"],
        }
        for edge in resolved_edges
    ]

    return {
        "dependency_state": "available_as_data",
        "edge_count": len(hierarchy["edges"]),
        "edges": hierarchy["edges"],
        "impact": _dependency_impact_rows(modules, hierarchy),
        "kind": "module-dependency-view",
        "limitations": list(DEPENDENCY_VIEW_LIMITATIONS),
        "module_count": len(modules),
        "resolved_edge_count": len(resolved_edges),
        "reverse_edges": sorted(
            reverse_edges,
            key=lambda e: (
                e["module"],
                e["dependent"],
                e["line"],
                e["instance"],
            ),
        ),
        "safety": _dependency_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "tool": "pccx-ide-cli",
        "unresolved": hierarchy["unresolved"],
        "unresolved_edge_count": len([
            edge
            for edge in hierarchy["edges"]
            if not edge["resolved"]
        ]),
    }


def _module_header(
    module: dict[str, Any],
    visible_lines: list[tuple[int, str]],
) -> dict[str, Any]:
    lines: list[tuple[int, str]] = []
    header_end_line: int | None = None
    boundary_end = module["end_line"]
    for line_num, visible in visible_lines:
        if line_num < module["start_line"]:
            continue
        if boundary_end is not None and line_num >= boundary_end:
            break
        lines.append((line_num, visible))
        if ";" in visible:
            header_end_line = line_num
            break

    return {
        "complete": header_end_line is not None,
        "end_line": header_end_line,
        "line_count": len(lines),
        "lines": lines,
        "start_line": module["start_line"],
    }


def _port_segments(line: str, module_name: str) -> list[str]:
    visible = line.split("//", 1)[0]
    module_prefix = re.match(rf"^\s*module\s+{re.escape(module_name)}\b", visible)
    if module_prefix:
        open_paren = visible.find("(", module_prefix.end())
        if open_paren == -1:
            return []
        visible = visible[open_paren + 1:]

    visible = (
        visible
        .replace(");", " ")
        .replace(";", " ")
        .replace("(", " ")
        .replace(")", " ")
    )
    return [
        segment.strip()
        for segment in visible.split(",")
        if segment.strip()
    ]


def _port_name_from_segment(segment: str) -> str | None:
    before_default = segment.split("=", 1)[0]
    identifiers = [
        identifier
        for identifier in _IDENT_RE.findall(before_default)
        if identifier not in _PORT_SKIP_WORDS
    ]
    return identifiers[-1] if identifiers else None


def _scan_header_ports(
    module: dict[str, Any],
    header_lines: list[tuple[int, str]],
) -> list[dict[str, Any]]:
    ports: list[dict[str, Any]] = []
    current_direction: str | None = None
    current_width: str | None = None
    seen_names: set[str] = set()

    for line_num, visible in header_lines:
        for segment in _port_segments(visible, module["name"]):
            if "parameter" in _IDENT_RE.findall(segment):
                current_direction = None
                current_width = None
                continue

            direction_match = _PORT_DIRECTION_RE.search(segment)
            width_match = _PORT_WIDTH_RE.search(segment)
            if direction_match:
                current_direction = direction_match.group(1)
                current_width = width_match.group(1) if width_match else None
                state = "detected"
            elif current_direction is not None:
                state = "inherited-direction"
            else:
                state = "direction-unknown"

            name = _port_name_from_segment(segment)
            if name is None or name in seen_names:
                continue

            seen_names.add(name)
            ports.append({
                "direction": current_direction or "unknown",
                "line": line_num,
                "name": name,
                "state": state,
                "width": current_width,
            })

    return ports


def _port_direction_counts(ports: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "input": 0,
        "output": 0,
        "inout": 0,
        "unknown": 0,
    }
    for port in ports:
        counts[port["direction"]] = counts.get(port["direction"], 0) + 1
    return counts


def _module_summary_readiness(
    module: dict[str, Any],
    header: dict[str, Any],
) -> dict[str, Any]:
    reasons: list[str] = []
    if not module["complete"]:
        reasons.append(f"module boundary is incomplete: {module['name']}")
    if not header["complete"]:
        reasons.append(f"module header is incomplete: {module['name']}")
    return {
        "reasons": reasons,
        "state": "blocked" if reasons else "ready-for-review",
    }


def _module_summary_rows(
    modules: list[dict[str, Any]],
    visible_lines_by_file: dict[str, list[tuple[int, str]]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for module in modules:
        header = _module_header(module, visible_lines_by_file[module["file"]])
        ports = _scan_header_ports(module, header["lines"])
        rows.append({
            "boundary": _module_summary(module),
            "file": module["file"],
            "header": {
                "complete": header["complete"],
                "end_line": header["end_line"],
                "line_count": header["line_count"],
                "start_line": header["start_line"],
            },
            "name": module["name"],
            "port_count": len(ports),
            "port_direction_counts": _port_direction_counts(ports),
            "ports": ports,
            "readiness": _module_summary_readiness(module, header),
        })
    return rows


def build_module_summary_view(source: str, path: Path) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    modules = organization["modules"]
    files = sorted({module["file"] for module in modules})
    visible_lines_by_file = {
        file_name: _visible_lines(Path(file_name))
        for file_name in files
    }
    summaries = _module_summary_rows(modules, visible_lines_by_file)

    return {
        "kind": "module-summary-view",
        "limitations": list(MODULE_SUMMARY_LIMITATIONS),
        "module_count": len(summaries),
        "modules": summaries,
        "port_count": sum(summary["port_count"] for summary in summaries),
        "safety": _module_summary_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "summary_state": "available_as_data",
        "tool": "pccx-ide-cli",
    }


def _instantiation_statement(
    edge: dict[str, Any],
    visible_lines: list[tuple[int, str]],
) -> dict[str, Any]:
    statement_lines: list[str] = []
    complete = False
    truncated = False

    for line_num, visible in visible_lines:
        if line_num < edge["line"]:
            continue
        if len(statement_lines) >= _PORT_CONNECTION_SCAN_LINE_LIMIT:
            truncated = True
            break

        statement_lines.append(visible.strip())
        if ";" in visible:
            complete = True
            break

    return {
        "complete": complete,
        "line_count": len(statement_lines),
        "text": " ".join(statement_lines).strip(),
        "truncated": truncated,
    }


def _instantiation_argument_text(edge: dict[str, Any], statement: str) -> str:
    head_match = re.search(
        rf"\b{re.escape(edge['child'])}\s+"
        rf"(?:#\s*\([^;]*\)\s*)?"
        rf"{re.escape(edge['instance'])}\s*\(",
        statement,
    )
    open_paren = (
        head_match.end() - 1
        if head_match is not None
        else statement.find("(")
    )
    if open_paren == -1:
        return ""

    close_paren = statement.rfind(")")
    if close_paren <= open_paren:
        return statement[open_paren + 1:].strip()
    return statement[open_paren + 1:close_paren].strip()


def _ordered_connection_count(argument_text: str) -> int:
    return len([
        segment
        for segment in argument_text.split(",")
        if segment.strip()
    ])


def _instance_connection_summary(
    edge: dict[str, Any],
    visible_lines: list[tuple[int, str]],
) -> dict[str, Any]:
    statement = _instantiation_statement(edge, visible_lines)
    argument_text = _instantiation_argument_text(edge, statement["text"])
    named_connections = _PORT_NAMED_CONNECTION_RE.findall(argument_text)

    if named_connections:
        connection_style = "named"
        connection_names = list(dict.fromkeys(named_connections))
        connection_count = len(named_connections)
    elif argument_text:
        connection_style = "ordered"
        connection_names = []
        connection_count = _ordered_connection_count(argument_text)
    else:
        connection_style = "unknown"
        connection_names = []
        connection_count = 0

    return {
        "connection_count": connection_count,
        "connection_names": connection_names,
        "connection_style": connection_style,
        "scan_complete": statement["complete"],
        "scan_line_count": statement["line_count"],
        "scan_truncated": statement["truncated"],
        "semantically_resolved": False,
    }


def _port_usage_rows(
    dependent_edges: list[dict[str, Any]],
    visible_lines_by_file: dict[str, list[tuple[int, str]]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for edge in dependent_edges:
        rows.append({
            "child": edge["child"],
            "column": edge["column"],
            "file": edge["file"],
            "instance": edge["instance"],
            "line": edge["line"],
            "parent": edge["parent"],
            "resolved": edge["resolved"],
            **_instance_connection_summary(
                edge,
                visible_lines_by_file.get(edge["file"], []),
            ),
        })
    return rows


def build_module_port_usage_view(
    source: str,
    path: Path,
    module_name: str,
) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    modules = organization["modules"]
    hierarchy = organization["hierarchy"]
    files = sorted({module["file"] for module in modules})
    visible_lines_by_file = {
        file_name: _visible_lines(Path(file_name))
        for file_name in files
    }

    matches = _module_lookup(modules, module_name)
    selected_module = matches[0] if len(matches) == 1 else None
    header = None
    ports: list[dict[str, Any]] = []
    if selected_module is not None:
        header = _module_header(
            selected_module,
            visible_lines_by_file[selected_module["file"]],
        )
        ports = _scan_header_ports(selected_module, header["lines"])

    dependent_edges = [
        edge
        for edge in hierarchy["edges"]
        if edge["child"] == module_name
    ]
    direct_dependents = sorted({
        edge["parent"]
        for edge in dependent_edges
    })

    return {
        "dependent_edges": dependent_edges,
        "direct_dependent_count": len(direct_dependents),
        "direct_dependents": direct_dependents,
        "header": (
            {
                "complete": header["complete"],
                "end_line": header["end_line"],
                "line_count": header["line_count"],
                "start_line": header["start_line"],
            }
            if header is not None
            else None
        ),
        "kind": "module-port-usage-view",
        "limitations": list(PORT_USAGE_LIMITATIONS),
        "module": selected_module,
        "port_count": len(ports),
        "port_direction_counts": _port_direction_counts(ports),
        "ports": ports,
        "preflight": _refactor_impact_preflight(module_name, matches),
        "safety": _port_usage_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "usage_site_count": len(dependent_edges),
        "usage_sites": _port_usage_rows(dependent_edges, visible_lines_by_file),
        "usage_state": "available_as_data",
        "writes_files": False,
    }


def _refactor_impact_preflight(
    module_name: str,
    matches: list[dict[str, Any]],
) -> dict[str, Any]:
    reasons: list[str] = []
    if len(matches) == 0:
        reasons.append(f"module not found: {module_name}")
    elif len(matches) > 1:
        reasons.append(f"ambiguous module name: {module_name}")
    elif not matches[0]["complete"]:
        reasons.append(f"module boundary is incomplete: {module_name}")

    return {
        "reasons": reasons,
        "requires_approval_before_write": True,
        "status": "blocked" if reasons else "ready-for-review",
    }


def _edge_review_target(edge: dict[str, Any], kind: str) -> dict[str, Any]:
    return {
        "child": edge["child"],
        "column": edge["column"],
        "file": edge["file"],
        "instance": edge["instance"],
        "kind": kind,
        "line": edge["line"],
        "parent": edge["parent"],
        "resolved": edge["resolved"],
    }


def _refactor_impact_review_targets(
    module: dict[str, Any] | None,
    dependent_edges: list[dict[str, Any]],
    dependency_edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    targets: list[dict[str, Any]] = []
    if module is not None:
        targets.append({
            "column": module["start_column"],
            "file": module["file"],
            "kind": "module-declaration",
            "line": module["start_line"],
            "module": module["name"],
        })
    targets.extend(
        _edge_review_target(edge, "dependent-instantiation")
        for edge in dependent_edges
    )
    targets.extend(
        _edge_review_target(edge, "dependency-instantiation")
        for edge in dependency_edges
    )
    return targets


def build_refactor_impact_view(
    source: str,
    path: Path,
    module_name: str,
) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    modules = organization["modules"]
    hierarchy = organization["hierarchy"]
    matches = _module_lookup(modules, module_name)
    selected_module = matches[0] if len(matches) == 1 else None
    dependency_edges = [
        edge
        for edge in hierarchy["edges"]
        if edge["parent"] == module_name
    ]
    dependent_edges = [
        edge
        for edge in hierarchy["edges"]
        if edge["child"] == module_name
    ]
    direct_dependencies = sorted({
        edge["child"]
        for edge in dependency_edges
        if edge["resolved"]
    })
    unresolved_dependencies = sorted({
        edge["child"]
        for edge in dependency_edges
        if not edge["resolved"]
    })
    direct_dependents = sorted({
        edge["parent"]
        for edge in dependent_edges
    })

    return {
        "dependency_edges": dependency_edges,
        "dependent_edges": dependent_edges,
        "direct_dependencies": direct_dependencies,
        "direct_dependency_count": len(direct_dependencies),
        "direct_dependents": direct_dependents,
        "direct_dependent_count": len(direct_dependents),
        "impact_state": "available_as_data",
        "kind": "module-refactor-impact-view",
        "limitations": list(REFACTOR_IMPACT_LIMITATIONS),
        "module": selected_module,
        "preflight": _refactor_impact_preflight(module_name, matches),
        "review_targets": _refactor_impact_review_targets(
            selected_module,
            dependent_edges,
            dependency_edges,
        ),
        "safety": _refactor_impact_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "unresolved_dependencies": unresolved_dependencies,
        "unresolved_dependency_count": len(unresolved_dependencies),
        "writes_files": False,
    }


def _selected_module_summary(
    summary_view: dict[str, Any],
    selected_module: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if selected_module is None:
        return None
    for summary in summary_view["modules"]:
        boundary = summary["boundary"]
        if (
            summary["name"] == selected_module["name"]
            and boundary["file"] == selected_module["file"]
            and boundary["start_line"] == selected_module["start_line"]
        ):
            return summary
    return None


def _selected_dependency_impact(
    dependency_view: dict[str, Any],
    module_name: str,
) -> dict[str, Any] | None:
    for row in dependency_view["impact"]:
        if row["module"] == module_name:
            return row
    return None


def _source_view_refs(
    summary_view: dict[str, Any],
    dependency_view: dict[str, Any],
    port_usage_view: dict[str, Any],
    refactor_impact_view: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        {
            "command": "module-summary",
            "kind": summary_view["kind"],
            "state": summary_view["summary_state"],
            "included": True,
            "summary": "conservative module header and port metadata",
        },
        {
            "command": "dependencies",
            "kind": dependency_view["kind"],
            "state": dependency_view["dependency_state"],
            "included": True,
            "summary": "direct dependency and dependent summaries",
        },
        {
            "command": "port-usage",
            "kind": port_usage_view["kind"],
            "state": port_usage_view["usage_state"],
            "included": True,
            "summary": "target port declarations and dependent usage sites",
        },
        {
            "command": "refactor-impact",
            "kind": refactor_impact_view["kind"],
            "state": refactor_impact_view["impact_state"],
            "included": True,
            "summary": "target-specific declaration and reference review data",
        },
    ]


def build_module_context_bundle(
    source: str,
    path: Path,
    module_name: str,
) -> dict[str, Any]:
    summary_view = build_module_summary_view(source, path)
    dependency_view = build_module_dependency_view(source, path)
    port_usage_view = build_module_port_usage_view(source, path, module_name)
    refactor_impact_view = build_refactor_impact_view(source, path, module_name)
    selected_module = refactor_impact_view["module"]
    selected_summary = _selected_module_summary(summary_view, selected_module)
    dependency_impact = _selected_dependency_impact(dependency_view, module_name)
    preflight = refactor_impact_view["preflight"]

    return {
        "context_state": (
            "blocked"
            if preflight["status"] == "blocked"
            else "available_as_data"
        ),
        "dependency_context": {
            "dependency_edges": refactor_impact_view["dependency_edges"],
            "dependency_impact": dependency_impact,
            "dependent_edges": refactor_impact_view["dependent_edges"],
            "direct_dependencies": refactor_impact_view["direct_dependencies"],
            "direct_dependency_count": refactor_impact_view["direct_dependency_count"],
            "direct_dependents": refactor_impact_view["direct_dependents"],
            "direct_dependent_count": refactor_impact_view["direct_dependent_count"],
            "unresolved_dependencies": refactor_impact_view["unresolved_dependencies"],
            "unresolved_dependency_count": (
                refactor_impact_view["unresolved_dependency_count"]
            ),
        },
        "kind": "module-context-bundle",
        "limitations": list(MODULE_CONTEXT_LIMITATIONS),
        "module": selected_module,
        "port_context": {
            "direct_dependents": port_usage_view["direct_dependents"],
            "header": port_usage_view["header"],
            "port_count": port_usage_view["port_count"],
            "port_direction_counts": port_usage_view["port_direction_counts"],
            "ports": port_usage_view["ports"],
            "usage_site_count": port_usage_view["usage_site_count"],
            "usage_sites": port_usage_view["usage_sites"],
        },
        "preflight": preflight,
        "refactor_context": {
            "review_target_count": len(refactor_impact_view["review_targets"]),
            "review_targets": refactor_impact_view["review_targets"],
            "writes_files": False,
        },
        "safety": _module_context_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "source_views": _source_view_refs(
            summary_view,
            dependency_view,
            port_usage_view,
            refactor_impact_view,
        ),
        "summary_context": selected_summary,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "writes_files": False,
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


def format_module_dependency_text(view: dict[str, Any]) -> str:
    lines = [
        f"source: {view['source']}",
        f"dependency view: {view['dependency_state']}",
        f"{view['module_count']} module"
        f"{'s' if view['module_count'] != 1 else ''}",
        f"{view['edge_count']} dependency edge"
        f"{'s' if view['edge_count'] != 1 else ''}",
        f"{view['resolved_edge_count']} resolved edge"
        f"{'s' if view['resolved_edge_count'] != 1 else ''}",
    ]
    for edge in view["edges"]:
        state = "resolved" if edge["resolved"] else "unresolved"
        lines.append(
            f"{edge['parent']} -> {edge['child']} as {edge['instance']} "
            f"at {edge['file']}:{edge['line']}:{edge['column']} ({state})"
        )
    if not view["edges"]:
        lines.append("edges: none")

    lines.append("impact:")
    if not view["impact"]:
        lines.append("  empty")
    for row in view["impact"]:
        dependencies = ", ".join(row["direct_dependencies"]) or "none"
        dependents = ", ".join(row["direct_dependents"]) or "none"
        unresolved = ", ".join(row["unresolved_dependencies"]) or "none"
        lines.append(
            f"  {row['module']}: dependencies={dependencies}; "
            f"dependents={dependents}; unresolved={unresolved}"
        )
    if view["unresolved"]:
        lines.append(f"unresolved: {', '.join(view['unresolved'])}")
    lines.append(
        "read-only: no file writes, refactors, validation, lab, launcher, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_module_summary_text(view: dict[str, Any]) -> str:
    lines = [
        f"source: {view['source']}",
        f"module summary: {view['summary_state']}",
        f"{view['module_count']} module"
        f"{'s' if view['module_count'] != 1 else ''}",
        f"{view['port_count']} port"
        f"{'s' if view['port_count'] != 1 else ''}",
    ]
    for module in view["modules"]:
        header_state = "complete" if module["header"]["complete"] else "incomplete"
        readiness = module["readiness"]["state"]
        lines.append(
            f"{module['file']}:{module['boundary']['start_line']}: "
            f"module {module['name']} ({header_state} header, {readiness})"
        )
        if not module["ports"]:
            lines.append("  ports: none")
        for port in module["ports"]:
            width = f" {port['width']}" if port["width"] else ""
            lines.append(
                f"  {port['direction']}{width} {port['name']} "
                f"at line {port['line']} ({port['state']})"
            )
        for reason in module["readiness"]["reasons"]:
            lines.append(f"  blocked: {reason}")
    lines.append(
        "read-only: no file writes, refactors, validation, lab, launcher, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def _port_usage_connection_label(site: dict[str, Any]) -> str:
    if site["connection_style"] == "named":
        names = ", ".join(site["connection_names"]) or "none"
        return f"named connections: {names}"
    if site["connection_style"] == "ordered":
        return f"ordered connections: {site['connection_count']}"
    return "connections: unknown"


def format_module_port_usage_text(view: dict[str, Any]) -> str:
    lines = [
        f"source: {view['source']}",
        f"target: {view['target']}",
        f"port usage: {view['usage_state']}",
        f"preflight: {view['preflight']['status']}",
        "writes files: no",
    ]

    module = view["module"]
    if module is not None:
        lines.append(
            f"declaration: {module['file']}:{module['start_line']}:"
            f"{module['start_column']}"
        )

    lines.append(
        f"{view['port_count']} target port"
        f"{'s' if view['port_count'] != 1 else ''}"
    )
    if not view["ports"]:
        lines.append("ports: none")
    for port in view["ports"]:
        width = f" {port['width']}" if port["width"] else ""
        lines.append(
            f"  {port['direction']}{width} {port['name']} "
            f"at line {port['line']} ({port['state']})"
        )

    dependents = ", ".join(view["direct_dependents"]) or "none"
    lines.append(f"dependents: {dependents}")
    lines.append("usage sites:")
    if not view["usage_sites"]:
        lines.append("  none")
    for site in view["usage_sites"]:
        state = "resolved" if site["resolved"] else "unresolved"
        connection_label = _port_usage_connection_label(site)
        lines.append(
            f"  {site['parent']} instantiates {site['child']} "
            f"as {site['instance']} at {site['file']}:"
            f"{site['line']}:{site['column']} ({state}; "
            f"{connection_label}; not semantically resolved)"
        )

    for reason in view["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(
        "read-only: no file writes, refactors, validation, lab, launcher, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_impact_text(view: dict[str, Any]) -> str:
    lines = [
        f"source: {view['source']}",
        f"target: {view['target']}",
        f"refactor impact: {view['impact_state']}",
        f"preflight: {view['preflight']['status']}",
        "writes files: no",
    ]
    module = view["module"]
    if module is not None:
        lines.append(
            f"declaration: {module['file']}:{module['start_line']}:"
            f"{module['start_column']}"
        )

    dependencies = ", ".join(view["direct_dependencies"]) or "none"
    dependents = ", ".join(view["direct_dependents"]) or "none"
    unresolved = ", ".join(view["unresolved_dependencies"]) or "none"
    lines.append(f"dependencies: {dependencies}")
    lines.append(f"dependents: {dependents}")
    lines.append(f"unresolved dependencies: {unresolved}")

    if view["dependent_edges"]:
        lines.append("dependent references:")
        for edge in view["dependent_edges"]:
            state = "resolved" if edge["resolved"] else "unresolved"
            lines.append(
                f"  {edge['parent']} instantiates {edge['child']} "
                f"as {edge['instance']} at {edge['file']}:"
                f"{edge['line']}:{edge['column']} ({state})"
            )
    if view["dependency_edges"]:
        lines.append("dependency references:")
        for edge in view["dependency_edges"]:
            state = "resolved" if edge["resolved"] else "unresolved"
            lines.append(
                f"  {edge['parent']} instantiates {edge['child']} "
                f"as {edge['instance']} at {edge['file']}:"
                f"{edge['line']}:{edge['column']} ({state})"
            )
    for reason in view["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(
        "read-only: no file writes, refactors, validation, lab, launcher, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_module_context_text(bundle: dict[str, Any]) -> str:
    lines = [
        f"source: {bundle['source']}",
        f"target: {bundle['target']}",
        f"module context: {bundle['context_state']}",
        f"preflight: {bundle['preflight']['status']}",
        "writes files: no",
    ]

    module = bundle["module"]
    if module is not None:
        lines.append(
            f"declaration: {module['file']}:{module['start_line']}:"
            f"{module['start_column']}"
        )

    summary = bundle["summary_context"]
    if summary is None:
        lines.append("summary: unavailable")
    else:
        readiness = summary["readiness"]["state"]
        lines.append(
            f"summary: {summary['port_count']} port"
            f"{'s' if summary['port_count'] != 1 else ''}; {readiness}"
        )

    dependency = bundle["dependency_context"]
    dependencies = ", ".join(dependency["direct_dependencies"]) or "none"
    dependents = ", ".join(dependency["direct_dependents"]) or "none"
    unresolved = ", ".join(dependency["unresolved_dependencies"]) or "none"
    lines.append(f"dependencies: {dependencies}")
    lines.append(f"dependents: {dependents}")
    lines.append(f"unresolved dependencies: {unresolved}")

    port_context = bundle["port_context"]
    lines.append(
        f"port usage: {port_context['usage_site_count']} site"
        f"{'s' if port_context['usage_site_count'] != 1 else ''}"
    )
    lines.append(
        f"review targets: {bundle['refactor_context']['review_target_count']}"
    )

    for reason in bundle["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(
        "read-only: no file writes, refactors, validation, lab, launcher, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"

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

MODULE_BOUNDARY_AUDIT_LIMITATIONS: tuple[str, ...] = (
    "scanner-based module boundary audit data only",
    "uses declaration spans and endmodule matching from the organization scanner",
    "does not semantically elaborate modules or resolve generate blocks",
    "does not apply refactors, write files, generate patches, or run validation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

REFACTOR_CANDIDATE_LIST_LIMITATIONS: tuple[str, ...] = (
    "scanner-based refactor candidate metadata only",
    "lists scanner-detected modules and proposal-only helper actions for editor menus",
    "does not include command argv; use refactor-plan for reviewed proposal metadata",
    "does not apply refactors, write files, move files, generate patches, or run validation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

REFACTOR_READINESS_LIMITATIONS: tuple[str, ...] = (
    "scanner-based refactor readiness summary only",
    "combines module boundary audit and refactor candidate counts for editor status panes",
    "does not include command argv or select a refactor action",
    "does not apply refactors, write files, move files, generate patches, or run validation",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
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

VALIDATION_PLAN_LIMITATIONS: tuple[str, ...] = (
    "proposal-only validation planning metadata",
    "scanner-based module and refactor preflight data only",
    "emits command descriptors as fixed argument arrays for later review",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, or generate patches",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

REVIEW_PACKET_LIMITATIONS: tuple[str, ...] = (
    "proposal-only refactor review packet metadata",
    "summary-only bundle over existing scanner-based views",
    "does not include command argv; use validation-plan for command descriptors",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, or generate patches",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

APPROVAL_DECISION_LIMITATIONS: tuple[str, ...] = (
    "proposal-only refactor approval decision metadata",
    "records an unapproved decision gate over the review packet",
    "does not include command argv; use validation-plan for command descriptors",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, or generate patches",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

APPLICATION_REQUEST_LIMITATIONS: tuple[str, ...] = (
    "proposal-only refactor application request metadata",
    "records a not-accepted application gate over the approval decision",
    "does not include command argv; use validation-plan for command descriptors",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, or generate patches",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

APPLICATION_RESULT_LIMITATIONS: tuple[str, ...] = (
    "proposal-only refactor application result metadata",
    "records a not-applied result receipt over the application request",
    "does not include command argv; use validation-plan for command descriptors",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, generate patches, "
    "or roll back files",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

HANDOFF_SUMMARY_LIMITATIONS: tuple[str, ...] = (
    "summary-only refactor handoff metadata",
    "summarizes a not-applied application result for editor review and maintainer handoff",
    "does not include command argv; use validation-plan for command descriptors",
    "does not publish public text, create pull requests, write comments, or mutate projects",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, generate patches, "
    "or roll back files",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

CHECKLIST_SUMMARY_LIMITATIONS: tuple[str, ...] = (
    "summary-only refactor checklist metadata",
    "summarizes the existing refactor handoff for maintainer review",
    "does not include command argv; use validation-plan for command descriptors",
    "does not record approval, accept application requests, or apply refactors",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, generate patches, "
    "or roll back files",
    "does not publish public text, create pull requests, write comments, "
    "or mutate projects",
    "no pccx-lab, launcher, vendor tool, provider, or hardware invocation",
    "pre-stable JSON shape",
)

REFACTOR_SESSION_LIMITATIONS: tuple[str, ...] = (
    "summary-only refactor session status metadata",
    "summarizes the existing refactor checklist for editor status panes",
    "does not include command argv; use validation-plan for command descriptors",
    "does not persist session state, write status files, or dispatch notifications",
    "does not record approval, accept application requests, or apply refactors",
    "does not execute validation commands or shell commands",
    "does not apply refactors, write files, move files, generate patches, "
    "or roll back files",
    "does not publish public text, create pull requests, write comments, "
    "or mutate projects",
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


def _module_boundary_audit_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "boundary_audit_only": True,
        "writes_files": False,
        "applies_refactor": False,
        "moves_files": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _refactor_candidate_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "candidate_metadata_only": True,
        "action_enablement_only": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _refactor_readiness_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "readiness_summary_only": True,
        "combines_boundary_audit": True,
        "combines_candidate_list": True,
        "selects_refactor_action": False,
        "captures_requested_inputs": False,
        "proposal_created": False,
        "approval_granted": False,
        "request_accepted": False,
        "write_attempted": False,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
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


def _validation_plan_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "emits_command_descriptors": True,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _review_packet_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _approval_decision_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "decision_metadata_only": True,
        "approval_granted": False,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _application_request_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "application_metadata_only": True,
        "approval_granted": False,
        "request_accepted": False,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _application_result_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "application_result_metadata_only": True,
        "approval_granted": False,
        "request_accepted": False,
        "write_attempted": False,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "rollback_required": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _handoff_summary_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "handoff_summary_only": True,
        "approval_granted": False,
        "request_accepted": False,
        "write_attempted": False,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "rollback_required": False,
        "public_text_published": False,
        "pull_request_created": False,
        "comment_written": False,
        "project_mutation": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _checklist_summary_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "checklist_summary_only": True,
        "approval_granted": False,
        "request_accepted": False,
        "write_attempted": False,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "rollback_required": False,
        "public_text_published": False,
        "pull_request_created": False,
        "comment_written": False,
        "project_mutation": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
        "provider_calls": False,
        "hardware_access": False,
        "telemetry": False,
        "automatic_repository_action": False,
    }


def _refactor_session_safety_flags() -> dict[str, bool]:
    return {
        "read_only": True,
        "session_status_only": True,
        "checklist_summary_only": True,
        "approval_granted": False,
        "request_accepted": False,
        "write_attempted": False,
        "session_persistence": False,
        "status_writeback": False,
        "notification_dispatched": False,
        "summarizes_command_descriptors": True,
        "emits_command_descriptors": False,
        "writes_files": False,
        "moves_files": False,
        "applies_refactor": False,
        "applies_patch": False,
        "generates_patch": False,
        "runs_validation": False,
        "runs_shell": False,
        "rollback_required": False,
        "public_text_published": False,
        "pull_request_created": False,
        "comment_written": False,
        "project_mutation": False,
        "invokes_pccx_lab": False,
        "invokes_launcher": False,
        "invokes_vendor_tools": False,
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


def _boundary_audit_rows(
    modules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for module in modules:
        reasons = []
        if not module["complete"]:
            reasons.append(f"missing endmodule for module: {module['name']}")
        rows.append({
            "boundary_state": "complete" if module["complete"] else "incomplete",
            "complete": module["complete"],
            "end_column": module["end_column"],
            "end_line": module["end_line"],
            "file": module["file"],
            "name": module["name"],
            "reasons": reasons,
            "refactor_preflight_state": (
                "ready-for-review" if module["complete"] else "blocked"
            ),
            "span_lines": module["span_lines"],
            "start_column": module["start_column"],
            "start_line": module["start_line"],
        })
    return rows


def build_module_boundary_audit(source: str, path: Path) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    rows = _boundary_audit_rows(organization["modules"])
    incomplete_rows = [
        row
        for row in rows
        if not row["complete"]
    ]
    blocked_reasons = [
        reason
        for row in incomplete_rows
        for reason in row["reasons"]
    ]
    if not rows:
        blocked_reasons.append("no module declarations detected")

    return {
        "audit_state": "available_as_data",
        "blocked_reasons": blocked_reasons,
        "boundary_state_counts": {
            "complete": len(rows) - len(incomplete_rows),
            "incomplete": len(incomplete_rows),
        },
        "complete_module_count": len(rows) - len(incomplete_rows),
        "hierarchy_edge_count": len(organization["hierarchy"]["edges"]),
        "incomplete_module_count": len(incomplete_rows),
        "incomplete_modules": [
            {
                "file": row["file"],
                "name": row["name"],
                "reasons": list(row["reasons"]),
                "start_line": row["start_line"],
            }
            for row in incomplete_rows
        ],
        "kind": "module-boundary-audit",
        "limitations": list(MODULE_BOUNDARY_AUDIT_LIMITATIONS),
        "module_count": len(rows),
        "modules": rows,
        "refactor_readiness": (
            "ready-for-review"
            if rows and not incomplete_rows
            else "blocked"
        ),
        "safety": _module_boundary_audit_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "tool": "pccx-ide-cli",
        "unresolved_dependency_count": len(organization["hierarchy"]["unresolved"]),
        "writes_files": False,
    }


def _candidate_module_summary(module: dict[str, Any]) -> dict[str, Any]:
    return {
        "complete": module["complete"],
        "end_column": module["end_column"],
        "end_line": module["end_line"],
        "file": module["file"],
        "name": module["name"],
        "span_lines": module["span_lines"],
        "start_column": module["start_column"],
        "start_line": module["start_line"],
    }


def _candidate_action_required_inputs(action: str) -> list[str]:
    return list(_REFACTOR_REQUIRED_FIELDS[action])


def _candidate_action_optional_inputs(action: str) -> list[str]:
    if action == "extract-port":
        return ["width"]
    return []


def _candidate_action_descriptor(
    action: str,
    state: str,
    reasons: list[str],
) -> dict[str, Any]:
    return {
        "action": action,
        "applies_refactor": False,
        "optional_inputs": _candidate_action_optional_inputs(action),
        "proposal_command": "refactor-plan",
        "proposal_only": True,
        "required_inputs": _candidate_action_required_inputs(action),
        "requires_explicit_approval_before_write": True,
        "state": state,
        "blocked_reasons": list(reasons),
        "writes_files": False,
    }


def _candidate_blocked_reasons(
    module: dict[str, Any],
    name_counts: dict[str, int],
) -> list[str]:
    reasons: list[str] = []
    if not module["complete"]:
        reasons.append(f"module boundary is incomplete: {module['name']}")
    if name_counts.get(module["name"], 0) > 1:
        reasons.append(f"ambiguous module name: {module['name']}")
    return reasons


def _refactor_candidate_rows(
    modules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    name_counts: dict[str, int] = {}
    for module in modules:
        name_counts[module["name"]] = name_counts.get(module["name"], 0) + 1

    rows: list[dict[str, Any]] = []
    for module in modules:
        reasons = _candidate_blocked_reasons(module, name_counts)
        state = "blocked" if reasons else "ready-for-request"
        rows.append({
            "actions": [
                _candidate_action_descriptor(action, state, reasons)
                for action in REFACTOR_ACTIONS
            ],
            "blocked_reasons": reasons,
            "candidate_state": state,
            "module": _candidate_module_summary(module),
        })
    return rows


def build_refactor_candidate_list(source: str, path: Path) -> dict[str, Any]:
    organization = build_module_organization_export(source, path)
    modules = organization["modules"]
    candidates = _refactor_candidate_rows(modules)
    ready_candidates = [
        candidate
        for candidate in candidates
        if candidate["candidate_state"] == "ready-for-request"
    ]
    blocked_candidates = [
        candidate
        for candidate in candidates
        if candidate["candidate_state"] == "blocked"
    ]
    blocked_reasons = [
        reason
        for candidate in blocked_candidates
        for reason in candidate["blocked_reasons"]
    ]
    blocked_reasons = list(dict.fromkeys(blocked_reasons))
    if not candidates:
        blocked_reasons.append("no module declarations detected")

    return {
        "action_count": len(REFACTOR_ACTIONS),
        "actions": [
            {
                "action": action,
                "optional_inputs": _candidate_action_optional_inputs(action),
                "proposal_command": "refactor-plan",
                "proposal_only": True,
                "required_inputs": _candidate_action_required_inputs(action),
                "requires_explicit_approval_before_write": True,
                "writes_files": False,
            }
            for action in REFACTOR_ACTIONS
        ],
        "blocked_module_count": len(blocked_candidates),
        "blocked_reasons": blocked_reasons,
        "candidate_count": len(candidates),
        "candidate_state": (
            "available_as_data"
            if candidates
            else "blocked"
        ),
        "candidates": candidates,
        "kind": "module-refactor-candidate-list",
        "limitations": list(REFACTOR_CANDIDATE_LIST_LIMITATIONS),
        "module_count": len(modules),
        "ready_module_count": len(ready_candidates),
        "safety": _refactor_candidate_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def _readiness_status_cards(
    audit: dict[str, Any],
    candidates: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        {
            "card_id": "boundary-audit",
            "kind": audit["kind"],
            "status": audit["refactor_readiness"],
            "complete_module_count": audit["complete_module_count"],
            "incomplete_module_count": audit["incomplete_module_count"],
            "required": True,
        },
        {
            "card_id": "candidate-list",
            "kind": candidates["kind"],
            "status": candidates["candidate_state"],
            "ready_module_count": candidates["ready_module_count"],
            "blocked_module_count": candidates["blocked_module_count"],
            "required": True,
        },
    ]


def _refactor_readiness_next_action(
    audit: dict[str, Any],
    candidates: dict[str, Any],
) -> str:
    if candidates["candidate_count"] == 0:
        return "add module declarations before refactor readiness review"
    if audit["incomplete_module_count"] > 0 or candidates["blocked_module_count"] > 0:
        return "resolve scanner boundary blockers before requesting refactor plans"
    return "choose a proposal-only refactor action and create a reviewed refactor-plan"


def build_refactor_readiness_summary(source: str, path: Path) -> dict[str, Any]:
    audit = build_module_boundary_audit(source, path)
    candidates = build_refactor_candidate_list(source, path)
    blocked_reasons = list(dict.fromkeys([
        *audit["blocked_reasons"],
        *candidates["blocked_reasons"],
    ]))
    ready = (
        candidates["candidate_count"] > 0
        and audit["incomplete_module_count"] == 0
        and candidates["blocked_module_count"] == 0
    )

    return {
        "blocked_reasons": blocked_reasons,
        "candidate_count": candidates["candidate_count"],
        "complete_module_count": audit["complete_module_count"],
        "hierarchy_edge_count": audit["hierarchy_edge_count"],
        "incomplete_module_count": audit["incomplete_module_count"],
        "kind": "module-refactor-readiness-summary",
        "limitations": list(REFACTOR_READINESS_LIMITATIONS),
        "module_count": audit["module_count"],
        "next_required_action": _refactor_readiness_next_action(audit, candidates),
        "ready_for_request": ready,
        "ready_module_count": candidates["ready_module_count"],
        "blocked_module_count": candidates["blocked_module_count"],
        "readiness_state": "ready-for-request" if ready else "blocked",
        "safety": _refactor_readiness_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "status_cards": _readiness_status_cards(audit, candidates),
        "tool": "pccx-ide-cli",
        "unresolved_dependency_count": audit["unresolved_dependency_count"],
        "writes_files": False,
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


def _json_cli_argv(command: str, path: Path, *args: str) -> list[str]:
    return [
        "python",
        "-m",
        "pccx_ide_cli",
        command,
        str(path),
        *args,
        "--format",
        "json",
    ]


def _refactor_plan_argv(path: Path, requested: dict[str, Any]) -> list[str]:
    args = [
        "--action",
        requested["action"],
        "--module",
        requested["module"],
    ]
    for field, option in (
        ("new_name", "--new-name"),
        ("port_name", "--port-name"),
        ("direction", "--direction"),
        ("width", "--width"),
        ("destination", "--destination"),
    ):
        if requested[field]:
            args.extend([option, str(requested[field])])
    return _json_cli_argv("refactor-plan", path, *args)


def _validation_command_descriptor(
    command_id: str,
    phase: str,
    purpose: str,
    argv: list[str],
) -> dict[str, Any]:
    return {
        "approval_required": True,
        "argv": argv,
        "fixed_argv": True,
        "id": command_id,
        "phase": phase,
        "purpose": purpose,
        "runner": "user-approved",
        "shell": False,
        "state": "proposed-not-run",
    }


def _pre_change_validation_commands(
    path: Path,
    requested: dict[str, Any],
) -> list[dict[str, Any]]:
    module_name = requested["module"]
    return [
        _validation_command_descriptor(
            "module-context",
            "pre-change-review",
            "Refresh target module context before reviewing any edit.",
            _json_cli_argv("module-context", path, "--module", module_name),
        ),
        _validation_command_descriptor(
            "refactor-impact",
            "pre-change-review",
            "Refresh declaration and reference review targets for the proposal.",
            _json_cli_argv("refactor-impact", path, "--module", module_name),
        ),
        _validation_command_descriptor(
            "refactor-plan",
            "pre-change-review",
            "Refresh the proposal-only refactor plan with the requested inputs.",
            _refactor_plan_argv(path, requested),
        ),
    ]


def _post_change_validation_commands(
    path: Path,
    requested: dict[str, Any],
) -> list[dict[str, Any]]:
    module_name = requested["module"]
    commands = [
        _validation_command_descriptor(
            "organization",
            "post-change-local-validation",
            "Rebuild scanner-based module boundaries and hierarchy after edits.",
            _json_cli_argv("organization", path),
        ),
        _validation_command_descriptor(
            "module-summary",
            "post-change-local-validation",
            "Rebuild conservative module header and port summaries after edits.",
            _json_cli_argv("module-summary", path),
        ),
        _validation_command_descriptor(
            "dependencies",
            "post-change-local-validation",
            "Rebuild direct dependency summaries after edits.",
            _json_cli_argv("dependencies", path),
        ),
    ]
    if path.is_file():
        commands.append(
            _validation_command_descriptor(
                "check",
                "post-change-local-validation",
                "Run the built-in local diagnostics check after edits.",
                _json_cli_argv("check", path),
            )
        )

    action = requested["action"]
    if action == "rename-module" and requested["new_name"]:
        commands.append(
            _validation_command_descriptor(
                "locate-new-module",
                "post-change-local-validation",
                "Confirm the renamed module declaration can be located after edits.",
                _json_cli_argv(
                    "locate",
                    path,
                    str(requested["new_name"]),
                    "--kind",
                    "module",
                ),
            )
        )
    elif action == "extract-port":
        commands.append(
            _validation_command_descriptor(
                "port-usage",
                "post-change-local-validation",
                "Review target port declarations and dependent usage sites after edits.",
                _json_cli_argv("port-usage", path, "--module", module_name),
            )
        )
    elif action == "move-module" and requested["destination"]:
        destination = Path(str(requested["destination"]))
        commands.extend(
            [
                _validation_command_descriptor(
                    "organization-destination",
                    "post-change-local-validation",
                    "Review scanner data for the planned destination file after the move.",
                    _json_cli_argv("organization", destination),
                ),
                _validation_command_descriptor(
                    "check-destination",
                    "post-change-local-validation",
                    "Run the built-in local diagnostics check on the destination file after the move.",
                    _json_cli_argv("check", destination),
                ),
            ]
        )
    return commands


def _validation_groups(
    path: Path,
    requested: dict[str, Any],
    preflight: dict[str, Any],
) -> list[dict[str, Any]]:
    pre_change = _pre_change_validation_commands(path, requested)
    post_change = (
        []
        if preflight["status"] == "blocked"
        else _post_change_validation_commands(path, requested)
    )
    return [
        {
            "blocked_by": [],
            "command_count": len(pre_change),
            "commands": pre_change,
            "phase": "pre-change-review",
            "status": "proposal-only",
        },
        {
            "blocked_by": list(preflight["reasons"]),
            "command_count": len(post_change),
            "commands": post_change,
            "phase": "post-change-local-validation",
            "status": (
                "blocked"
                if preflight["status"] == "blocked"
                else "proposal-only"
            ),
        },
    ]


def build_refactor_validation_plan(
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
    proposal = build_refactor_proposal(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    impact = build_refactor_impact_view(source, path, module_name)
    preflight = proposal["preflight"]
    requested = proposal["requested_change"]
    groups = _validation_groups(path, requested, preflight)

    return {
        "action": action,
        "approval": {
            "approved_runner_required": True,
            "requires_explicit_user_approval_before_run": True,
            "requires_explicit_user_approval_before_write": True,
        },
        "command_descriptor_count": sum(
            group["command_count"]
            for group in groups
        ),
        "kind": "module-refactor-validation-plan",
        "limitations": list(VALIDATION_PLAN_LIMITATIONS),
        "module": proposal["module"],
        "preflight": {
            "reasons": list(preflight["reasons"]),
            "requires_approval_before_write": preflight[
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight["status"],
        },
        "refactor_proposal": {
            "kind": proposal["kind"],
            "planned_step_count": len(proposal["planned_steps"]),
            "proposal_state": proposal["proposal_state"],
            "requested_change": requested,
            "writes_files": proposal["writes_files"],
        },
        "review_context": {
            "direct_dependency_count": impact["direct_dependency_count"],
            "direct_dependent_count": impact["direct_dependent_count"],
            "review_target_count": len(impact["review_targets"]),
            "unresolved_dependency_count": impact["unresolved_dependency_count"],
        },
        "safety": _validation_plan_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "validation_groups": groups,
        "validation_state": (
            "blocked"
            if preflight["status"] == "blocked"
            else "proposal-only"
        ),
        "writes_files": False,
    }


def _review_context_summary(context: dict[str, Any]) -> dict[str, Any]:
    dependency = context["dependency_context"]
    port = context["port_context"]
    refactor = context["refactor_context"]
    summary = context["summary_context"]
    return {
        "context_state": context["context_state"],
        "direct_dependency_count": dependency["direct_dependency_count"],
        "direct_dependent_count": dependency["direct_dependent_count"],
        "port_count": port["port_count"],
        "review_target_count": refactor["review_target_count"],
        "summary_available": summary is not None,
        "summary_readiness": (
            summary["readiness"]["state"]
            if summary is not None
            else "unavailable"
        ),
        "unresolved_dependency_count": dependency["unresolved_dependency_count"],
        "usage_site_count": port["usage_site_count"],
    }


def _review_validation_summary(validation: dict[str, Any]) -> dict[str, Any]:
    phases = []
    for group in validation["validation_groups"]:
        phases.append({
            "blocked_by": list(group["blocked_by"]),
            "command_ids": [
                command["id"]
                for command in group["commands"]
            ],
            "phase": group["phase"],
            "status": group["status"],
        })
    return {
        "command_descriptor_count": validation["command_descriptor_count"],
        "phases": phases,
        "validation_state": validation["validation_state"],
    }


def build_refactor_review_packet(
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
    proposal = build_refactor_proposal(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    context = build_module_context_bundle(source, path, module_name)
    validation = build_refactor_validation_plan(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    preflight = proposal["preflight"]

    return {
        "action": action,
        "approval": {
            "requires_explicit_user_approval_before_run": True,
            "requires_explicit_user_approval_before_write": True,
        },
        "context_summary": _review_context_summary(context),
        "kind": "module-refactor-review-packet",
        "limitations": list(REVIEW_PACKET_LIMITATIONS),
        "module": proposal["module"],
        "packet_state": "proposal-only",
        "preflight": {
            "reasons": list(preflight["reasons"]),
            "requires_approval_before_write": preflight[
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight["status"],
        },
        "proposal_summary": {
            "planned_step_count": len(proposal["planned_steps"]),
            "planned_steps": proposal["planned_steps"],
            "requested_change": proposal["requested_change"],
            "writes_files": proposal["writes_files"],
        },
        "review_state": (
            "blocked"
            if preflight["status"] == "blocked"
            else "ready-for-review"
        ),
        "safety": _review_packet_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "validation_summary": _review_validation_summary(validation),
        "writes_files": False,
    }


def _approval_packet_summary(packet: dict[str, Any]) -> dict[str, Any]:
    context = packet["context_summary"]
    validation = packet["validation_summary"]
    phases = []
    for phase in validation["phases"]:
        phases.append({
            "command_ids": list(phase["command_ids"]),
            "phase": phase["phase"],
            "status": phase["status"],
        })
    return {
        "command_descriptor_count": validation["command_descriptor_count"],
        "context_state": context["context_state"],
        "kind": packet["kind"],
        "packet_state": packet["packet_state"],
        "review_state": packet["review_state"],
        "review_target_count": context["review_target_count"],
        "validation_phases": phases,
        "validation_state": validation["validation_state"],
    }


def build_refactor_approval_decision(
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
    packet = build_refactor_review_packet(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    preflight = packet["preflight"]
    decision_state = (
        "blocked"
        if preflight["status"] == "blocked"
        else "not-approved"
    )
    reason = (
        "preflight blocked"
        if preflight["status"] == "blocked"
        else "explicit approval not recorded"
    )

    return {
        "action": action,
        "approval_decision": {
            "approved": False,
            "approver": "not-recorded",
            "decision": decision_state,
            "reason": reason,
            "requires_explicit_user_approval_before_run": True,
            "requires_explicit_user_approval_before_write": True,
        },
        "decision_state": decision_state,
        "kind": "module-refactor-approval-decision",
        "limitations": list(APPROVAL_DECISION_LIMITATIONS),
        "module": packet["module"],
        "packet_summary": _approval_packet_summary(packet),
        "preflight": {
            "reasons": list(preflight["reasons"]),
            "requires_approval_before_write": preflight[
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight["status"],
        },
        "proposal_summary": {
            "planned_step_count": packet["proposal_summary"]["planned_step_count"],
            "requested_change": packet["proposal_summary"]["requested_change"],
            "writes_files": packet["proposal_summary"]["writes_files"],
        },
        "safety": _approval_decision_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def _application_approval_summary(decision: dict[str, Any]) -> dict[str, Any]:
    packet = decision["packet_summary"]
    phases = []
    for phase in packet["validation_phases"]:
        phases.append({
            "command_ids": list(phase["command_ids"]),
            "phase": phase["phase"],
            "status": phase["status"],
        })
    return {
        "approved": decision["approval_decision"]["approved"],
        "command_descriptor_count": packet["command_descriptor_count"],
        "decision_state": decision["decision_state"],
        "kind": decision["kind"],
        "reason": decision["approval_decision"]["reason"],
        "review_state": packet["review_state"],
        "validation_phases": phases,
        "validation_state": packet["validation_state"],
    }


def build_refactor_application_request(
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
    decision = build_refactor_approval_decision(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    preflight = decision["preflight"]
    approval = decision["approval_decision"]
    application_state = (
        "blocked"
        if preflight["status"] == "blocked"
        else "not-accepted"
    )
    reason = (
        "preflight blocked"
        if preflight["status"] == "blocked"
        else "approval not granted"
    )

    return {
        "action": action,
        "application_request": {
            "accepted": False,
            "applied": False,
            "decision": application_state,
            "reason": reason,
            "required_approval_decision": approval["decision"],
            "requires_explicit_user_approval_before_run": True,
            "requires_explicit_user_approval_before_write": True,
            "result": "not_applied",
        },
        "application_state": application_state,
        "approval_summary": _application_approval_summary(decision),
        "kind": "module-refactor-application-request",
        "limitations": list(APPLICATION_REQUEST_LIMITATIONS),
        "module": decision["module"],
        "preflight": {
            "reasons": list(preflight["reasons"]),
            "requires_approval_before_write": preflight[
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight["status"],
        },
        "proposal_summary": {
            "planned_step_count": decision["proposal_summary"]["planned_step_count"],
            "requested_change": decision["proposal_summary"]["requested_change"],
            "writes_files": decision["proposal_summary"]["writes_files"],
        },
        "safety": _application_request_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def _result_application_summary(request: dict[str, Any]) -> dict[str, Any]:
    approval = request["approval_summary"]
    phases = []
    for phase in approval["validation_phases"]:
        phases.append({
            "command_ids": list(phase["command_ids"]),
            "phase": phase["phase"],
            "status": phase["status"],
        })
    return {
        "accepted": request["application_request"]["accepted"],
        "application_state": request["application_state"],
        "applied": request["application_request"]["applied"],
        "approval_decision_state": approval["decision_state"],
        "approval_granted": approval["approved"],
        "command_descriptor_count": approval["command_descriptor_count"],
        "decision": request["application_request"]["decision"],
        "kind": request["kind"],
        "reason": request["application_request"]["reason"],
        "required_approval_decision": request["application_request"][
            "required_approval_decision"
        ],
        "review_state": approval["review_state"],
        "validation_phases": phases,
        "validation_state": approval["validation_state"],
    }


def build_refactor_application_result(
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
    request = build_refactor_application_request(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    preflight = request["preflight"]
    result_state = (
        "blocked"
        if preflight["status"] == "blocked"
        else "not-applied"
    )
    reason = (
        "preflight blocked"
        if preflight["status"] == "blocked"
        else "application request not accepted"
    )

    return {
        "action": action,
        "application_result": {
            "applied": False,
            "file_change_count": 0,
            "files_changed": [],
            "patch_generated": False,
            "reason": reason,
            "result": "not_applied",
            "result_state": result_state,
            "rollback_performed": False,
            "rollback_required": False,
            "source_application_state": request["application_state"],
            "validation_result": "not_run",
            "validation_run": False,
            "write_attempted": False,
        },
        "application_summary": _result_application_summary(request),
        "kind": "module-refactor-application-result",
        "limitations": list(APPLICATION_RESULT_LIMITATIONS),
        "module": request["module"],
        "preflight": {
            "reasons": list(preflight["reasons"]),
            "requires_approval_before_write": preflight[
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight["status"],
        },
        "proposal_summary": {
            "planned_step_count": request["proposal_summary"][
                "planned_step_count"
            ],
            "requested_change": request["proposal_summary"]["requested_change"],
            "writes_files": request["proposal_summary"]["writes_files"],
        },
        "result_state": result_state,
        "safety": _application_result_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def _handoff_application_result_summary(
    result: dict[str, Any],
) -> dict[str, Any]:
    application = result["application_summary"]
    phases = []
    for phase in application["validation_phases"]:
        phases.append({
            "command_ids": list(phase["command_ids"]),
            "phase": phase["phase"],
            "status": phase["status"],
        })
    return {
        "application_result": result["application_result"]["result"],
        "approval_decision_state": application["approval_decision_state"],
        "command_descriptor_count": application["command_descriptor_count"],
        "file_change_count": result["application_result"]["file_change_count"],
        "kind": result["kind"],
        "patch_generated": result["application_result"]["patch_generated"],
        "result_state": result["result_state"],
        "review_state": application["review_state"],
        "rollback_required": result["application_result"]["rollback_required"],
        "validation_phases": phases,
        "validation_result": result["application_result"]["validation_result"],
        "validation_run": result["application_result"]["validation_run"],
        "validation_state": application["validation_state"],
        "write_attempted": result["application_result"]["write_attempted"],
    }


def build_refactor_handoff_summary(
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
    result = build_refactor_application_result(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    preflight = result["preflight"]
    handoff_state = (
        "blocked"
        if preflight["status"] == "blocked"
        else "ready-for-review"
    )
    recommended_next_step = (
        "resolve refactor preflight blockers before handoff"
        if handoff_state == "blocked"
        else "review validation plan before any approval or application"
    )

    return {
        "action": action,
        "application_result_summary": _handoff_application_result_summary(
            result
        ),
        "blocked_actions": [
            "file-write",
            "patch-generation",
            "refactor-application",
            "validation-run",
            "shell-command",
            "pull-request-create",
            "comment-write",
            "project-mutation",
            "pccx-lab-invocation",
            "launcher-invocation",
            "vendor-tool-invocation",
            "provider-call",
            "hardware-access",
        ],
        "handoff_state": handoff_state,
        "handoff_summary": {
            "comment_ready": False,
            "files_changed": 0,
            "patch_generated": False,
            "public_text_ready": False,
            "pull_request_ready": False,
            "ready_for_maintainer_review": preflight["status"] != "blocked",
            "recommended_next_step": recommended_next_step,
            "result": result["application_result"]["result"],
            "result_state": result["result_state"],
            "rollback_required": False,
            "state": handoff_state,
            "validation_run": False,
            "write_attempted": False,
        },
        "kind": "module-refactor-handoff-summary",
        "limitations": list(HANDOFF_SUMMARY_LIMITATIONS),
        "module": result["module"],
        "preflight": {
            "reasons": list(preflight["reasons"]),
            "requires_approval_before_write": preflight[
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight["status"],
        },
        "proposal_summary": {
            "planned_step_count": result["proposal_summary"][
                "planned_step_count"
            ],
            "requested_change": result["proposal_summary"]["requested_change"],
            "writes_files": result["proposal_summary"]["writes_files"],
        },
        "review_notes": [
            {
                "note_id": "approval-not-granted",
                "state": result["application_summary"][
                    "approval_decision_state"
                ],
                "summary": (
                    "No approval has been granted for the requested refactor."
                ),
            },
            {
                "note_id": "no-write-attempt",
                "state": "not_applied",
                "summary": (
                    "No write attempt, patch generation, validation run, "
                    "or rollback occurred."
                ),
            },
        ],
        "safety": _handoff_summary_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def _checklist_items(handoff: dict[str, Any]) -> list[dict[str, Any]]:
    preflight = handoff["preflight"]
    result = handoff["application_result_summary"]
    handoff_summary = handoff["handoff_summary"]
    preflight_ready = preflight["status"] != "blocked"

    return [
        {
            "complete": preflight_ready,
            "item_id": "preflight",
            "required": True,
            "status": preflight["status"],
            "summary": (
                "Refactor preflight metadata is ready for review."
                if preflight_ready
                else "Resolve refactor preflight blockers before review."
            ),
        },
        {
            "complete": False,
            "item_id": "context-review",
            "required": True,
            "status": (
                "pending-maintainer-review"
                if preflight_ready
                else "blocked-by-preflight"
            ),
            "summary": (
                "Review module context, dependency impact, port usage, "
                "and target references before any approval."
            ),
        },
        {
            "command_descriptor_count": result["command_descriptor_count"],
            "complete": False,
            "item_id": "validation-plan-review",
            "required": True,
            "status": (
                "pending-maintainer-review"
                if preflight_ready
                else "blocked-by-preflight"
            ),
            "summary": (
                "Review validation descriptor IDs before any explicit "
                "validation run."
            ),
        },
        {
            "complete": False,
            "item_id": "approval-gate",
            "required": True,
            "status": result["approval_decision_state"],
            "summary": "Explicit approval has not been recorded.",
        },
        {
            "complete": False,
            "item_id": "application-gate",
            "required": True,
            "status": result["application_result"],
            "summary": (
                "Application remains not applied; no write attempt, patch, "
                "validation run, or rollback occurred."
            ),
            "write_attempted": result["write_attempted"],
        },
        {
            "complete": False,
            "item_id": "handoff-review",
            "required": True,
            "status": handoff["handoff_state"],
            "summary": handoff_summary["recommended_next_step"],
        },
    ]


def build_refactor_checklist_summary(
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
    handoff = build_refactor_handoff_summary(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    handoff_summary = handoff["handoff_summary"]
    result = handoff["application_result_summary"]

    return {
        "action": action,
        "blocked_actions": [
            *handoff["blocked_actions"],
            "approval-grant",
            "application-accept",
        ],
        "checklist_items": _checklist_items(handoff),
        "checklist_state": handoff["handoff_state"],
        "handoff_summary": {
            "handoff_state": handoff["handoff_state"],
            "kind": handoff["kind"],
            "ready_for_maintainer_review": handoff_summary[
                "ready_for_maintainer_review"
            ],
            "recommended_next_step": handoff_summary["recommended_next_step"],
            "result_state": handoff_summary["result_state"],
        },
        "kind": "module-refactor-checklist-summary",
        "limitations": list(CHECKLIST_SUMMARY_LIMITATIONS),
        "module": handoff["module"],
        "preflight": {
            "reasons": list(handoff["preflight"]["reasons"]),
            "requires_approval_before_write": handoff["preflight"][
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": handoff["preflight"]["status"],
        },
        "result_summary": {
            "approval_decision_state": result["approval_decision_state"],
            "application_result": result["application_result"],
            "command_descriptor_count": result["command_descriptor_count"],
            "file_change_count": result["file_change_count"],
            "patch_generated": result["patch_generated"],
            "rollback_required": result["rollback_required"],
            "validation_run": result["validation_run"],
            "write_attempted": result["write_attempted"],
        },
        "safety": _checklist_summary_safety_flags(),
        "scanner": "line-scanner",
        "source": source,
        "target": module_name,
        "tool": "pccx-ide-cli",
        "writes_files": False,
    }


def _refactor_session_items(checklist: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "complete": item["complete"],
            "item_id": item["item_id"],
            "required": item["required"],
            "status": item["status"],
            "summary": item["summary"],
        }
        for item in checklist["checklist_items"]
    ]


def build_refactor_session_status(
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
    checklist = build_refactor_checklist_summary(
        source,
        path,
        action,
        module_name,
        new_name=new_name,
        port_name=port_name,
        direction=direction,
        width=width,
        destination=destination,
    )
    items = _refactor_session_items(checklist)
    required_items = [item for item in items if item["required"]]
    incomplete_required = [
        item for item in required_items if not item["complete"]
    ]
    preflight_status = checklist["preflight"]["status"]
    session_state = checklist["checklist_state"]
    current_stage = (
        "preflight-blocked"
        if session_state == "blocked"
        else "maintainer-review"
    )
    next_required_action = (
        "resolve refactor preflight blockers before session review"
        if session_state == "blocked"
        else "review checklist items before approval or application"
    )

    return {
        "action": action,
        "blocked_actions": [
            *checklist["blocked_actions"],
            "session-persistence",
            "status-writeback",
            "notification-dispatch",
        ],
        "current_stage": current_stage,
        "kind": "module-refactor-session-status",
        "limitations": list(REFACTOR_SESSION_LIMITATIONS),
        "module": checklist["module"],
        "next_required_action": next_required_action,
        "preflight": {
            "reasons": list(checklist["preflight"]["reasons"]),
            "requires_approval_before_write": checklist["preflight"][
                "requires_approval_before_write"
            ],
            "requires_explicit_approval_before_run": True,
            "status": preflight_status,
        },
        "result_summary": dict(checklist["result_summary"]),
        "safety": _refactor_session_safety_flags(),
        "scanner": "line-scanner",
        "session_items": items,
        "session_state": session_state,
        "session_summary": {
            "checklist_kind": checklist["kind"],
            "checklist_state": checklist["checklist_state"],
            "complete_required_count": (
                len(required_items) - len(incomplete_required)
            ),
            "incomplete_required_count": len(incomplete_required),
            "item_count": len(items),
            "ready_for_maintainer_review": checklist["handoff_summary"][
                "ready_for_maintainer_review"
            ],
            "required_item_count": len(required_items),
            "result_state": checklist["handoff_summary"]["result_state"],
        },
        "source": source,
        "target": module_name,
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


def format_refactor_validation_plan_text(plan: dict[str, Any]) -> str:
    lines = [
        f"source: {plan['source']}",
        f"target: {plan['target']}",
        f"action: {plan['action']}",
        f"validation plan: {plan['validation_state']}",
        f"preflight: {plan['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
    ]
    for reason in plan["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    for group in plan["validation_groups"]:
        lines.append(f"{group['phase']}: {group['status']}")
        if not group["commands"]:
            lines.append("  commands: none")
        for command in group["commands"]:
            lines.append(
                f"  {command['id']}: {' '.join(command['argv'])} "
                "(proposed-not-run)"
            )
    lines.append(
        "no validation, shell, refactor, patch, file write, lab, launcher, "
        "vendor tool, provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_review_packet_text(packet: dict[str, Any]) -> str:
    context = packet["context_summary"]
    validation = packet["validation_summary"]
    lines = [
        f"source: {packet['source']}",
        f"target: {packet['target']}",
        f"action: {packet['action']}",
        f"review packet: {packet['packet_state']}",
        f"review state: {packet['review_state']}",
        f"preflight: {packet['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"context: {context['context_state']}",
        f"summary: {context['summary_readiness']}",
        (
            f"dependencies: {context['direct_dependency_count']}; "
            f"dependents: {context['direct_dependent_count']}; "
            f"unresolved: {context['unresolved_dependency_count']}"
        ),
        (
            f"ports: {context['port_count']}; "
            f"usage sites: {context['usage_site_count']}; "
            f"review targets: {context['review_target_count']}"
        ),
        f"validation descriptors: {validation['command_descriptor_count']}",
    ]
    for phase in validation["phases"]:
        command_ids = ", ".join(phase["command_ids"]) or "none"
        lines.append(
            f"validation phase: {phase['phase']} "
            f"({phase['status']}): {command_ids}"
        )
    for step in packet["proposal_summary"]["planned_steps"]:
        lines.append(f"plan: {step}")
    for reason in packet["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(
        "summary-only: no command argv, validation, shell, refactor, patch, "
        "file write, lab, launcher, vendor tool, provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_approval_decision_text(decision: dict[str, Any]) -> str:
    approval = decision["approval_decision"]
    packet = decision["packet_summary"]
    lines = [
        f"source: {decision['source']}",
        f"target: {decision['target']}",
        f"action: {decision['action']}",
        f"approval decision: {approval['decision']}",
        "approved: no",
        f"review state: {packet['review_state']}",
        f"preflight: {decision['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"validation descriptors: {packet['command_descriptor_count']}",
    ]
    for phase in packet["validation_phases"]:
        command_ids = ", ".join(phase["command_ids"]) or "none"
        lines.append(
            f"validation phase: {phase['phase']} "
            f"({phase['status']}): {command_ids}"
        )
    for reason in decision["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"reason: {approval['reason']}")
    lines.append(
        "decision metadata only: no command argv, validation, shell, "
        "refactor, patch, file write, lab, launcher, vendor tool, provider, "
        "or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_application_request_text(request: dict[str, Any]) -> str:
    application = request["application_request"]
    approval = request["approval_summary"]
    lines = [
        f"source: {request['source']}",
        f"target: {request['target']}",
        f"action: {request['action']}",
        f"application request: {application['decision']}",
        "accepted: no",
        "applied: no",
        f"approval decision: {approval['decision_state']}",
        f"review state: {approval['review_state']}",
        f"preflight: {request['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"validation descriptors: {approval['command_descriptor_count']}",
    ]
    for phase in approval["validation_phases"]:
        command_ids = ", ".join(phase["command_ids"]) or "none"
        lines.append(
            f"validation phase: {phase['phase']} "
            f"({phase['status']}): {command_ids}"
        )
    for reason in request["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"reason: {application['reason']}")
    lines.append(
        "application metadata only: no command argv, validation, shell, "
        "refactor, patch, file write, lab, launcher, vendor tool, provider, "
        "or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_application_result_text(result: dict[str, Any]) -> str:
    application_result = result["application_result"]
    application = result["application_summary"]
    lines = [
        f"source: {result['source']}",
        f"target: {result['target']}",
        f"action: {result['action']}",
        f"application result: {application_result['result_state']}",
        f"result: {application_result['result']}",
        f"application request: {application['application_state']}",
        "accepted: no",
        "applied: no",
        "write attempted: no",
        "patch generated: no",
        "files changed: 0",
        "validation run: no",
        "rollback required: no",
        f"approval decision: {application['approval_decision_state']}",
        f"review state: {application['review_state']}",
        f"preflight: {result['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"validation descriptors: {application['command_descriptor_count']}",
    ]
    for phase in application["validation_phases"]:
        command_ids = ", ".join(phase["command_ids"]) or "none"
        lines.append(
            f"validation phase: {phase['phase']} "
            f"({phase['status']}): {command_ids}"
        )
    for reason in result["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"reason: {application_result['reason']}")
    lines.append(
        "result metadata only: no command argv, validation, shell, "
        "refactor, patch, file write, rollback, lab, launcher, vendor tool, "
        "provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_handoff_summary_text(summary: dict[str, Any]) -> str:
    handoff = summary["handoff_summary"]
    result = summary["application_result_summary"]
    lines = [
        f"source: {summary['source']}",
        f"target: {summary['target']}",
        f"action: {summary['action']}",
        f"refactor handoff: {summary['handoff_state']}",
        f"application result: {result['result_state']}",
        f"result: {result['application_result']}",
        "write attempted: no",
        "patch generated: no",
        "files changed: 0",
        "validation run: no",
        "rollback required: no",
        "public text ready: no",
        "pull request ready: no",
        "comment ready: no",
        f"approval decision: {result['approval_decision_state']}",
        f"review state: {result['review_state']}",
        f"preflight: {summary['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"validation descriptors: {result['command_descriptor_count']}",
    ]
    for phase in result["validation_phases"]:
        command_ids = ", ".join(phase["command_ids"]) or "none"
        lines.append(
            f"validation phase: {phase['phase']} "
            f"({phase['status']}): {command_ids}"
        )
    for reason in summary["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"next step: {handoff['recommended_next_step']}")
    lines.append(
        "summary-only handoff: no command argv, public text, pull request, "
        "comment, project mutation, validation, shell, refactor, patch, "
        "file write, rollback, lab, launcher, vendor tool, provider, or "
        "hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_checklist_summary_text(checklist: dict[str, Any]) -> str:
    handoff = checklist["handoff_summary"]
    result = checklist["result_summary"]
    ready = "yes" if handoff["ready_for_maintainer_review"] else "no"
    lines = [
        f"source: {checklist['source']}",
        f"target: {checklist['target']}",
        f"action: {checklist['action']}",
        f"refactor checklist: {checklist['checklist_state']}",
        f"handoff: {handoff['handoff_state']}",
        f"ready for maintainer review: {ready}",
        "write attempted: no",
        "patch generated: no",
        "files changed: 0",
        "validation run: no",
        "rollback required: no",
        f"approval decision: {result['approval_decision_state']}",
        f"application result: {result['application_result']}",
        f"preflight: {checklist['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"validation descriptors: {result['command_descriptor_count']}",
    ]
    for item in checklist["checklist_items"]:
        lines.append(
            f"checklist: {item['item_id']} ({item['status']}): "
            f"{item['summary']}"
        )
    for reason in checklist["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"next step: {handoff['recommended_next_step']}")
    lines.append(
        "summary-only checklist: no command argv, approval grant, "
        "application accept, validation, shell, refactor, patch, file write, "
        "rollback, public text, pull request, comment, project mutation, lab, "
        "launcher, vendor tool, provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_session_status_text(session: dict[str, Any]) -> str:
    summary = session["session_summary"]
    result = session["result_summary"]
    ready = "yes" if summary["ready_for_maintainer_review"] else "no"
    lines = [
        f"source: {session['source']}",
        f"target: {session['target']}",
        f"action: {session['action']}",
        f"refactor session: {session['session_state']}",
        f"current stage: {session['current_stage']}",
        f"checklist: {summary['checklist_state']}",
        f"ready for maintainer review: {ready}",
        f"required complete: {summary['complete_required_count']}/"
        f"{summary['required_item_count']}",
        "write attempted: no",
        "patch generated: no",
        "files changed: 0",
        "validation run: no",
        "rollback required: no",
        f"approval decision: {result['approval_decision_state']}",
        f"application result: {result['application_result']}",
        f"preflight: {session['preflight']['status']}",
        "writes files: no",
        "runs validation: no",
        f"validation descriptors: {result['command_descriptor_count']}",
    ]
    for item in session["session_items"]:
        lines.append(
            f"session item: {item['item_id']} ({item['status']}): "
            f"{item['summary']}"
        )
    for reason in session["preflight"]["reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"next step: {session['next_required_action']}")
    lines.append(
        "summary-only session status: no command argv, approval grant, "
        "application accept, validation, shell, refactor, patch, file write, "
        "rollback, status writeback, notification dispatch, public text, "
        "pull request, comment, project mutation, lab, launcher, vendor tool, "
        "provider, or hardware execution"
    )
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


def format_module_boundary_audit_text(audit: dict[str, Any]) -> str:
    lines = [
        f"source: {audit['source']}",
        f"boundary audit: {audit['audit_state']}",
        f"refactor readiness: {audit['refactor_readiness']}",
        "writes files: no",
        (
            f"{audit['module_count']} module"
            f"{'s' if audit['module_count'] != 1 else ''}; "
            f"{audit['complete_module_count']} complete; "
            f"{audit['incomplete_module_count']} incomplete"
        ),
        (
            f"{audit['hierarchy_edge_count']} hierarchy edge"
            f"{'s' if audit['hierarchy_edge_count'] != 1 else ''}; "
            f"{audit['unresolved_dependency_count']} unresolved"
        ),
    ]
    if not audit["modules"]:
        lines.append("modules: none")
    for module in audit["modules"]:
        end = (
            f"{module['end_line']}:{module['end_column']}"
            if module["complete"]
            else "missing"
        )
        lines.append(
            f"{module['file']}:{module['start_line']}:"
            f"{module['start_column']}-{end}: module {module['name']} "
            f"({module['boundary_state']}; "
            f"{module['refactor_preflight_state']})"
        )
        for reason in module["reasons"]:
            lines.append(f"  blocked: {reason}")
    for reason in audit["blocked_reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(
        "read-only: no file writes, refactors, validation, shell, lab, "
        "launcher, vendor tool, provider, or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_candidate_list_text(candidates: dict[str, Any]) -> str:
    lines = [
        f"source: {candidates['source']}",
        f"refactor candidates: {candidates['candidate_state']}",
        "writes files: no",
        (
            f"{candidates['module_count']} module"
            f"{'s' if candidates['module_count'] != 1 else ''}; "
            f"{candidates['ready_module_count']} ready; "
            f"{candidates['blocked_module_count']} blocked"
        ),
        (
            f"{candidates['action_count']} proposal-only action"
            f"{'s' if candidates['action_count'] != 1 else ''}"
        ),
    ]
    if not candidates["candidates"]:
        lines.append("candidates: none")
    for candidate in candidates["candidates"]:
        module = candidate["module"]
        end = (
            f"{module['end_line']}:{module['end_column']}"
            if module["complete"]
            else "missing"
        )
        lines.append(
            f"{module['file']}:{module['start_line']}:"
            f"{module['start_column']}-{end}: module {module['name']} "
            f"({candidate['candidate_state']})"
        )
        for action in candidate["actions"]:
            required = ", ".join(action["required_inputs"]) or "none"
            optional = ", ".join(action["optional_inputs"]) or "none"
            lines.append(
                f"  {action['action']}: {action['state']}; "
                f"required={required}; optional={optional}; "
                "proposal-only"
            )
        for reason in candidate["blocked_reasons"]:
            lines.append(f"  blocked: {reason}")
    for reason in candidates["blocked_reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(
        "read-only candidate metadata: no command argv, file writes, "
        "refactors, validation, shell, lab, launcher, vendor tool, provider, "
        "or hardware execution"
    )
    return "\n".join(lines) + "\n"


def format_refactor_readiness_summary_text(summary: dict[str, Any]) -> str:
    ready = "yes" if summary["ready_for_request"] else "no"
    lines = [
        f"source: {summary['source']}",
        f"refactor readiness: {summary['readiness_state']}",
        f"ready for request: {ready}",
        "writes files: no",
        (
            f"{summary['module_count']} module"
            f"{'s' if summary['module_count'] != 1 else ''}; "
            f"{summary['complete_module_count']} complete; "
            f"{summary['incomplete_module_count']} incomplete"
        ),
        (
            f"{summary['ready_module_count']} ready candidate"
            f"{'s' if summary['ready_module_count'] != 1 else ''}; "
            f"{summary['blocked_module_count']} blocked"
        ),
        (
            f"{summary['hierarchy_edge_count']} hierarchy edge"
            f"{'s' if summary['hierarchy_edge_count'] != 1 else ''}; "
            f"{summary['unresolved_dependency_count']} unresolved"
        ),
    ]
    for card in summary["status_cards"]:
        lines.append(f"status: {card['card_id']} ({card['status']})")
    for reason in summary["blocked_reasons"]:
        lines.append(f"blocked: {reason}")
    lines.append(f"next step: {summary['next_required_action']}")
    lines.append(
        "summary-only readiness: no command argv, requested input capture, "
        "proposal creation, approval, validation, shell, refactor, patch, "
        "file write, lab, launcher, vendor tool, provider, or hardware execution"
    )
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

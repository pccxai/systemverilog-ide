# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence

from . import __version__
from .diagnostics import scan_file


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pccx-ide",
        description=(
            "Scaffold CLI for the pccx SystemVerilog IDE spin-out. "
            "Default backend emits a placeholder diagnostics envelope. "
            "Use --backend pccx-lab to forward through the pccx-lab "
            "CLI / core boundary."
        ),
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"pccx-ide {__version__}",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    check = sub.add_parser(
        "check",
        help="Run a diagnostics check on a SystemVerilog file.",
    )
    check.add_argument("path", type=Path, help="Path to a .sv / .svh file.")
    check.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )
    check.add_argument(
        "--backend",
        choices=("scaffold", "pccx-lab"),
        default="scaffold",
        help=(
            "Analysis backend. 'scaffold' runs the built-in placeholder checks. "
            "'pccx-lab' invokes the pccx-lab binary (requires PCCX_LAB_BIN env var "
            "or pccx-lab on PATH); fails clearly if binary is missing — "
            "no silent fallback to scaffold. Default: scaffold."
        ),
    )

    index_cmd = sub.add_parser(
        "index",
        help="Scan a .sv/.v file or directory for module declarations.",
    )
    index_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    index_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )
    index_cmd.add_argument(
        "--query",
        metavar="MODULE_NAME",
        default=None,
        help="Filter results to modules with this exact name (case-sensitive).",
    )

    declarations_cmd = sub.add_parser(
        "declarations",
        help="Export scanner-based module/package/interface declaration records.",
    )
    declarations_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    declarations_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    locate_cmd = sub.add_parser(
        "locate",
        help="Locate a declaration by exact name in a .sv/.v file or directory.",
    )
    locate_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    locate_cmd.add_argument(
        "name",
        help="Declaration name to locate (exact, case-sensitive).",
    )
    locate_cmd.add_argument(
        "--kind",
        choices=("module", "package", "interface", "any"),
        default="module",
        help="Declaration kind to locate (default: module).",
    )
    locate_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    organization_cmd = sub.add_parser(
        "organization",
        help=(
            "Export scanner-based module boundaries and hierarchy seeds "
            "for project organization."
        ),
    )
    organization_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    organization_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    boundary_audit_cmd = sub.add_parser(
        "boundary-audit",
        help=(
            "Emit read-only scanner-based module boundary completeness "
            "and refactor-readiness audit data."
        ),
    )
    boundary_audit_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    boundary_audit_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    module_duplicates_cmd = sub.add_parser(
        "module-duplicates",
        help=(
            "Emit read-only scanner-based duplicate module declaration report data."
        ),
    )
    module_duplicates_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    module_duplicates_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_candidates_cmd = sub.add_parser(
        "refactor-candidates",
        help=(
            "Emit read-only scanner-based module refactor candidate "
            "metadata for editor action menus."
        ),
    )
    refactor_candidates_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_candidates_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_readiness_cmd = sub.add_parser(
        "refactor-readiness",
        help=(
            "Emit read-only scanner-based refactor readiness summary "
            "metadata for editor status panes."
        ),
    )
    refactor_readiness_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_readiness_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    hierarchy_cmd = sub.add_parser(
        "hierarchy",
        help=(
            "Render a scanner-based read-only module hierarchy view "
            "for editor trees."
        ),
    )
    hierarchy_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    hierarchy_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    dependencies_cmd = sub.add_parser(
        "dependencies",
        help=(
            "Render scanner-based read-only module dependency and impact data."
        ),
    )
    dependencies_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    dependencies_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    hierarchy_cycles_cmd = sub.add_parser(
        "hierarchy-cycles",
        help=(
            "Render scanner-based read-only hierarchy cycle report data."
        ),
    )
    hierarchy_cycles_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    hierarchy_cycles_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    unresolved_instances_cmd = sub.add_parser(
        "unresolved-instances",
        help=(
            "Render scanner-based read-only unresolved instantiation report data."
        ),
    )
    unresolved_instances_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    unresolved_instances_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    module_summary_cmd = sub.add_parser(
        "module-summary",
        help=(
            "Render scanner-based read-only module header and port summaries."
        ),
    )
    module_summary_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    module_summary_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    port_usage_cmd = sub.add_parser(
        "port-usage",
        help=(
            "Emit read-only scanner-based target port declarations and "
            "usage-site connection summaries."
        ),
    )
    port_usage_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    port_usage_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to inspect for port usage review.",
    )
    port_usage_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    module_context_cmd = sub.add_parser(
        "module-context",
        help=(
            "Emit a read-only scanner-based target module context bundle."
        ),
    )
    module_context_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    module_context_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to inspect for context review.",
    )
    module_context_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_impact_cmd = sub.add_parser(
        "refactor-impact",
        help=(
            "Emit read-only scanner-based impact data for a refactor target."
        ),
    )
    refactor_impact_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_impact_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to inspect for review impact.",
    )
    refactor_impact_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_plan_cmd = sub.add_parser(
        "refactor-plan",
        help=(
            "Emit a proposal-only refactoring plan for a scanner-detected "
            "module boundary."
        ),
    )
    refactor_plan_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_plan_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Proposal kind to prepare.",
    )
    refactor_plan_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the proposal target.",
    )
    refactor_plan_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module proposals.",
    )
    refactor_plan_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port proposals.",
    )
    refactor_plan_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port proposals.",
    )
    refactor_plan_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port proposals.",
    )
    refactor_plan_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module proposals.",
    )
    refactor_plan_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    validation_plan_cmd = sub.add_parser(
        "validation-plan",
        help=(
            "Emit proposal-only validation command descriptors for a "
            "refactor plan."
        ),
    )
    validation_plan_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    validation_plan_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to validate after review.",
    )
    validation_plan_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the validation target.",
    )
    validation_plan_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module validation plans.",
    )
    validation_plan_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port validation plans.",
    )
    validation_plan_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port validation plans.",
    )
    validation_plan_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port validation plans.",
    )
    validation_plan_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module validation plans.",
    )
    validation_plan_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_review_cmd = sub.add_parser(
        "refactor-review",
        help=(
            "Emit a summary-only review packet for a refactor proposal "
            "and validation plan."
        ),
    )
    refactor_review_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_review_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to summarize for review.",
    )
    refactor_review_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the review target.",
    )
    refactor_review_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module review packets.",
    )
    refactor_review_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port review packets.",
    )
    refactor_review_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port review packets.",
    )
    refactor_review_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port review packets.",
    )
    refactor_review_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module review packets.",
    )
    refactor_review_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_approval_cmd = sub.add_parser(
        "refactor-approval",
        help=(
            "Emit proposal-only approval decision metadata for a "
            "refactor review packet."
        ),
    )
    refactor_approval_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_approval_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to gate for approval.",
    )
    refactor_approval_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the approval target.",
    )
    refactor_approval_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module approval decisions.",
    )
    refactor_approval_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port approval decisions.",
    )
    refactor_approval_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port approval decisions.",
    )
    refactor_approval_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port approval decisions.",
    )
    refactor_approval_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module approval decisions.",
    )
    refactor_approval_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_application_cmd = sub.add_parser(
        "refactor-application",
        help=(
            "Emit proposal-only application request metadata for a "
            "refactor approval decision."
        ),
    )
    refactor_application_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_application_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to gate for application.",
    )
    refactor_application_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the application target.",
    )
    refactor_application_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module application requests.",
    )
    refactor_application_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port application requests.",
    )
    refactor_application_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port application requests.",
    )
    refactor_application_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port application requests.",
    )
    refactor_application_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module application requests.",
    )
    refactor_application_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_result_cmd = sub.add_parser(
        "refactor-result",
        help=(
            "Emit proposal-only application result metadata for a "
            "refactor application request."
        ),
    )
    refactor_result_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_result_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to summarize as a result.",
    )
    refactor_result_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the result target.",
    )
    refactor_result_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module application results.",
    )
    refactor_result_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port application results.",
    )
    refactor_result_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port application results.",
    )
    refactor_result_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port application results.",
    )
    refactor_result_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module application results.",
    )
    refactor_result_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_handoff_cmd = sub.add_parser(
        "refactor-handoff",
        help="Emit summary-only handoff metadata for a refactor result.",
    )
    refactor_handoff_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_handoff_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to summarize for handoff.",
    )
    refactor_handoff_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the handoff target.",
    )
    refactor_handoff_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module handoff summaries.",
    )
    refactor_handoff_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port handoff summaries.",
    )
    refactor_handoff_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port handoff summaries.",
    )
    refactor_handoff_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port handoff summaries.",
    )
    refactor_handoff_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module handoff summaries.",
    )
    refactor_handoff_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_checklist_cmd = sub.add_parser(
        "refactor-checklist",
        help="Emit summary-only checklist metadata for refactor review.",
    )
    refactor_checklist_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_checklist_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to summarize as a review checklist.",
    )
    refactor_checklist_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the checklist target.",
    )
    refactor_checklist_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module checklists.",
    )
    refactor_checklist_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port checklists.",
    )
    refactor_checklist_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port checklists.",
    )
    refactor_checklist_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port checklists.",
    )
    refactor_checklist_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module checklists.",
    )
    refactor_checklist_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    refactor_session_cmd = sub.add_parser(
        "refactor-session",
        help="Emit summary-only session status for refactor review.",
    )
    refactor_session_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    refactor_session_cmd.add_argument(
        "--action",
        choices=("rename-module", "extract-port", "move-module"),
        required=True,
        help="Refactor proposal kind to summarize as session status.",
    )
    refactor_session_cmd.add_argument(
        "--module",
        required=True,
        help="Exact module name to use as the session target.",
    )
    refactor_session_cmd.add_argument(
        "--new-name",
        default=None,
        help="New module name for rename-module session status.",
    )
    refactor_session_cmd.add_argument(
        "--port-name",
        default=None,
        help="Port name for extract-port session status.",
    )
    refactor_session_cmd.add_argument(
        "--direction",
        choices=("input", "output", "inout"),
        default=None,
        help="Port direction for extract-port session status.",
    )
    refactor_session_cmd.add_argument(
        "--width",
        default=None,
        help="Optional port width text for extract-port session status.",
    )
    refactor_session_cmd.add_argument(
        "--destination",
        default=None,
        help="Relative destination path for move-module session status.",
    )
    refactor_session_cmd.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    xsim_log = sub.add_parser(
        "xsim-log",
        help="Parse an existing xsim-style log file into diagnostics-like output.",
    )
    xsim_log.add_argument(
        "log_file",
        type=Path,
        help="Path to an existing xsim-style log file.",
    )
    xsim_log.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    problems = sub.add_parser(
        "problems",
        help="Export editor-friendly problems from existing local outputs.",
    )
    problems_sub = problems.add_subparsers(dest="problems_source", required=True)

    problems_check = problems_sub.add_parser(
        "from-check",
        help="Export problems from the built-in scaffold diagnostics check.",
    )
    problems_check.add_argument(
        "path",
        type=Path,
        help="Path to a .sv / .svh file.",
    )
    problems_check.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    problems_xsim = problems_sub.add_parser(
        "from-xsim-log",
        help="Export problems from an existing xsim-style log file.",
    )
    problems_xsim.add_argument(
        "log_file",
        type=Path,
        help="Path to an existing xsim-style log file.",
    )
    problems_xsim.add_argument(
        "--format",
        choices=("json", "text"),
        default="json",
        help="Output format (default: json).",
    )

    sub.add_parser(
        "schema",
        help="Print the diagnostics envelope JSON schema.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "schema":
        schema_path = (
            Path(__file__).resolve().parent.parent.parent
            / "schema"
            / "diagnostics-v0.json"
        )
        if not schema_path.exists():
            schema_path = Path(__file__).resolve().parent / "_schema_fallback.json"
        sys.stdout.write(schema_path.read_text(encoding="utf-8"))
        return 0

    if args.command == "check":
        if args.backend == "pccx-lab":
            from .pccx_lab_backend import run as _run_pccx_lab
            envelope, lab_exit = _run_pccx_lab(args.path)
        else:
            envelope = scan_file(args.path)
            lab_exit = None

        if args.format == "json":
            json.dump(envelope, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            diags = envelope["diagnostics"]
            count = len(diags)
            plural = "s" if count != 1 else ""
            sys.stdout.write(f"backend: {args.backend}\n")
            sys.stdout.write(f"source: {envelope['source']}\n")
            sys.stdout.write(f"{count} diagnostic{plural}\n")
            for d in diags:
                sys.stdout.write(
                    f"{envelope['source']}:{d['line']}:{d['column']}: "
                    f"{d['severity']}: {d['code']}: {d['message']}\n"
                )

        if lab_exit is not None:
            return lab_exit
        return 0 if not envelope["diagnostics"] else 1

    if args.command == "index":
        from .module_index import build_index, filter_declarations, scan_path

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        declarations = scan_path(args.path)
        if args.query is not None:
            declarations = filter_declarations(declarations, args.query)
        index = build_index(str(args.path), declarations)

        if args.format == "json":
            json.dump(index, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            count = len(declarations)
            module_only = all(d["kind"] == "module" for d in declarations)
            noun = "module" if module_only else "declaration"
            plural = "s" if count != 1 else ""
            sys.stdout.write(f"source: {index['source']}\n")
            sys.stdout.write(f"{count} {noun}{plural}\n")
            for d in declarations:
                sys.stdout.write(
                    f"{d['file']}:{d['line']}:{d['column']}: "
                    f"{d['kind']} {d['name']}\n"
            )
        return 0

    if args.command == "declarations":
        from .module_index import build_declarations_export, scan_path

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        declarations = scan_path(args.path)
        export = build_declarations_export(str(args.path), declarations)

        if args.format == "json":
            json.dump(export, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            count = len(declarations)
            plural = "s" if count != 1 else ""
            sys.stdout.write(f"source: {export['source']}\n")
            sys.stdout.write(f"{count} declaration{plural}\n")
            for d in declarations:
                sys.stdout.write(
                    f"{d['file']}:{d['line']}:{d['column']}: "
                    f"{d['kind']} {d['name']}\n"
                )
        return 0

    if args.command == "locate":
        from .module_index import locate_declaration

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        matches = locate_declaration(args.path, args.name, args.kind)

        if args.format == "json":
            envelope = {
                "declaration_kind": args.kind,
                "kind": "locate",
                "matches": matches,
                "query": args.name,
                "source": "line-scanner",
                "tool": "pccx-ide-cli",
            }
            json.dump(envelope, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            count = len(matches)
            if count == 1:
                sys.stdout.write(f"{matches[0]['kind']} {matches[0]['name']}\n")
                sys.stdout.write(
                    f"{matches[0]['file']}:{matches[0]['line']}:{matches[0]['column']}\n"
                )
            elif count == 0:
                label = "declaration" if args.kind == "any" else args.kind
                sys.stdout.write(f"{label} {args.name}: not found\n")
            else:
                label = "declaration" if args.kind == "any" else args.kind
                sys.stdout.write(
                    f"{label} {args.name}: {count} matches (ambiguous)\n"
                )
                for m in matches:
                    if args.kind == "module":
                        sys.stdout.write(f"{m['file']}:{m['line']}:{m['column']}\n")
                    else:
                        sys.stdout.write(
                            f"{m['file']}:{m['line']}:{m['column']}: "
                            f"{m['kind']} {m['name']}\n"
                        )

        if len(matches) == 0:
            label = "declaration" if args.kind == "any" else args.kind
            sys.stderr.write(f"error: {label} not found: {args.name}\n")
            return 1
        if len(matches) > 1:
            label = "declaration" if args.kind == "any" else args.kind
            sys.stderr.write(
                f"error: ambiguous: {len(matches)} matches for {label} {args.name}\n"
            )
            return 2
        return 0

    if args.command == "organization":
        from .module_organization import (
            build_module_organization_export,
            format_module_organization_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        export = build_module_organization_export(str(args.path), args.path)
        if args.format == "json":
            json.dump(export, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_organization_text(export))
        return 0

    if args.command == "boundary-audit":
        from .module_organization import (
            build_module_boundary_audit,
            format_module_boundary_audit_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        audit = build_module_boundary_audit(str(args.path), args.path)
        if args.format == "json":
            json.dump(audit, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_boundary_audit_text(audit))
        return 0

    if args.command == "module-duplicates":
        from .module_organization import (
            build_module_duplicate_report,
            format_module_duplicate_report_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        report = build_module_duplicate_report(str(args.path), args.path)
        if args.format == "json":
            json.dump(report, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_duplicate_report_text(report))
        return 0

    if args.command == "refactor-candidates":
        from .module_organization import (
            build_refactor_candidate_list,
            format_refactor_candidate_list_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        candidates = build_refactor_candidate_list(str(args.path), args.path)
        if args.format == "json":
            json.dump(candidates, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_candidate_list_text(candidates))
        return 0

    if args.command == "refactor-readiness":
        from .module_organization import (
            build_refactor_readiness_summary,
            format_refactor_readiness_summary_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        summary = build_refactor_readiness_summary(str(args.path), args.path)
        if args.format == "json":
            json.dump(summary, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_readiness_summary_text(summary))
        return 0

    if args.command == "hierarchy":
        from .module_organization import (
            build_module_hierarchy_view,
            format_module_hierarchy_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        view = build_module_hierarchy_view(str(args.path), args.path)
        if args.format == "json":
            json.dump(view, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_hierarchy_text(view))
        return 0

    if args.command == "dependencies":
        from .module_organization import (
            build_module_dependency_view,
            format_module_dependency_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        view = build_module_dependency_view(str(args.path), args.path)
        if args.format == "json":
            json.dump(view, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_dependency_text(view))
        return 0

    if args.command == "hierarchy-cycles":
        from .module_organization import (
            build_module_hierarchy_cycle_report,
            format_module_hierarchy_cycle_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        report = build_module_hierarchy_cycle_report(str(args.path), args.path)
        if args.format == "json":
            json.dump(report, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_hierarchy_cycle_text(report))
        return 0

    if args.command == "unresolved-instances":
        from .module_organization import (
            build_module_unresolved_instance_report,
            format_module_unresolved_instance_report_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        report = build_module_unresolved_instance_report(str(args.path), args.path)
        if args.format == "json":
            json.dump(report, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_unresolved_instance_report_text(report))
        return 0

    if args.command == "module-summary":
        from .module_organization import (
            build_module_summary_view,
            format_module_summary_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        view = build_module_summary_view(str(args.path), args.path)
        if args.format == "json":
            json.dump(view, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_summary_text(view))
        return 0

    if args.command == "port-usage":
        from .module_organization import (
            build_module_port_usage_view,
            format_module_port_usage_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        view = build_module_port_usage_view(str(args.path), args.path, args.module)
        if args.format == "json":
            json.dump(view, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_port_usage_text(view))
        return 0

    if args.command == "module-context":
        from .module_organization import (
            build_module_context_bundle,
            format_module_context_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        bundle = build_module_context_bundle(str(args.path), args.path, args.module)
        if args.format == "json":
            json.dump(bundle, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_module_context_text(bundle))
        return 0

    if args.command == "refactor-impact":
        from .module_organization import (
            build_refactor_impact_view,
            format_refactor_impact_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        view = build_refactor_impact_view(str(args.path), args.path, args.module)
        if args.format == "json":
            json.dump(view, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_impact_text(view))
        return 0

    if args.command == "refactor-plan":
        from .module_organization import (
            build_refactor_proposal,
            format_refactor_proposal_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        proposal = build_refactor_proposal(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(proposal, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_proposal_text(proposal))
        return 0

    if args.command == "validation-plan":
        from .module_organization import (
            build_refactor_validation_plan,
            format_refactor_validation_plan_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        plan = build_refactor_validation_plan(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(plan, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_validation_plan_text(plan))
        return 0

    if args.command == "refactor-review":
        from .module_organization import (
            build_refactor_review_packet,
            format_refactor_review_packet_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        packet = build_refactor_review_packet(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(packet, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_review_packet_text(packet))
        return 0

    if args.command == "refactor-approval":
        from .module_organization import (
            build_refactor_approval_decision,
            format_refactor_approval_decision_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        decision = build_refactor_approval_decision(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(decision, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_approval_decision_text(decision))
        return 0

    if args.command == "refactor-application":
        from .module_organization import (
            build_refactor_application_request,
            format_refactor_application_request_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        request = build_refactor_application_request(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(request, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_application_request_text(request))
        return 0

    if args.command == "refactor-result":
        from .module_organization import (
            build_refactor_application_result,
            format_refactor_application_result_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        result = build_refactor_application_result(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(result, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_application_result_text(result))
        return 0

    if args.command == "refactor-handoff":
        from .module_organization import (
            build_refactor_handoff_summary,
            format_refactor_handoff_summary_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        summary = build_refactor_handoff_summary(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(summary, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_handoff_summary_text(summary))
        return 0

    if args.command == "refactor-checklist":
        from .module_organization import (
            build_refactor_checklist_summary,
            format_refactor_checklist_summary_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        checklist = build_refactor_checklist_summary(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(checklist, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_checklist_summary_text(checklist))
        return 0

    if args.command == "refactor-session":
        from .module_organization import (
            build_refactor_session_status,
            format_refactor_session_status_text,
        )

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        session = build_refactor_session_status(
            str(args.path),
            args.path,
            args.action,
            args.module,
            new_name=args.new_name,
            port_name=args.port_name,
            direction=args.direction,
            width=args.width,
            destination=args.destination,
        )
        if args.format == "json":
            json.dump(session, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_refactor_session_status_text(session))
        return 0

    if args.command == "xsim-log":
        from .xsim_log import format_text, parse_log_file

        if not args.log_file.exists():
            sys.stderr.write(f"error: log file does not exist: {args.log_file}\n")
            return 2
        if not args.log_file.is_file():
            sys.stderr.write(f"error: log path is not a file: {args.log_file}\n")
            return 2

        envelope = parse_log_file(args.log_file)
        if args.format == "json":
            json.dump(envelope, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_text(envelope))
        return 0

    if args.command == "problems":
        from .problem_export import (
            build_export,
            format_text,
            from_check_envelope,
            from_xsim_log_envelope,
        )

        if args.problems_source == "from-check":
            if not args.path.exists():
                sys.stderr.write(f"error: input file does not exist: {args.path}\n")
                return 2
            if not args.path.is_file():
                sys.stderr.write(f"error: input path is not a file: {args.path}\n")
                return 2
            check_envelope = scan_file(args.path)
            export = build_export(
                "check",
                str(args.path),
                from_check_envelope(check_envelope),
            )
        elif args.problems_source == "from-xsim-log":
            from .xsim_log import parse_log_file

            if not args.log_file.exists():
                sys.stderr.write(f"error: log file does not exist: {args.log_file}\n")
                return 2
            if not args.log_file.is_file():
                sys.stderr.write(f"error: log path is not a file: {args.log_file}\n")
                return 2
            xsim_envelope = parse_log_file(args.log_file)
            export = build_export(
                "xsim-log",
                str(args.log_file),
                from_xsim_log_envelope(xsim_envelope),
            )
        else:
            parser.error(f"unknown problems source: {args.problems_source}")
            return 2

        if args.format == "json":
            json.dump(export, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            sys.stdout.write(format_text(export))
        return 0

    parser.error(f"unknown command: {args.command}")
    return 2

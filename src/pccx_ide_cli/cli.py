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

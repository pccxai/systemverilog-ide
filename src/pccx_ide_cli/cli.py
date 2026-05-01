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

    locate_cmd = sub.add_parser(
        "locate",
        help="Locate a module by exact name in a .sv/.v file or directory.",
    )
    locate_cmd.add_argument(
        "path",
        type=Path,
        help="Path to a .sv/.v file or a directory to scan recursively.",
    )
    locate_cmd.add_argument(
        "name",
        help="Module name to locate (exact, case-sensitive).",
    )
    locate_cmd.add_argument(
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
        from .module_index import build_index, filter_modules, scan_path

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        modules = scan_path(args.path)
        if args.query is not None:
            modules = filter_modules(modules, args.query)
        index = build_index(str(args.path), modules)

        if args.format == "json":
            json.dump(index, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            count = len(modules)
            plural = "s" if count != 1 else ""
            sys.stdout.write(f"source: {index['source']}\n")
            sys.stdout.write(f"{count} module{plural}\n")
            for m in modules:
                sys.stdout.write(
                    f"{m['file']}:{m['line']}:{m['column']}: module {m['name']}\n"
                )
        return 0

    if args.command == "locate":
        from .module_index import locate_module

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        matches = locate_module(args.path, args.name)

        if args.format == "json":
            envelope = {
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
                sys.stdout.write(f"module {matches[0]['module']}\n")
                sys.stdout.write(
                    f"{matches[0]['file']}:{matches[0]['line']}:{matches[0]['column']}\n"
                )
            elif count == 0:
                sys.stdout.write(f"module {args.name}: not found\n")
            else:
                sys.stdout.write(
                    f"module {args.name}: {count} matches (ambiguous)\n"
                )
                for m in matches:
                    sys.stdout.write(f"{m['file']}:{m['line']}:{m['column']}\n")

        if len(matches) == 0:
            sys.stderr.write(f"error: module not found: {args.name}\n")
            return 1
        if len(matches) > 1:
            sys.stderr.write(
                f"error: ambiguous: {len(matches)} matches for module {args.name}\n"
            )
            return 2
        return 0

    parser.error(f"unknown command: {args.command}")
    return 2

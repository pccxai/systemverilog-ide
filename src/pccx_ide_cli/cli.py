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
        from .module_index import build_index, scan_path

        if not args.path.exists():
            sys.stderr.write(f"error: path does not exist: {args.path}\n")
            return 2

        modules = scan_path(args.path)
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

    parser.error(f"unknown command: {args.command}")
    return 2

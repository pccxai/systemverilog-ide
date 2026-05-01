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
            "Emits a placeholder diagnostics envelope; real analysis "
            "will be consumed from pccx-lab once its CLI / core "
            "boundary stabilizes."
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
        help="Run the placeholder envelope check on a SystemVerilog file.",
    )
    check.add_argument("path", type=Path, help="Path to a .sv / .svh file.")
    check.add_argument(
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
        envelope = scan_file(args.path)
        if args.format == "json":
            json.dump(envelope, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
        else:
            for d in envelope["diagnostics"]:
                sys.stdout.write(
                    f"{envelope['source']}:{d['line']}: "
                    f"{d['severity']}: {d['code']}: {d['message']}\n"
                )
        return 0 if not envelope["diagnostics"] else 1

    parser.error(f"unknown command: {args.command}")
    return 2

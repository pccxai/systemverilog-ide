#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v python >/dev/null 2>&1; then
  PY=python
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  echo "error: python or python3 is required" >&2
  exit 127
fi

export PYTHONPATH="$ROOT/src${PYTHONPATH:+:$PYTHONPATH}"
export ROOT
cd "$ROOT"

"$PY" - <<'PY'
from __future__ import annotations

import difflib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.environ["ROOT"])
EXAMPLES = ROOT / "docs" / "examples" / "editor-bridge"

FLOWS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        "problems-check-ok.example.json",
        "editor-problems",
        ("problems", "from-check", "fixtures/ok_module.sv", "--format", "json"),
    ),
    (
        "problems-check-missing-endmodule.example.json",
        "editor-problems",
        (
            "problems",
            "from-check",
            "fixtures/missing_endmodule.sv",
            "--format",
            "json",
        ),
    ),
    (
        "problems-xsim-mixed.example.json",
        "editor-problems",
        ("problems", "from-xsim-log", "fixtures/xsim/mixed.log", "--format", "json"),
    ),
    (
        "index-modules.example.json",
        "module-index",
        ("index", "fixtures/modules", "--format", "json"),
    ),
    (
        "declarations.example.json",
        "declarations",
        ("declarations", "fixtures/modules", "--format", "json"),
    ),
    (
        "locate-module.example.json",
        "locate",
        (
            "locate",
            "fixtures/modules/simple_module.sv",
            "simple_mod",
            "--kind",
            "module",
            "--format",
            "json",
        ),
    ),
    (
        "locate-package.example.json",
        "locate",
        (
            "locate",
            "fixtures/modules",
            "pkg_defs",
            "--kind",
            "package",
            "--format",
            "json",
        ),
    ),
    (
        "locate-interface.example.json",
        "locate",
        (
            "locate",
            "fixtures/modules",
            "bus_if",
            "--kind",
            "interface",
            "--format",
            "json",
        ),
    ),
)


def normalized(payload: object) -> str:
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def run_flow(args: tuple[str, ...]) -> object:
    result = subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", *args],
        cwd=ROOT,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        sys.stderr.write(f"error: command failed: {' '.join(args)}\n")
        sys.stderr.write(result.stderr)
        sys.stderr.write(result.stdout)
        raise SystemExit(result.returncode)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"error: command did not emit JSON: {' '.join(args)}\n")
        sys.stderr.write(f"{exc}\n")
        raise SystemExit(1) from exc


failures = 0
for filename, expected_kind, args in FLOWS:
    path = EXAMPLES / filename
    expected = json.loads(path.read_text(encoding="utf-8"))
    actual = run_flow(args)
    if actual.get("kind") != expected_kind:
        sys.stderr.write(
            f"error: {filename} expected kind {expected_kind!r}, "
            f"got {actual.get('kind')!r}\n"
        )
        failures += 1
        continue
    if actual != expected:
        failures += 1
        diff = difflib.unified_diff(
            normalized(expected).splitlines(),
            normalized(actual).splitlines(),
            fromfile=str(path),
            tofile=f"expected:{' '.join(args)}",
            lineterm="",
        )
        sys.stderr.write("\n".join(diff))
        sys.stderr.write("\n")

if failures:
    sys.stderr.write(f"error: {failures} editor bridge example(s) drifted\n")
    raise SystemExit(1)

print(f"editor bridge examples ok ({len(FLOWS)} checked)")
PY

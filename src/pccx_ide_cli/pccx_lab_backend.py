from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import jsonschema

_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent.parent / "schema" / "diagnostics-v0.json"
)
_SCHEMA = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = jsonschema.Draft202012Validator(_SCHEMA)


def resolve_binary() -> str | None:
    """Return the pccx-lab binary path, or None if not resolvable.

    Resolution order:
      1. PCCX_LAB_BIN environment variable (non-empty).
      2. 'pccx-lab' on PATH via shutil.which.
    """
    env_bin = os.environ.get("PCCX_LAB_BIN")
    if env_bin:
        return env_bin
    return shutil.which("pccx-lab")


def _normalize_envelope(raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Apply the two narrow adapter rules and return (adapted_envelope, notes).

    Rules applied:
      1. Strip _note (it is a self-described comment field, not data).
      2. Clamp line/column from 0 to 1 per-diagnostic (pccx-lab uses 0 for
         "unknown location"; diagnostics-v0.json requires minimum: 1).

    Any other unknown top-level field is left in place so that the schema
    validator can reject it explicitly rather than silently discarding it.
    """
    adapted = dict(raw)
    notes: list[str] = []

    if "_note" in adapted:
        del adapted["_note"]
        notes.append("_note stripped (comment field, not data)")

    if "diagnostics" in adapted and isinstance(adapted["diagnostics"], list):
        clamped = 0
        new_diags: list[dict[str, Any]] = []
        for d in adapted["diagnostics"]:
            d = dict(d)
            if isinstance(d.get("line"), int) and d["line"] < 1:
                d["line"] = 1
                clamped += 1
            if isinstance(d.get("column"), int) and d["column"] < 1:
                d["column"] = 1
                clamped += 1
            new_diags.append(d)
        adapted["diagnostics"] = new_diags
        if clamped:
            notes.append(
                f"{clamped} line/column 0→1 "
                f"(pccx-lab uses 0 for unknown location; schema minimum is 1)"
            )

    return adapted, notes


def run(file: Path) -> tuple[dict[str, Any], int]:
    """Invoke 'pccx-lab analyze <file> --format json' and return (envelope, exit_code).

    Raises SystemExit(2) with a clear error message on:
      - binary not found (no PCCX_LAB_BIN and no pccx-lab on PATH)
      - binary execution failure
      - empty stdout
      - JSON parse error
      - schema validation failure after normalization

    Never falls back to scaffold analysis.  A missing or broken pccx-lab
    binary is a configuration error, not a graceful-degradation case.
    """
    bin_path = resolve_binary()
    if bin_path is None:
        sys.stderr.write(
            "error: --backend pccx-lab requested but no binary found\n"
            "  Set PCCX_LAB_BIN to the pccx-lab binary path, "
            "or add pccx-lab to PATH\n"
            "  No fallback to scaffold analysis\n"
        )
        raise SystemExit(2)

    try:
        proc = subprocess.run(
            [bin_path, "analyze", str(file), "--format", "json"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        sys.stderr.write(
            f"error: failed to execute pccx-lab ({bin_path!r}): {exc}\n"
            "  No fallback to scaffold analysis\n"
        )
        raise SystemExit(2)

    if proc.stderr:
        sys.stderr.write(proc.stderr)

    stdout = proc.stdout.strip()
    if not stdout:
        sys.stderr.write(
            f"error: pccx-lab exited {proc.returncode} with empty stdout\n"
        )
        raise SystemExit(2)

    try:
        raw: dict[str, Any] = json.loads(stdout)
    except json.JSONDecodeError as exc:
        sys.stderr.write(
            f"error: pccx-lab stdout is not valid JSON: {exc}\n"
            f"  (first 200 chars) {stdout[:200]!r}\n"
        )
        raise SystemExit(2)

    adapted, notes = _normalize_envelope(raw)

    if notes:
        sys.stderr.write(
            "# pccx-ide: forwarded from pccx-lab v0 envelope ("
            + "; ".join(notes)
            + ")\n"
        )

    errors = list(_VALIDATOR.iter_errors(adapted))
    if errors:
        sys.stderr.write(
            "error: pccx-lab envelope failed diagnostics-v0.json validation "
            "after normalization\n"
        )
        for e in errors:
            sys.stderr.write(f"  {e.message}\n")
        raise SystemExit(2)

    return adapted, proc.returncode

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

ENVELOPE_VERSION = "0"

_MODULE_RE = re.compile(r"^\s*module\s+\w+", re.MULTILINE)
_ENDMODULE_RE = re.compile(r"^\s*endmodule\b", re.MULTILINE)


def _diag(
    line: int,
    col: int,
    severity: str,
    code: str,
    message: str,
) -> dict[str, Any]:
    return {
        "line": line,
        "column": col,
        "severity": severity,
        "code": code,
        "message": message,
        "source": "pccx-ide-scaffold",
    }


def scan_text(text: str, source: str) -> dict[str, Any]:
    """Return a diagnostics envelope for a piece of SystemVerilog text.

    The checks here are intentionally trivial scaffold-level placeholders:
    they exercise the envelope shape, not real analysis. Real semantic
    analysis is expected to come from pccx-lab via its CLI / core
    boundary.
    """

    diagnostics: list[dict[str, Any]] = []

    if not text.strip():
        diagnostics.append(
            _diag(1, 1, "error", "PCCX-SCAFFOLD-001", "file is empty"),
        )

    has_module = bool(_MODULE_RE.search(text))
    has_endmodule = bool(_ENDMODULE_RE.search(text))

    if not has_module:
        diagnostics.append(
            _diag(
                1,
                1,
                "warning",
                "PCCX-SCAFFOLD-002",
                "no top-level `module` declaration found",
            ),
        )

    if has_module and not has_endmodule:
        diagnostics.append(
            _diag(
                1,
                1,
                "error",
                "PCCX-SCAFFOLD-003",
                "`module` declared but no matching `endmodule` found",
            ),
        )

    return {
        "envelope": ENVELOPE_VERSION,
        "tool": "pccx-ide-scaffold",
        "source": source,
        "diagnostics": diagnostics,
    }


def scan_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "envelope": ENVELOPE_VERSION,
            "tool": "pccx-ide-scaffold",
            "source": str(path),
            "diagnostics": [
                _diag(
                    1,
                    1,
                    "error",
                    "PCCX-SCAFFOLD-000",
                    f"file does not exist: {path}",
                ),
            ],
        }
    text = path.read_text(encoding="utf-8", errors="replace")
    return scan_text(text, str(path))

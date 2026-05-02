from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_COMPILE_STYLE_RE = re.compile(
    r"^(?P<file>.+?):(?P<line>\d+)(?::(?P<column>\d+))?:\s*"
    r"(?P<severity>error|warning|info):\s*(?P<message>.*)$",
    re.IGNORECASE,
)
_SIMPLE_SEVERITY_RE = re.compile(
    r"^(?P<severity>ERROR|WARNING|INFO):\s*(?P<message>.*)$",
    re.IGNORECASE,
)
_BRACKET_CODE_RE = re.compile(
    r"^\[(?P<code>[^\]]*\d+-\d+[^\]]*)\]\s*(?P<message>.*)$"
)


def _split_code(message: str) -> tuple[str | None, str]:
    match = _BRACKET_CODE_RE.match(message)
    if not match:
        return None, message
    return match.group("code").strip(), match.group("message")


def _record(
    *,
    severity: str,
    message: str,
    raw_line: str,
    code: str | None = None,
    file: str | None = None,
    line: int | None = None,
    column: int | None = None,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "severity": severity.lower(),
        "message": message,
        "raw_line": raw_line,
    }
    if code:
        record["code"] = code
    if file:
        record["file"] = file
    if line is not None:
        record["line"] = line
    if column is not None:
        record["column"] = column
    return record


def parse_line(line: str) -> dict[str, Any] | None:
    """Parse one conservative xsim/compile-style log line.

    Unknown lines return None. This is intentionally a small handoff scaffold,
    not a full Vivado/xsim parser.
    """
    raw_line = line.rstrip("\n")

    match = _COMPILE_STYLE_RE.match(raw_line)
    if match:
        code, message = _split_code(match.group("message"))
        column = match.group("column")
        return _record(
            severity=match.group("severity"),
            code=code,
            message=message,
            file=match.group("file"),
            line=int(match.group("line")),
            column=int(column) if column is not None else None,
            raw_line=raw_line,
        )

    match = _SIMPLE_SEVERITY_RE.match(raw_line)
    if match:
        code, message = _split_code(match.group("message"))
        return _record(
            severity=match.group("severity"),
            code=code,
            message=message,
            raw_line=raw_line,
        )

    return None


def parse_text(text: str) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for line in text.splitlines():
        record = parse_line(line)
        if record is not None:
            diagnostics.append(record)
    return diagnostics


def parse_file(path: Path) -> list[dict[str, Any]]:
    return parse_text(path.read_text(encoding="utf-8", errors="replace"))


def build_envelope(source: str, diagnostics: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "diagnostics": diagnostics,
        "kind": "xsim-log",
        "source": source,
        "tool": "pccx-ide-cli",
    }


def parse_log_file(path: Path) -> dict[str, Any]:
    return build_envelope(str(path), parse_file(path))


def format_text(envelope: dict[str, Any]) -> str:
    diagnostics = envelope["diagnostics"]
    count = len(diagnostics)
    plural = "s" if count != 1 else ""
    lines = [
        f"source: {envelope['source']}",
        f"{count} diagnostic{plural}",
    ]

    for diagnostic in diagnostics:
        severity = diagnostic["severity"]
        message = diagnostic["message"]
        code = diagnostic.get("code")
        message_part = f"{code}: {message}" if code else message

        file = diagnostic.get("file")
        line = diagnostic.get("line")
        column = diagnostic.get("column")
        if file is not None and line is not None:
            location = f"{file}:{line}"
            if column is not None:
                location = f"{location}:{column}"
            lines.append(f"{location}: {severity}: {message_part}")
        else:
            lines.append(f"{severity}: {message_part}")

    return "\n".join(lines) + "\n"

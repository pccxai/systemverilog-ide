from __future__ import annotations

from typing import Any

Problem = dict[str, Any]


def _problem_sort_key(problem: Problem) -> tuple[str, int, int, str, str, str]:
    line = problem.get("line")
    column = problem.get("column")
    return (
        str(problem.get("file") or ""),
        line if isinstance(line, int) else 0,
        column if isinstance(column, int) else 0,
        str(problem.get("severity") or ""),
        str(problem.get("code") or ""),
        str(problem.get("message") or ""),
    )


def _sorted_problems(problems: list[Problem]) -> list[Problem]:
    return sorted(problems, key=_problem_sort_key)


def _copy_if_present(target: Problem, source: dict[str, Any], key: str) -> None:
    value = source.get(key)
    if value is not None:
        target[key] = value


def from_check_envelope(envelope: dict[str, Any]) -> list[Problem]:
    problems: list[Problem] = []
    source = str(envelope.get("source", ""))

    for diagnostic in envelope.get("diagnostics", []):
        problem: Problem = {
            "source_kind": "check",
            "severity": diagnostic["severity"],
            "message": diagnostic["message"],
        }
        if source:
            problem["file"] = source
        _copy_if_present(problem, diagnostic, "line")
        _copy_if_present(problem, diagnostic, "column")
        _copy_if_present(problem, diagnostic, "code")
        problems.append(problem)

    return _sorted_problems(problems)


def from_xsim_log_envelope(envelope: dict[str, Any]) -> list[Problem]:
    problems: list[Problem] = []

    for diagnostic in envelope.get("diagnostics", []):
        problem: Problem = {
            "source_kind": "xsim-log",
            "severity": diagnostic["severity"],
            "message": diagnostic["message"],
        }
        _copy_if_present(problem, diagnostic, "file")
        _copy_if_present(problem, diagnostic, "line")
        _copy_if_present(problem, diagnostic, "column")
        _copy_if_present(problem, diagnostic, "code")
        raw = diagnostic.get("raw_line")
        if raw is not None:
            problem["raw"] = raw
        problems.append(problem)

    return _sorted_problems(problems)


def build_export(source_kind: str, source: str, problems: list[Problem]) -> dict[str, Any]:
    return {
        "kind": "editor-problems",
        "problems": _sorted_problems(problems),
        "source": source,
        "source_kind": source_kind,
        "tool": "pccx-ide-cli",
    }


def format_text(export: dict[str, Any]) -> str:
    problems = export["problems"]
    count = len(problems)
    plural = "s" if count != 1 else ""
    lines = [
        f"source: {export['source']}",
        f"source-kind: {export['source_kind']}",
        f"{count} problem{plural}",
    ]

    for problem in problems:
        severity = problem["severity"]
        message = problem["message"]
        code = problem.get("code")
        message_part = f"{code}: {message}" if code else message

        file = problem.get("file")
        line = problem.get("line")
        column = problem.get("column")
        if file is not None and line is not None:
            location = f"{file}:{line}"
            if column is not None:
                location = f"{location}:{column}"
            lines.append(f"{location}: {severity}: {message_part}")
        elif file is not None:
            lines.append(f"{file}: {severity}: {message_part}")
        else:
            lines.append(f"{severity}: {message_part}")

    return "\n".join(lines) + "\n"

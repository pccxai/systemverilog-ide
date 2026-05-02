from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
SV_FIXTURES = REPO_ROOT / "fixtures"
XSIM_FIXTURES = REPO_ROOT / "fixtures" / "xsim"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.problem_export import (  # noqa: E402
    build_export,
    from_check_envelope,
    from_xsim_log_envelope,
)
from pccx_ide_cli.diagnostics import scan_file  # noqa: E402
from pccx_ide_cli.xsim_log import parse_log_file  # noqa: E402


def _run_cli(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", *args],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(SRC),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )


def test_from_check_ok_module_zero_problems_exit_zero():
    result = _run_cli(
        "problems",
        "from-check",
        str(SV_FIXTURES / "ok_module.sv"),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["problems"] == []


def test_from_check_missing_endmodule_produces_problem():
    result = _run_cli(
        "problems",
        "from-check",
        str(SV_FIXTURES / "missing_endmodule.sv"),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert len(payload["problems"]) >= 1
    assert payload["problems"][0]["code"] == "PCCX-SCAFFOLD-003"
    assert payload["problems"][0]["file"] == str(SV_FIXTURES / "missing_endmodule.sv")


def test_from_check_text_includes_source_kind_count():
    result = _run_cli(
        "problems",
        "from-check",
        str(SV_FIXTURES / "missing_endmodule.sv"),
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert f"source: {SV_FIXTURES / 'missing_endmodule.sv'}" in result.stdout
    assert "source-kind: check" in result.stdout
    assert "1 problem" in result.stdout
    assert "PCCX-SCAFFOLD-003" in result.stdout


def test_from_check_json_output_shape_is_stable():
    result = _run_cli(
        "problems",
        "from-check",
        str(SV_FIXTURES / "missing_endmodule.sv"),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert sorted(payload.keys()) == [
        "kind",
        "problems",
        "source",
        "source_kind",
        "tool",
    ]
    assert payload["kind"] == "editor-problems"
    assert payload["tool"] == "pccx-ide-cli"
    assert payload["source_kind"] == "check"
    assert sorted(payload["problems"][0].keys()) == [
        "code",
        "column",
        "file",
        "line",
        "message",
        "severity",
        "source_kind",
    ]


def test_from_check_invalid_format_fails_clearly():
    result = _run_cli(
        "problems",
        "from-check",
        str(SV_FIXTURES / "ok_module.sv"),
        "--format",
        "xml",
    )
    assert result.returncode != 0
    assert "invalid choice" in result.stderr


def test_from_check_missing_file_fails_clearly():
    result = _run_cli(
        "problems",
        "from-check",
        str(SV_FIXTURES / "does_not_exist.sv"),
        "--format",
        "json",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


@pytest.mark.parametrize("fixture", ["clean.log", "empty.log"])
def test_from_xsim_log_clean_or_empty_zero_problems_exit_zero(fixture: str):
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / fixture),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["problems"] == []


def test_from_xsim_log_mixed_produces_problems():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / "mixed.log"),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert len(payload["problems"]) == 5
    assert {p["source_kind"] for p in payload["problems"]} == {"xsim-log"}


def test_from_xsim_log_preserves_file_line_column():
    payload = json.loads(
        _run_cli(
            "problems",
            "from-xsim-log",
            str(XSIM_FIXTURES / "warnings.log"),
            "--format",
            "json",
        ).stdout
    )
    located = [p for p in payload["problems"] if p.get("file") == "src/warn.sv"]
    assert len(located) == 1
    assert located[0]["line"] == 7
    assert located[0]["column"] == 5


def test_from_xsim_log_preserves_bracket_code():
    payload = json.loads(
        _run_cli(
            "problems",
            "from-xsim-log",
            str(XSIM_FIXTURES / "errors.log"),
            "--format",
            "json",
        ).stdout
    )
    codes = {p.get("code") for p in payload["problems"]}
    assert "VRFC 10-1234" in codes


def test_from_xsim_log_unknown_lines_do_not_crash():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / "unknown_lines.log"),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert len(payload["problems"]) == 1
    assert payload["problems"][0]["severity"] == "info"


def test_from_xsim_log_text_includes_source_kind_count():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / "mixed.log"),
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert f"source: {XSIM_FIXTURES / 'mixed.log'}" in result.stdout
    assert "source-kind: xsim-log" in result.stdout
    assert "5 problems" in result.stdout
    assert "src/warn.sv:7:5: warning: implicit net created" in result.stdout


def test_from_xsim_log_json_output_shape_is_stable():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / "errors.log"),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert sorted(payload.keys()) == [
        "kind",
        "problems",
        "source",
        "source_kind",
        "tool",
    ]
    assert payload["kind"] == "editor-problems"
    assert payload["source_kind"] == "xsim-log"
    assert payload["source"] == str(XSIM_FIXTURES / "errors.log")
    assert any("raw" in p for p in payload["problems"])


def test_from_xsim_log_invalid_format_fails_clearly():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / "clean.log"),
        "--format",
        "xml",
    )
    assert result.returncode != 0
    assert "invalid choice" in result.stderr


def test_from_xsim_log_missing_log_fails_clearly():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        str(XSIM_FIXTURES / "missing.log"),
        "--format",
        "json",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_problem_conversion_sorts_deterministically():
    export = build_export(
        "xsim-log",
        "synthetic.log",
        [
            {
                "source_kind": "xsim-log",
                "severity": "warning",
                "message": "b",
                "file": "b.sv",
                "line": 2,
                "column": 1,
            },
            {
                "source_kind": "xsim-log",
                "severity": "error",
                "message": "a",
                "file": "a.sv",
                "line": 1,
                "column": 1,
            },
        ],
    )
    assert [p["file"] for p in export["problems"]] == ["a.sv", "b.sv"]


def test_helper_from_check_envelope():
    envelope = scan_file(SV_FIXTURES / "missing_endmodule.sv")
    problems = from_check_envelope(envelope)
    assert problems[0]["source_kind"] == "check"
    assert problems[0]["file"] == str(SV_FIXTURES / "missing_endmodule.sv")


def test_helper_from_xsim_log_envelope():
    envelope = parse_log_file(XSIM_FIXTURES / "errors.log")
    problems = from_xsim_log_envelope(envelope)
    assert any(p.get("raw") for p in problems)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

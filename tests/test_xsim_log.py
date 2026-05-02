from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
FIXTURES = REPO_ROOT / "fixtures" / "xsim"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.xsim_log import build_envelope, parse_line, parse_text  # noqa: E402


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


def test_empty_log_exits_zero_with_zero_diagnostics():
    result = _run_cli("xsim-log", str(FIXTURES / "empty.log"), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["diagnostics"] == []


def test_clean_log_exits_zero_with_zero_diagnostics():
    result = _run_cli("xsim-log", str(FIXTURES / "clean.log"), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "xsim-log"
    assert payload["diagnostics"] == []


def test_one_error_line():
    record = parse_line("ERROR: syntax error")
    assert record is not None
    assert record["severity"] == "error"
    assert record["message"] == "syntax error"
    assert record["raw_line"] == "ERROR: syntax error"


def test_one_warning_line():
    record = parse_line("WARNING: signal has no driver")
    assert record is not None
    assert record["severity"] == "warning"
    assert record["message"] == "signal has no driver"


def test_one_info_line():
    record = parse_line("INFO: elaboration started")
    assert record is not None
    assert record["severity"] == "info"
    assert record["message"] == "elaboration started"


def test_mixed_error_warning_info():
    records = parse_text((FIXTURES / "mixed.log").read_text(encoding="utf-8"))
    assert [r["severity"] for r in records] == [
        "info",
        "warning",
        "error",
        "warning",
        "error",
    ]


def test_file_line_parsing():
    record = parse_line("src/top.sv:12: error: module declaration failed")
    assert record is not None
    assert record["file"] == "src/top.sv"
    assert record["line"] == 12
    assert "column" not in record
    assert record["severity"] == "error"


def test_file_line_column_parsing():
    record = parse_line("src/warn.sv:7:5: warning: implicit net created")
    assert record is not None
    assert record["file"] == "src/warn.sv"
    assert record["line"] == 7
    assert record["column"] == 5
    assert record["severity"] == "warning"


def test_bracket_code_parsing():
    record = parse_line("ERROR: [VRFC 10-1234] syntax error near token ';'")
    assert record is not None
    assert record["severity"] == "error"
    assert record["code"] == "VRFC 10-1234"
    assert record["message"] == "syntax error near token ';'"


def test_bracket_code_parsing_after_file_location():
    record = parse_line("src/top.sv:12: error: [VRFC 10-1234] failed")
    assert record is not None
    assert record["code"] == "VRFC 10-1234"
    assert record["message"] == "failed"


def test_unknown_lines_do_not_crash():
    records = parse_text((FIXTURES / "unknown_lines.log").read_text(encoding="utf-8"))
    assert len(records) == 1
    assert records[0]["severity"] == "info"


def test_missing_log_path_exits_nonzero():
    result = _run_cli("xsim-log", str(FIXTURES / "missing.log"), "--format", "json")
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_invalid_format_exits_nonzero():
    result = _run_cli("xsim-log", str(FIXTURES / "clean.log"), "--format", "xml")
    assert result.returncode != 0
    assert "invalid choice" in result.stderr


def test_text_output_includes_source_count_message():
    result = _run_cli("xsim-log", str(FIXTURES / "mixed.log"), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert f"source: {FIXTURES / 'mixed.log'}" in result.stdout
    assert "5 diagnostics" in result.stdout
    assert "elaboration started" in result.stdout
    assert "src/top.sv:12: error: module declaration failed" in result.stdout


def test_json_output_shape_is_stable():
    result = _run_cli("xsim-log", str(FIXTURES / "errors.log"), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert sorted(payload.keys()) == ["diagnostics", "kind", "source", "tool"]
    assert payload["tool"] == "pccx-ide-cli"
    assert payload["kind"] == "xsim-log"
    assert payload["source"] == str(FIXTURES / "errors.log")
    assert len(payload["diagnostics"]) == 2
    assert sorted(payload["diagnostics"][0].keys()) == [
        "code",
        "message",
        "raw_line",
        "severity",
    ]
    assert sorted(payload["diagnostics"][1].keys()) == [
        "file",
        "line",
        "message",
        "raw_line",
        "severity",
    ]


def test_build_envelope_shape():
    envelope = build_envelope("synthetic.log", [])
    assert envelope == {
        "diagnostics": [],
        "kind": "xsim-log",
        "source": "synthetic.log",
        "tool": "pccx-ide-cli",
    }


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

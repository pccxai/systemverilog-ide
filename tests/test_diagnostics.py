from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import jsonschema
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
SCHEMA_PATH = REPO_ROOT / "schema" / "diagnostics-v0.json"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.diagnostics import scan_file, scan_text  # noqa: E402

_SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = jsonschema.Draft202012Validator(_SCHEMA)


def _assert_conforms(envelope: dict) -> None:
    errors = list(_VALIDATOR.iter_errors(envelope))
    assert not errors, "\n".join(str(e) for e in errors)


# ── existing behavioural tests ────────────────────────────────────────────────

def test_ok_fixture_has_no_diagnostics():
    env = scan_file(REPO_ROOT / "fixtures" / "ok_module.sv")
    assert env["envelope"] == "0"
    assert env["diagnostics"] == []


def test_missing_endmodule_flagged():
    env = scan_file(REPO_ROOT / "fixtures" / "missing_endmodule.sv")
    codes = {d["code"] for d in env["diagnostics"]}
    assert "PCCX-SCAFFOLD-003" in codes


def test_empty_file_flagged():
    env = scan_text("", "<empty>")
    codes = {d["code"] for d in env["diagnostics"]}
    assert "PCCX-SCAFFOLD-001" in codes


def test_no_module_flagged():
    env = scan_text("// just a comment\n", "<comment-only>")
    codes = {d["code"] for d in env["diagnostics"]}
    assert "PCCX-SCAFFOLD-002" in codes


def test_missing_path_flagged():
    env = scan_file(REPO_ROOT / "fixtures" / "does_not_exist.sv")
    codes = {d["code"] for d in env["diagnostics"]}
    assert "PCCX-SCAFFOLD-000" in codes


# ── schema-conformance tests ──────────────────────────────────────────────────

@pytest.mark.parametrize(
    "source,text",
    [
        ("ok", (REPO_ROOT / "fixtures" / "ok_module.sv").read_text()),
        ("missing_endmodule", (REPO_ROOT / "fixtures" / "missing_endmodule.sv").read_text()),
        ("empty_sv", (REPO_ROOT / "fixtures" / "empty.sv").read_text()),
        ("empty_str", ""),
        ("comment_only", "// just a comment\n"),
        ("nonexistent", None),  # triggers scan_file path
    ],
)
def test_envelope_conforms_to_schema(source: str, text):
    if text is None:
        envelope = scan_file(REPO_ROOT / "fixtures" / "does_not_exist.sv")
    else:
        envelope = scan_text(text, source)
    _assert_conforms(envelope)


def test_scan_file_ok_conforms():
    _assert_conforms(scan_file(REPO_ROOT / "fixtures" / "ok_module.sv"))


def test_scan_file_missing_endmodule_conforms():
    _assert_conforms(scan_file(REPO_ROOT / "fixtures" / "missing_endmodule.sv"))


def test_scan_file_empty_fixture_conforms():
    _assert_conforms(scan_file(REPO_ROOT / "fixtures" / "empty.sv"))


# ── CLI tests ─────────────────────────────────────────────────────────────────

def _run_cli(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", *args],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(SRC),
            "PATH": __import__("os").environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_check_smoke():
    result = _run_cli("check", str(REPO_ROOT / "fixtures" / "ok_module.sv"))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["envelope"] == "0"
    assert payload["diagnostics"] == []


def test_cli_check_json_conforms():
    for fixture in ("ok_module.sv", "missing_endmodule.sv", "empty.sv"):
        result = _run_cli("check", str(REPO_ROOT / "fixtures" / fixture))
        payload = json.loads(result.stdout)
        _assert_conforms(payload)


def test_cli_check_text_format():
    result = _run_cli(
        "check",
        "--format", "text",
        str(REPO_ROOT / "fixtures" / "missing_endmodule.sv"),
    )
    assert result.returncode != 0
    assert "backend: scaffold" in result.stdout
    assert "1 diagnostic" in result.stdout
    assert "PCCX-SCAFFOLD-003" in result.stdout
    assert "error" in result.stdout


def test_cli_check_text_ok_exits_zero():
    result = _run_cli(
        "check",
        "--format", "text",
        str(REPO_ROOT / "fixtures" / "ok_module.sv"),
    )
    assert result.returncode == 0
    assert "backend: scaffold" in result.stdout
    assert "0 diagnostics" in result.stdout


def test_cli_check_text_includes_column():
    result = _run_cli(
        "check",
        "--format", "text",
        str(REPO_ROOT / "fixtures" / "missing_endmodule.sv"),
    )
    # diagnostic lines must be path:line:col: severity: code: message
    diag_lines = [
        ln for ln in result.stdout.splitlines()
        if "PCCX-SCAFFOLD" in ln
    ]
    assert diag_lines, "expected at least one diagnostic line"
    # column field present: path:L:C: ...
    assert diag_lines[0].count(":") >= 4


def test_cli_schema_smoke():
    result = _run_cli("schema")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["title"].startswith("pccx IDE diagnostics envelope")


def test_cli_schema_is_valid_json_schema():
    result = _run_cli("schema")
    payload = json.loads(result.stdout)
    jsonschema.Draft202012Validator.check_schema(payload)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

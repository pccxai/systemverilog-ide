from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.diagnostics import scan_file, scan_text  # noqa: E402


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


def test_cli_check_smoke():
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pccx_ide_cli",
            "check",
            str(REPO_ROOT / "fixtures" / "ok_module.sv"),
        ],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(SRC),
            "PATH": __import__("os").environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["envelope"] == "0"
    assert payload["diagnostics"] == []


def test_cli_schema_smoke():
    result = subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", "schema"],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(SRC),
            "PATH": __import__("os").environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["title"].startswith("pccx IDE diagnostics envelope")


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

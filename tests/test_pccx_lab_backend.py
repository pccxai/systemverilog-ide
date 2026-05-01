from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
from pathlib import Path

import jsonschema
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
SCHEMA_PATH = REPO_ROOT / "schema" / "diagnostics-v0.json"

_SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
_VALIDATOR = jsonschema.Draft202012Validator(_SCHEMA)


def _assert_conforms(envelope: dict) -> None:
    errors = list(_VALIDATOR.iter_errors(envelope))
    assert not errors, "\n".join(str(e) for e in errors)


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_fake_binary(tmp_path: Path, stdout: str, exit_code: int, name: str = "fake_pccx_lab") -> Path:
    """Create an executable Python script that prints stdout and exits exit_code.

    Uses sys.executable (absolute path) as shebang so the script works even
    when the subprocess is given a restricted PATH.
    """
    script = tmp_path / name
    script.write_text(
        f"#!{sys.executable}\n"
        "import sys\n"
        f"sys.stdout.write({stdout!r})\n"
        f"sys.exit({exit_code})\n",
        encoding="utf-8",
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return script


def _run_cli(*args: str, extra_env: dict | None = None) -> subprocess.CompletedProcess:
    env: dict[str, str] = {
        "PYTHONPATH": str(SRC),
        "PATH": os.environ.get("PATH", ""),
    }
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", *args],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


# ── pre-built envelopes used across tests ─────────────────────────────────────

_CLEAN_ENVELOPE = json.dumps({
    "envelope": "0",
    "tool": "pccx-lab",
    "source": "ok_module.sv",
    "diagnostics": [],
}) + "\n"

_DIAG_ENVELOPE = json.dumps({
    "envelope": "0",
    "tool": "pccx-lab",
    "source": "missing_endmodule.sv",
    "diagnostics": [
        {
            "line": 1,
            "column": 1,
            "severity": "error",
            "code": "PCCX-SCAFFOLD-003",
            "message": "module declaration found but `endmodule` is missing",
            "source": "pccx-lab",
        }
    ],
}) + "\n"

_NOTE_ENVELOPE = json.dumps({
    "_note": "Early example — not a stable API contract.",
    "envelope": "0",
    "tool": "pccx-lab",
    "source": "ok_module.sv",
    "diagnostics": [],
}) + "\n"

_ZERO_LINE_ENVELOPE = json.dumps({
    "envelope": "0",
    "tool": "pccx-lab",
    "source": "some.sv",
    "diagnostics": [
        {
            "line": 0,
            "column": 0,
            "severity": "error",
            "code": "PCCX-IO-001",
            "message": "cannot read file: no such file or directory",
            "source": "pccx-lab",
        }
    ],
}) + "\n"

_IO_ERROR_ENVELOPE = json.dumps({
    "envelope": "0",
    "tool": "pccx-lab",
    "source": "/nonexistent.sv",
    "diagnostics": [
        {
            "line": 1,
            "column": 1,
            "severity": "error",
            "code": "PCCX-IO-001",
            "message": "cannot read file: no such file or directory",
            "source": "pccx-lab",
        }
    ],
}) + "\n"

_UNKNOWN_FIELD_ENVELOPE = json.dumps({
    "envelope": "0",
    "tool": "pccx-lab",
    "source": "ok.sv",
    "diagnostics": [],
    "unexpected_field": "schema_must_reject_this",
}) + "\n"


# ── default scaffold still works ──────────────────────────────────────────────

def test_scaffold_default_unchanged():
    """Existing default backend is unaffected by adding --backend."""
    result = _run_cli("check", str(REPO_ROOT / "fixtures" / "ok_module.sv"))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["envelope"] == "0"
    assert payload["diagnostics"] == []


def test_scaffold_explicit_flag_unchanged():
    """--backend scaffold is identical to the default."""
    result = _run_cli(
        "check",
        "--backend", "scaffold",
        str(REPO_ROOT / "fixtures" / "ok_module.sv"),
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["diagnostics"] == []


def test_scaffold_missing_endmodule_still_flagged():
    result = _run_cli(
        "check",
        "--backend", "scaffold",
        str(REPO_ROOT / "fixtures" / "missing_endmodule.sv"),
    )
    assert result.returncode != 0
    codes = {d["code"] for d in json.loads(result.stdout)["diagnostics"]}
    assert "PCCX-SCAFFOLD-003" in codes


# ── missing binary: fail clearly, no silent fallback ─────────────────────────

def test_missing_binary_no_env_no_path(tmp_path):
    """No PCCX_LAB_BIN, pccx-lab absent from PATH → non-zero, no scaffold output."""
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        str(REPO_ROOT / "fixtures" / "ok_module.sv"),
        extra_env={
            "PCCX_LAB_BIN": "",          # empty treated as unset
            "PATH": str(tmp_path),        # tmp dir has no pccx-lab binary
        },
    )
    assert result.returncode != 0
    assert "PCCX-SCAFFOLD" not in result.stdout
    assert result.stderr.strip() != ""


def test_missing_binary_env_nonexistent(tmp_path):
    """PCCX_LAB_BIN points to nonexistent path → non-zero, no scaffold output."""
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        str(REPO_ROOT / "fixtures" / "ok_module.sv"),
        extra_env={
            "PCCX_LAB_BIN": str(tmp_path / "no_such_binary"),
        },
    )
    assert result.returncode != 0
    assert "PCCX-SCAFFOLD" not in result.stdout


# ── fake binary: PCCX_LAB_BIN takes priority over PATH ───────────────────────

def test_pccx_lab_bin_takes_priority(tmp_path):
    """PCCX_LAB_BIN is honoured before PATH when both are set."""
    fake = _make_fake_binary(tmp_path, _CLEAN_ENVELOPE, 0)
    # PATH points to a directory with a pccx-lab that would exit 99 if run
    path_dir = tmp_path / "pathdir"
    path_dir.mkdir()
    decoy = path_dir / "pccx-lab"
    decoy.write_text(f"#!{sys.executable}\nimport sys\nsys.exit(99)\n")
    decoy.chmod(decoy.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={
            "PCCX_LAB_BIN": str(fake),
            "PATH": str(path_dir),
        },
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["diagnostics"] == []


# ── fake binary: clean envelope → exit 0 ─────────────────────────────────────

def test_clean_envelope_exits_zero(tmp_path):
    fake = _make_fake_binary(tmp_path, _CLEAN_ENVELOPE, 0)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["envelope"] == "0"
    assert payload["tool"] == "pccx-lab"
    assert payload["diagnostics"] == []
    _assert_conforms(payload)


# ── fake binary: diagnostics envelope → exit 1 ───────────────────────────────

def test_diagnostics_envelope_exits_one(tmp_path):
    fake = _make_fake_binary(tmp_path, _DIAG_ENVELOPE, 1)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/missing_endmodule.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode == 1, result.stderr
    payload = json.loads(result.stdout)
    codes = {d["code"] for d in payload["diagnostics"]}
    assert "PCCX-SCAFFOLD-003" in codes
    _assert_conforms(payload)


# ── fake binary: invalid JSON → fail clearly ─────────────────────────────────

def test_invalid_json_fails_clearly(tmp_path):
    fake = _make_fake_binary(tmp_path, "this is not json at all\n", 0)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode != 0
    assert "json" in result.stderr.lower()
    assert "PCCX-SCAFFOLD" not in result.stdout


# ── adapter: _note field stripped ────────────────────────────────────────────

def test_note_field_stripped(tmp_path):
    """_note is stripped; output conforms to schema."""
    fake = _make_fake_binary(tmp_path, _NOTE_ENVELOPE, 0)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert "_note" not in payload
    _assert_conforms(payload)


# ── adapter: line/column 0 clamped to 1 ──────────────────────────────────────

def test_zero_line_column_clamped(tmp_path):
    """line=0 / column=0 are clamped to 1; output conforms to schema."""
    fake = _make_fake_binary(tmp_path, _ZERO_LINE_ENVELOPE, 1)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode == 1, result.stderr
    payload = json.loads(result.stdout)
    for d in payload["diagnostics"]:
        assert d["line"] >= 1, f"line should be >=1, got {d['line']}"
        assert d["column"] >= 1, f"column should be >=1, got {d['column']}"
    _assert_conforms(payload)


# ── adapter: unknown top-level field (not _note) → schema rejects ────────────

def test_unknown_field_rejected(tmp_path):
    """Unknown top-level fields beyond _note cause schema validation failure."""
    fake = _make_fake_binary(tmp_path, _UNKNOWN_FIELD_ENVELOPE, 0)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode != 0
    assert "PCCX-SCAFFOLD" not in result.stdout


# ── exit code passthrough ─────────────────────────────────────────────────────

def test_exit_code_2_passthrough(tmp_path):
    """pccx-lab exit code 2 (I/O error) passes through to CLI exit code."""
    fake = _make_fake_binary(tmp_path, _IO_ERROR_ENVELOPE, 2)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "fixtures/ok_module.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode == 2, f"expected 2, got {result.returncode}"
    payload = json.loads(result.stdout)
    _assert_conforms(payload)


# ── text format works with pccx-lab backend ───────────────────────────────────

def test_text_format_with_pccx_lab_backend(tmp_path):
    """--format text emits human-readable lines when using pccx-lab backend."""
    fake = _make_fake_binary(tmp_path, _DIAG_ENVELOPE, 1)
    result = _run_cli(
        "check",
        "--backend", "pccx-lab",
        "--format", "text",
        "fixtures/missing_endmodule.sv",
        extra_env={"PCCX_LAB_BIN": str(fake)},
    )
    assert result.returncode == 1
    assert "PCCX-SCAFFOLD-003" in result.stdout
    assert "error" in result.stdout


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

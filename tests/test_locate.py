from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
FIXTURES = REPO_ROOT / "fixtures" / "modules"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.module_index import filter_modules, locate_module, scan_path  # noqa: E402


# ── helpers ───────────────────────────────────────────────────────────────────

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


# ── unit: filter_modules ──────────────────────────────────────────────────────

def test_filter_modules_exact_match():
    mods = scan_path(FIXTURES / "simple_module.sv")
    filtered = filter_modules(mods, "simple_mod")
    assert len(filtered) == 1
    assert filtered[0]["name"] == "simple_mod"


def test_filter_modules_no_match_returns_empty():
    mods = scan_path(FIXTURES / "simple_module.sv")
    filtered = filter_modules(mods, "nonexistent_mod")
    assert filtered == []


def test_filter_modules_case_sensitive():
    mods = scan_path(FIXTURES / "simple_module.sv")
    # "simple_mod" exists; "Simple_Mod" does not
    assert filter_modules(mods, "simple_mod") != []
    assert filter_modules(mods, "Simple_Mod") == []


def test_filter_modules_preserves_order():
    mods = scan_path(FIXTURES)
    # two_modules.sv has mod_a and mod_b; filter to mod_a only
    filtered = filter_modules(mods, "mod_a")
    assert all(m["name"] == "mod_a" for m in filtered)
    # sorted order preserved (file, line, name)
    keys = [(m["file"], m["line"], m["name"]) for m in filtered]
    assert keys == sorted(keys)


# ── unit: locate_module ───────────────────────────────────────────────────────

def test_locate_module_one_match_shape():
    # Use a single file so there is exactly one simple_mod declaration.
    matches = locate_module(FIXTURES / "simple_module.sv", "simple_mod")
    assert len(matches) == 1
    m = matches[0]
    assert m["module"] == "simple_mod"
    assert "file" in m
    assert m["line"] == 1
    assert m["column"] == 0


def test_locate_module_no_match_returns_empty():
    matches = locate_module(FIXTURES / "simple_module.sv", "no_such_mod")
    assert matches == []


def test_locate_module_multiple_matches():
    # FIXTURES dir contains both simple_module.sv and dup_simple_mod.sv,
    # both declaring simple_mod.
    matches = locate_module(FIXTURES, "simple_mod")
    assert len(matches) >= 2
    assert all(m["module"] == "simple_mod" for m in matches)


def test_locate_module_sorted_by_file_then_line():
    matches = locate_module(FIXTURES, "simple_mod")
    keys = [(m["file"], m["line"]) for m in matches]
    assert keys == sorted(keys)


def test_locate_module_column_is_zero():
    matches = locate_module(FIXTURES / "simple_module.sv", "simple_mod")
    assert all(m["column"] == 0 for m in matches)


def test_locate_module_directory_recursive():
    # nested_dir/child_module.sv declares child_mod
    matches = locate_module(FIXTURES, "child_mod")
    assert len(matches) == 1
    assert matches[0]["module"] == "child_mod"


# ── CLI: index --query ────────────────────────────────────────────────────────

def test_cli_index_query_exact_match_json():
    result = _run_cli(
        "index", str(FIXTURES / "simple_module.sv"),
        "--query", "simple_mod", "--format", "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-index"
    assert len(payload["modules"]) == 1
    assert payload["modules"][0]["name"] == "simple_mod"


def test_cli_index_query_no_match_json_exit_zero():
    result = _run_cli(
        "index", str(FIXTURES / "simple_module.sv"),
        "--query", "nonexistent", "--format", "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["modules"] == []


def test_cli_index_query_no_match_text_says_zero_modules():
    result = _run_cli(
        "index", str(FIXTURES / "simple_module.sv"),
        "--query", "nonexistent", "--format", "text",
    )
    assert result.returncode == 0
    assert "0 modules" in result.stdout


def test_cli_index_query_case_sensitive():
    # "simple_mod" matches; "Simple_Mod" does not
    result_lower = _run_cli(
        "index", str(FIXTURES / "simple_module.sv"),
        "--query", "simple_mod",
    )
    result_upper = _run_cli(
        "index", str(FIXTURES / "simple_module.sv"),
        "--query", "Simple_Mod",
    )
    assert json.loads(result_lower.stdout)["modules"] != []
    assert json.loads(result_upper.stdout)["modules"] == []


def test_cli_index_query_directory_filtered():
    # Directory scan; only simple_mod should survive the filter
    result = _run_cli(
        "index", str(FIXTURES), "--query", "simple_mod", "--format", "json",
    )
    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert all(m["name"] == "simple_mod" for m in payload["modules"])
    assert len(payload["modules"]) >= 1


# ── CLI: locate ───────────────────────────────────────────────────────────────

def test_cli_locate_one_match_json():
    result = _run_cli(
        "locate", str(FIXTURES / "simple_module.sv"), "simple_mod",
        "--format", "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "locate"
    assert payload["tool"] == "pccx-ide-cli"
    assert payload["source"] == "line-scanner"
    assert payload["query"] == "simple_mod"
    assert len(payload["matches"]) == 1
    m = payload["matches"][0]
    assert m["module"] == "simple_mod"
    assert "file" in m
    assert isinstance(m["line"], int)
    assert m["column"] == 0


def test_cli_locate_one_match_text():
    result = _run_cli(
        "locate", str(FIXTURES / "simple_module.sv"), "simple_mod",
        "--format", "text",
    )
    assert result.returncode == 0, result.stderr
    lines = result.stdout.splitlines()
    assert lines[0] == "module simple_mod"
    # second line: file:line:0
    assert lines[1].endswith(":1:0")


def test_cli_locate_no_match_exit_1():
    result = _run_cli(
        "locate", str(FIXTURES / "simple_module.sv"), "no_such_mod",
        "--format", "json",
    )
    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["matches"] == []
    assert "not found" in result.stderr.lower() or "not found" in result.stdout.lower()


def test_cli_locate_multiple_matches_exit_2():
    # FIXTURES dir has both simple_module.sv and dup_simple_mod.sv → ambiguous
    result = _run_cli(
        "locate", str(FIXTURES), "simple_mod", "--format", "json",
    )
    assert result.returncode == 2
    payload = json.loads(result.stdout)
    assert len(payload["matches"]) >= 2
    assert all(m["module"] == "simple_mod" for m in payload["matches"])


def test_cli_locate_multiple_matches_text_lists_all():
    result = _run_cli(
        "locate", str(FIXTURES), "simple_mod", "--format", "text",
    )
    assert result.returncode == 2
    # At least 2 file:line:0 lines expected
    colon_lines = [ln for ln in result.stdout.splitlines() if ln.endswith(":0")]
    assert len(colon_lines) >= 2


def test_cli_locate_directory_recursive():
    result = _run_cli(
        "locate", str(FIXTURES), "child_mod", "--format", "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert len(payload["matches"]) == 1
    assert payload["matches"][0]["module"] == "child_mod"


def test_cli_locate_missing_path_exits_nonzero():
    result = _run_cli(
        "locate", str(FIXTURES / "does_not_exist.sv"), "simple_mod",
    )
    assert result.returncode != 0
    assert result.stderr.strip() != ""


def test_cli_locate_invalid_format_exits_nonzero():
    result = _run_cli(
        "locate", str(FIXTURES / "simple_module.sv"), "simple_mod",
        "--format", "xml",
    )
    assert result.returncode != 0


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

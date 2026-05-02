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

from pccx_ide_cli.module_index import (  # noqa: E402
    build_declarations_export,
    build_index,
    scan_file,
    scan_path,
)
from pccx_ide_cli.module_index import _strip_block_comments  # noqa: E402


# ── unit: _strip_block_comments helper ───────────────────────────────────────

def test_strip_single_line_block_comment():
    visible, in_cmt = _strip_block_comments("/* module fake; */", False)
    assert "module" not in visible
    assert in_cmt is False


def test_strip_block_comment_opens_does_not_close():
    visible, in_cmt = _strip_block_comments("/* module fake;", False)
    assert "module" not in visible
    assert in_cmt is True


def test_strip_block_comment_closes():
    visible, in_cmt = _strip_block_comments(" * module fake; */", True)
    assert "module" not in visible
    assert in_cmt is False


def test_strip_no_comment_passthrough():
    line = "module real_mod;"
    visible, in_cmt = _strip_block_comments(line, False)
    assert visible == line
    assert in_cmt is False


def test_strip_inline_comment_then_module():
    # Block comment before module on same line — visible retains rest of line
    visible, in_cmt = _strip_block_comments("/* hdr */ module real_mod;", False)
    assert "real_mod" in visible
    assert in_cmt is False


# ── unit: single-file scanning ────────────────────────────────────────────────

def test_single_file_one_module():
    mods = scan_file(FIXTURES / "simple_module.sv")
    assert len(mods) == 1
    assert mods[0]["kind"] == "module"
    assert mods[0]["name"] == "simple_mod"
    assert mods[0]["line"] == 1
    assert mods[0]["column"] == 1


def test_two_modules_both_found():
    mods = scan_file(FIXTURES / "two_modules.sv")
    names = [m["name"] for m in mods]
    assert "mod_a" in names
    assert "mod_b" in names


def test_two_modules_ordered_by_line():
    mods = scan_file(FIXTURES / "two_modules.sv")
    assert mods[0]["name"] == "mod_a"
    assert mods[1]["name"] == "mod_b"
    assert mods[0]["line"] < mods[1]["line"]


def test_no_module_file_returns_empty():
    mods = scan_file(FIXTURES / "no_module.sv")
    assert mods == []


def test_commented_module_ignored():
    mods = scan_file(FIXTURES / "commented_module.sv")
    names = [m["name"] for m in mods]
    assert "real_mod" in names
    assert "fake_mod" not in names


def test_indented_module_real_column():
    mods = scan_file(FIXTURES / "indented_module.sv")
    assert len(mods) == 1
    assert mods[0]["name"] == "indented_mod"
    assert mods[0]["column"] == 5  # 4 leading spaces → `module` at col 5


def test_single_line_block_comment_fake_ignored():
    mods = scan_file(FIXTURES / "block_comment_module.sv")
    names = [m["name"] for m in mods]
    assert "block_fake_mod" not in names
    assert "block_real_mod" in names


def test_multiline_block_comment_fake_ignored():
    mods = scan_file(FIXTURES / "multiline_block_comment.sv")
    names = [m["name"] for m in mods]
    assert "multi_fake_mod" not in names
    assert "after_block_mod" in names


def test_real_module_after_block_comment_found():
    mods = scan_file(FIXTURES / "multiline_block_comment.sv")
    assert any(m["name"] == "after_block_mod" for m in mods)


def test_v_extension_scanned():
    mods = scan_file(FIXTURES / "nested_dir" / "extra_v_mod.v")
    assert len(mods) == 1
    assert mods[0]["kind"] == "module"
    assert mods[0]["name"] == "extra_v_mod"


def test_package_declaration_found():
    declarations = scan_file(FIXTURES / "package_decl.sv")
    assert declarations == [
        {
            "kind": "package",
            "name": "util_pkg",
            "file": str(FIXTURES / "package_decl.sv"),
            "line": 1,
            "column": 1,
        }
    ]


def test_interface_declaration_found():
    declarations = scan_file(FIXTURES / "interface_decl.sv")
    assert len(declarations) == 1
    assert declarations[0]["kind"] == "interface"
    assert declarations[0]["name"] == "bus_if"
    assert declarations[0]["line"] == 1
    assert declarations[0]["column"] == 1


def test_mixed_declarations_found():
    declarations = scan_file(FIXTURES / "mixed_declarations.sv")
    kinds_names = [(d["kind"], d["name"]) for d in declarations]
    assert kinds_names == [
        ("package", "mixed_pkg"),
        ("interface", "mixed_if"),
        ("module", "mixed_mod"),
    ]


def test_commented_package_interface_ignored():
    declarations = scan_file(FIXTURES / "commented_package_interface.sv")
    names = {d["name"] for d in declarations}
    assert "commented_pkg" not in names
    assert "commented_if" not in names
    assert "block_pkg" not in names
    assert "block_if" not in names
    assert "real_pkg" in names
    assert "real_if" in names


# ── unit: directory scanning ──────────────────────────────────────────────────

def test_scan_directory_finds_all_modules():
    mods = scan_path(FIXTURES)
    names = {m["name"] for m in mods}
    assert "simple_mod" in names
    assert "mod_a" in names
    assert "mod_b" in names
    assert "child_mod" in names
    assert "real_mod" in names
    assert "extra_v_mod" in names
    assert "indented_mod" in names
    assert "block_real_mod" in names
    assert "after_block_mod" in names
    assert "util_pkg" in names
    assert "bus_if" in names
    assert "mixed_pkg" in names
    assert "mixed_if" in names
    assert "mixed_mod" in names
    assert "real_pkg" in names
    assert "real_if" in names
    # block-commented fakes must not appear
    assert "fake_mod" not in names
    assert "block_fake_mod" not in names
    assert "multi_fake_mod" not in names
    assert "block_pkg" not in names
    assert "block_if" not in names


def test_scan_directory_deterministic():
    assert scan_path(FIXTURES) == scan_path(FIXTURES)


def test_scan_directory_sorted():
    mods = scan_path(FIXTURES)
    keys = [(m["file"], m["line"], m["name"]) for m in mods]
    assert keys == sorted(keys)


# ── unit: build_index shape ───────────────────────────────────────────────────

def test_build_index_shape():
    mods = scan_file(FIXTURES / "simple_module.sv")
    idx = build_index("fixtures/modules/simple_module.sv", mods)
    assert idx["tool"] == "pccx-ide-scaffold"
    assert idx["kind"] == "module-index"
    assert idx["source"] == "fixtures/modules/simple_module.sv"
    assert idx["declarations"] == mods
    assert len(idx["modules"]) == 1


def test_build_index_module_record_fields():
    mods = scan_file(FIXTURES / "simple_module.sv")
    assert all(
        {"name", "file", "line", "column"} <= set(m.keys()) for m in mods
    )


def test_build_index_keeps_legacy_modules_shape():
    declarations = scan_file(FIXTURES / "mixed_declarations.sv")
    idx = build_index("fixtures/modules/mixed_declarations.sv", declarations)
    assert [d["kind"] for d in idx["declarations"]] == [
        "package",
        "interface",
        "module",
    ]
    assert idx["modules"] == [
        {
            "name": "mixed_mod",
            "file": str(FIXTURES / "mixed_declarations.sv"),
            "line": 7,
            "column": 1,
        }
    ]


def test_build_declarations_export_shape():
    declarations = scan_file(FIXTURES / "mixed_declarations.sv")
    export = build_declarations_export(
        "fixtures/modules/mixed_declarations.sv",
        declarations,
    )
    assert export["tool"] == "pccx-ide-cli"
    assert export["kind"] == "declarations"
    assert export["source"] == "fixtures/modules/mixed_declarations.sv"
    assert export["declarations"] == declarations


# ── CLI helpers ───────────────────────────────────────────────────────────────

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


# ── CLI: JSON output ──────────────────────────────────────────────────────────

def test_cli_index_json_single_file():
    result = _run_cli("index", str(FIXTURES / "simple_module.sv"))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-index"
    assert payload["tool"] == "pccx-ide-scaffold"
    assert len(payload["modules"]) == 1
    assert payload["modules"][0]["name"] == "simple_mod"


def test_cli_index_json_no_module_exits_zero():
    result = _run_cli("index", str(FIXTURES / "no_module.sv"))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["modules"] == []


def test_cli_index_json_directory():
    result = _run_cli("index", str(FIXTURES))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    names = {m["name"] for m in payload["modules"]}
    declaration_names = {d["name"] for d in payload["declarations"]}
    assert "simple_mod" in names
    assert "child_mod" in names
    assert "extra_v_mod" in names
    assert "fake_mod" not in names
    assert "util_pkg" in declaration_names
    assert "bus_if" in declaration_names


def test_cli_index_json_has_required_keys():
    result = _run_cli("index", str(FIXTURES / "simple_module.sv"))
    payload = json.loads(result.stdout)
    assert {"kind", "tool", "source", "modules", "declarations"} <= payload.keys()


def test_cli_index_json_package_interface_shape():
    result = _run_cli("index", str(FIXTURES / "mixed_declarations.sv"))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    declarations = payload["declarations"]
    assert [d["kind"] for d in declarations] == ["package", "interface", "module"]
    assert {d["name"] for d in declarations} == {
        "mixed_pkg",
        "mixed_if",
        "mixed_mod",
    }
    assert [m["name"] for m in payload["modules"]] == ["mixed_mod"]


# ── CLI: text output ──────────────────────────────────────────────────────────

def test_cli_index_text_single_file():
    result = _run_cli("index", "--format", "text", str(FIXTURES / "simple_module.sv"))
    assert result.returncode == 0, result.stderr
    assert "source:" in result.stdout
    assert "1 module" in result.stdout
    assert "simple_mod" in result.stdout


def test_cli_index_text_no_module():
    result = _run_cli("index", "--format", "text", str(FIXTURES / "no_module.sv"))
    assert result.returncode == 0
    assert "0 modules" in result.stdout


def test_cli_index_text_two_modules():
    result = _run_cli("index", "--format", "text", str(FIXTURES / "two_modules.sv"))
    assert result.returncode == 0
    assert "2 modules" in result.stdout
    assert "mod_a" in result.stdout
    assert "mod_b" in result.stdout


def test_cli_index_text_mixed_declarations_includes_kind():
    result = _run_cli(
        "index", "--format", "text", str(FIXTURES / "mixed_declarations.sv")
    )
    assert result.returncode == 0
    assert "3 declarations" in result.stdout
    assert "package mixed_pkg" in result.stdout
    assert "interface mixed_if" in result.stdout
    assert "module mixed_mod" in result.stdout


def test_cli_index_text_format_has_path_line_col():
    result = _run_cli("index", "--format", "text", str(FIXTURES / "simple_module.sv"))
    # Diagnostic lines have the form: path:line:col: module <name>
    diag_lines = [ln for ln in result.stdout.splitlines() if "module simple_mod" in ln]
    assert diag_lines, "expected a diagnostic line containing 'module simple_mod'"
    # path:line:col: module name  →  at least 3 colons
    assert diag_lines[0].count(":") >= 3


def test_cli_declarations_json_directory():
    result = _run_cli("declarations", str(FIXTURES), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "declarations"
    assert payload["tool"] == "pccx-ide-cli"
    assert payload["source"] == str(FIXTURES)
    kinds_names = {(d["kind"], d["name"]) for d in payload["declarations"]}
    assert ("module", "simple_mod") in kinds_names
    assert ("package", "pkg_defs") in kinds_names
    assert ("interface", "bus_if") in kinds_names


def test_cli_declarations_text_directory():
    result = _run_cli("declarations", str(FIXTURES), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "source:" in result.stdout
    assert "declarations" in result.stdout
    assert "package pkg_defs" in result.stdout
    assert "interface bus_if" in result.stdout
    assert "module simple_mod" in result.stdout


def test_cli_declarations_missing_path_exits_nonzero():
    result = _run_cli("declarations", str(FIXTURES / "does_not_exist.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_declarations_invalid_format_fails():
    result = _run_cli("declarations", str(FIXTURES), "--format", "xml")
    assert result.returncode != 0
    assert "invalid choice" in result.stderr


# ── CLI: error cases ──────────────────────────────────────────────────────────

def test_cli_index_missing_path_exits_nonzero():
    result = _run_cli("index", str(FIXTURES / "does_not_exist.sv"))
    assert result.returncode != 0
    assert result.stderr.strip() != ""


def test_cli_existing_check_still_works():
    result = _run_cli("check", str(REPO_ROOT / "fixtures" / "ok_module.sv"))
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["envelope"] == "0"


def test_cli_index_query_package_json_exit_zero():
    result = _run_cli("index", str(FIXTURES), "--query", "util_pkg", "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["modules"] == []
    assert len(payload["declarations"]) == 1
    assert payload["declarations"][0]["kind"] == "package"
    assert payload["declarations"][0]["name"] == "util_pkg"


def test_cli_index_query_interface_text():
    result = _run_cli("index", str(FIXTURES), "--query", "bus_if", "--format", "text")
    assert result.returncode == 0
    assert "1 declaration" in result.stdout
    assert "interface bus_if" in result.stdout


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))

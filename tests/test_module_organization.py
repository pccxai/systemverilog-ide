# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
FIXTURE = REPO_ROOT / "fixtures" / "organization" / "hierarchy_top.sv"
CONTRACT_DOC = REPO_ROOT / "docs" / "EDITOR_BRIDGE_CONTRACT.md"
WORKFLOW_DOC = REPO_ROOT / "docs" / "MODULE_ORGANIZATION_WORKFLOW.md"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.module_organization import (  # noqa: E402
    build_module_organization_export,
    format_module_organization_text,
)


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


def test_build_module_organization_export_boundaries():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    assert export["kind"] == "module-organization"
    assert export["tool"] == "pccx-ide-cli"
    assert export["scanner"] == "line-scanner"

    modules = {module["name"]: module for module in export["modules"]}
    assert set(modules) == {"leaf_mod", "top_mod"}
    assert modules["leaf_mod"]["complete"] is True
    assert modules["leaf_mod"]["start_line"] == 4
    assert modules["leaf_mod"]["end_line"] == 7
    assert modules["leaf_mod"]["span_lines"] == 4
    assert modules["top_mod"]["complete"] is True
    assert modules["top_mod"]["start_line"] == 9
    assert modules["top_mod"]["end_line"] == 15


def test_build_module_organization_export_hierarchy_seed():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    assert export["hierarchy"]["roots"] == ["top_mod"]
    assert export["hierarchy"]["unresolved"] == []
    assert export["hierarchy"]["edges"] == [
        {
            "child": "leaf_mod",
            "column": 5,
            "file": str(FIXTURE),
            "instance": "u_leaf",
            "line": 12,
            "parent": "top_mod",
            "resolved": True,
        }
    ]


def test_build_module_organization_export_refactoring_is_proposal_only():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    assert export["refactoring"]["mode"] == "proposal-only"
    assert export["refactoring"]["writes_files"] is False
    assert "rename module" in export["refactoring"]["planned_helpers"]


def test_format_module_organization_text_mentions_boundary_and_hierarchy():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    text = format_module_organization_text(export)
    assert "2 modules" in text
    assert "module top_mod (complete)" in text
    assert "top_mod -> leaf_mod as u_leaf" in text
    assert "refactoring: proposal-only, no file writes" in text


def test_cli_organization_json():
    result = _run_cli("organization", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-organization"
    assert payload["source"] == str(FIXTURE)
    assert [edge["child"] for edge in payload["hierarchy"]["edges"]] == ["leaf_mod"]


def test_cli_organization_text():
    result = _run_cli("organization", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "source:" in result.stdout
    assert "2 modules" in result.stdout
    assert "1 hierarchy edge" in result.stdout


def test_cli_organization_missing_path_exits_nonzero():
    result = _run_cli("organization", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_docs_cover_organization_flow_and_limits():
    contract = CONTRACT_DOC.read_text(encoding="utf-8")
    workflow = WORKFLOW_DOC.read_text(encoding="utf-8")
    assert "organization <path>" in contract
    assert "MODULE_ORGANIZATION_WORKFLOW.md" in contract
    assert "proposal-only" in workflow
    assert "does not write files" in workflow
    assert "not a full SystemVerilog parser" in workflow

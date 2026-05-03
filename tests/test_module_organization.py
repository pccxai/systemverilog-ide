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
    build_module_dependency_view,
    build_module_hierarchy_view,
    build_module_organization_export,
    build_refactor_proposal,
    format_module_dependency_text,
    format_module_hierarchy_text,
    format_module_organization_text,
    format_refactor_proposal_text,
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


def test_build_module_hierarchy_view_tree_is_read_only():
    view = build_module_hierarchy_view(str(FIXTURE), FIXTURE)

    assert view["kind"] == "module-hierarchy-view"
    assert view["view_state"] == "available_as_data"
    assert view["module_count"] == 2
    assert view["edge_count"] == 1
    assert view["root_count"] == 1
    assert view["roots"][0]["name"] == "top_mod"
    assert [row["module"] for row in view["tree"]] == ["top_mod", "leaf_mod"]
    assert view["tree"][0]["depth"] == 0
    assert view["tree"][0]["state"] == "root"
    assert view["tree"][1]["depth"] == 1
    assert view["tree"][1]["state"] == "resolved"
    assert view["tree"][1]["via_instance"] == "u_leaf"
    assert view["safety"]["read_only"] is True
    assert view["safety"]["writes_files"] is False
    assert view["safety"]["applies_refactor"] is False
    assert view["safety"]["runs_validation"] is False
    assert view["safety"]["invokes_pccx_lab"] is False
    assert view["safety"]["invokes_launcher"] is False
    assert view["safety"]["provider_calls"] is False
    assert view["safety"]["hardware_access"] is False


def test_build_module_dependency_view_is_read_only():
    view = build_module_dependency_view(str(FIXTURE), FIXTURE)

    assert view["kind"] == "module-dependency-view"
    assert view["dependency_state"] == "available_as_data"
    assert view["module_count"] == 2
    assert view["edge_count"] == 1
    assert view["resolved_edge_count"] == 1
    assert view["unresolved_edge_count"] == 0
    assert view["edges"][0]["parent"] == "top_mod"
    assert view["edges"][0]["child"] == "leaf_mod"
    assert view["reverse_edges"] == [
        {
            "dependent": "top_mod",
            "file": str(FIXTURE),
            "instance": "u_leaf",
            "line": 12,
            "module": "leaf_mod",
        }
    ]

    impact = {row["module"]: row for row in view["impact"]}
    assert impact["top_mod"]["direct_dependencies"] == ["leaf_mod"]
    assert impact["top_mod"]["direct_dependency_count"] == 1
    assert impact["top_mod"]["direct_dependents"] == []
    assert impact["leaf_mod"]["direct_dependencies"] == []
    assert impact["leaf_mod"]["direct_dependents"] == ["top_mod"]
    assert impact["leaf_mod"]["direct_dependent_count"] == 1
    assert view["safety"]["read_only"] is True
    assert view["safety"]["writes_files"] is False
    assert view["safety"]["applies_refactor"] is False
    assert view["safety"]["runs_validation"] is False
    assert view["safety"]["invokes_pccx_lab"] is False
    assert view["safety"]["invokes_launcher"] is False
    assert view["safety"]["provider_calls"] is False
    assert view["safety"]["hardware_access"] is False


def test_build_module_organization_export_refactoring_is_proposal_only():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    assert export["refactoring"]["mode"] == "proposal-only"
    assert export["refactoring"]["writes_files"] is False
    assert "rename module" in export["refactoring"]["planned_helpers"]


def test_build_refactor_proposal_rename_is_review_only():
    proposal = build_refactor_proposal(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "top_mod",
        new_name="top_mod_next",
    )

    assert proposal["kind"] == "module-refactor-proposal"
    assert proposal["proposal_state"] == "proposal-only"
    assert proposal["writes_files"] is False
    assert proposal["preflight"]["status"] == "ready-for-review"
    assert proposal["requested_change"]["new_name"] == "top_mod_next"
    assert proposal["module"]["name"] == "top_mod"
    assert proposal["safety"]["applies_patch"] is False
    assert proposal["safety"]["runs_validation"] is False
    assert proposal["safety"]["invokes_pccx_lab"] is False
    assert proposal["safety"]["invokes_launcher"] is False


def test_build_refactor_proposal_blocks_missing_module():
    proposal = build_refactor_proposal(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "missing_mod",
        destination="rtl/missing_mod.sv",
    )

    assert proposal["preflight"]["status"] == "blocked"
    assert proposal["module"] is None
    assert "module not found: missing_mod" in proposal["preflight"]["reasons"]
    assert proposal["planned_steps"] == []


def test_build_refactor_proposal_extract_port_requires_direction():
    proposal = build_refactor_proposal(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="enable_i",
    )

    assert proposal["preflight"]["status"] == "blocked"
    assert "missing required direction" in proposal["preflight"]["reasons"]
    assert proposal["safety"]["writes_files"] is False


def test_format_module_organization_text_mentions_boundary_and_hierarchy():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    text = format_module_organization_text(export)
    assert "2 modules" in text
    assert "module top_mod (complete)" in text
    assert "top_mod -> leaf_mod as u_leaf" in text
    assert "refactoring: proposal-only, no file writes" in text


def test_format_module_hierarchy_text_mentions_tree_and_boundary():
    view = build_module_hierarchy_view(str(FIXTURE), FIXTURE)
    text = format_module_hierarchy_text(view)

    assert "hierarchy view: available_as_data" in text
    assert "top_mod (root)" in text
    assert "leaf_mod as u_leaf (resolved)" in text
    assert "read-only: no file writes" in text


def test_format_module_dependency_text_mentions_impact_and_boundary():
    view = build_module_dependency_view(str(FIXTURE), FIXTURE)
    text = format_module_dependency_text(view)

    assert "dependency view: available_as_data" in text
    assert "top_mod -> leaf_mod as u_leaf" in text
    assert "top_mod: dependencies=leaf_mod; dependents=none" in text
    assert "leaf_mod: dependencies=none; dependents=top_mod" in text
    assert "read-only: no file writes" in text


def test_format_refactor_proposal_text_mentions_no_execution():
    proposal = build_refactor_proposal(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_proposal_text(proposal)

    assert "action: move-module" in text
    assert "preflight: ready-for-review" in text
    assert "writes files: no" in text
    assert "no patch, validation, lab, launcher, provider, or hardware execution" in text


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


def test_cli_hierarchy_json():
    result = _run_cli("hierarchy", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-hierarchy-view"
    assert payload["tree"][0]["module"] == "top_mod"
    assert payload["tree"][1]["module"] == "leaf_mod"
    assert payload["safety"]["writes_files"] is False


def test_cli_hierarchy_text():
    result = _run_cli("hierarchy", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "hierarchy view: available_as_data" in result.stdout
    assert "leaf_mod as u_leaf (resolved)" in result.stdout


def test_cli_dependencies_json():
    result = _run_cli("dependencies", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-dependency-view"
    assert payload["impact"][0]["impact_state"] == "available_as_data"
    assert payload["safety"]["writes_files"] is False


def test_cli_dependencies_text():
    result = _run_cli("dependencies", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "dependency view: available_as_data" in result.stdout
    assert "leaf_mod: dependencies=none; dependents=top_mod" in result.stdout


def test_cli_refactor_plan_json():
    result = _run_cli(
        "refactor-plan",
        str(FIXTURE),
        "--action",
        "rename-module",
        "--module",
        "leaf_mod",
        "--new-name",
        "leaf_mod_next",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-refactor-proposal"
    assert payload["action"] == "rename-module"
    assert payload["preflight"]["status"] == "ready-for-review"
    assert payload["writes_files"] is False


def test_cli_refactor_plan_text():
    result = _run_cli(
        "refactor-plan",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--direction",
        "input",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "action: extract-port" in result.stdout
    assert "preflight: ready-for-review" in result.stdout
    assert "writes files: no" in result.stdout


def test_cli_organization_missing_path_exits_nonzero():
    result = _run_cli("organization", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_hierarchy_missing_path_exits_nonzero():
    result = _run_cli("hierarchy", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_dependencies_missing_path_exits_nonzero():
    result = _run_cli("dependencies", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_docs_cover_organization_flow_and_limits():
    contract = CONTRACT_DOC.read_text(encoding="utf-8")
    workflow = WORKFLOW_DOC.read_text(encoding="utf-8")
    assert "organization <path>" in contract
    assert "hierarchy <path>" in contract
    assert "dependencies <path>" in contract
    assert "MODULE_ORGANIZATION_WORKFLOW.md" in contract
    assert "proposal-only" in workflow
    assert "module-hierarchy-view" in workflow
    assert "module-dependency-view" in workflow
    assert "does not write files" in workflow
    assert "not a full SystemVerilog parser" in workflow

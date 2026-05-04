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
    build_module_context_bundle,
    build_module_hierarchy_view,
    build_module_organization_export,
    build_module_port_usage_view,
    build_module_summary_view,
    build_refactor_impact_view,
    build_refactor_proposal,
    build_refactor_review_packet,
    build_refactor_validation_plan,
    format_module_dependency_text,
    format_module_context_text,
    format_module_hierarchy_text,
    format_module_organization_text,
    format_module_port_usage_text,
    format_module_summary_text,
    format_refactor_impact_text,
    format_refactor_proposal_text,
    format_refactor_review_packet_text,
    format_refactor_validation_plan_text,
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


def test_build_module_summary_view_reports_ports_and_safety():
    view = build_module_summary_view(str(FIXTURE), FIXTURE)

    assert view["kind"] == "module-summary-view"
    assert view["summary_state"] == "available_as_data"
    assert view["module_count"] == 2
    assert view["port_count"] == 2
    modules = {module["name"]: module for module in view["modules"]}
    assert set(modules) == {"leaf_mod", "top_mod"}
    assert modules["leaf_mod"]["header"]["complete"] is True
    assert modules["leaf_mod"]["readiness"]["state"] == "ready-for-review"
    assert modules["leaf_mod"]["port_count"] == 1
    assert modules["leaf_mod"]["port_direction_counts"]["input"] == 1
    assert modules["leaf_mod"]["ports"] == [
        {
            "direction": "input",
            "line": 5,
            "name": "clk",
            "state": "detected",
            "width": None,
        }
    ]
    assert view["safety"]["read_only"] is True
    assert view["safety"]["writes_files"] is False
    assert view["safety"]["applies_refactor"] is False
    assert view["safety"]["runs_validation"] is False
    assert view["safety"]["invokes_pccx_lab"] is False
    assert view["safety"]["invokes_launcher"] is False
    assert view["safety"]["provider_calls"] is False
    assert view["safety"]["hardware_access"] is False


def test_build_module_summary_view_inherits_port_direction(tmp_path):
    source = tmp_path / "ports.sv"
    source.write_text(
        "\n".join([
            "module ported (",
            "    input logic [7:0] data_i,",
            "    valid_i,",
            "    output logic done_o",
            ");",
            "endmodule",
            "",
        ]),
        encoding="utf-8",
    )

    view = build_module_summary_view(str(source), source)
    module = view["modules"][0]
    ports = {port["name"]: port for port in module["ports"]}

    assert module["port_count"] == 3
    assert ports["data_i"]["direction"] == "input"
    assert ports["data_i"]["width"] == "[7:0]"
    assert ports["valid_i"]["direction"] == "input"
    assert ports["valid_i"]["state"] == "inherited-direction"
    assert ports["valid_i"]["width"] == "[7:0]"
    assert ports["done_o"]["direction"] == "output"
    assert ports["done_o"]["state"] == "detected"


def test_build_module_port_usage_view_reports_ports_and_usage_sites():
    view = build_module_port_usage_view(str(FIXTURE), FIXTURE, "leaf_mod")

    assert view["kind"] == "module-port-usage-view"
    assert view["usage_state"] == "available_as_data"
    assert view["target"] == "leaf_mod"
    assert view["preflight"]["status"] == "ready-for-review"
    assert view["writes_files"] is False
    assert view["module"]["name"] == "leaf_mod"
    assert view["port_count"] == 1
    assert view["ports"] == [
        {
            "direction": "input",
            "line": 5,
            "name": "clk",
            "state": "detected",
            "width": None,
        }
    ]
    assert view["direct_dependents"] == ["top_mod"]
    assert view["usage_site_count"] == 1
    assert view["usage_sites"] == [
        {
            "child": "leaf_mod",
            "column": 5,
            "connection_count": 1,
            "connection_names": ["clk"],
            "connection_style": "named",
            "file": str(FIXTURE),
            "instance": "u_leaf",
            "line": 12,
            "parent": "top_mod",
            "resolved": True,
            "scan_complete": True,
            "scan_line_count": 3,
            "scan_truncated": False,
            "semantically_resolved": False,
        }
    ]
    assert view["safety"]["read_only"] is True
    assert view["safety"]["writes_files"] is False
    assert view["safety"]["applies_refactor"] is False
    assert view["safety"]["applies_patch"] is False
    assert view["safety"]["runs_validation"] is False
    assert view["safety"]["invokes_pccx_lab"] is False
    assert view["safety"]["invokes_launcher"] is False
    assert view["safety"]["provider_calls"] is False
    assert view["safety"]["hardware_access"] is False


def test_build_module_port_usage_view_blocks_missing_module():
    view = build_module_port_usage_view(str(FIXTURE), FIXTURE, "missing_mod")

    assert view["preflight"]["status"] == "blocked"
    assert "module not found: missing_mod" in view["preflight"]["reasons"]
    assert view["module"] is None
    assert view["ports"] == []
    assert view["usage_sites"] == []
    assert view["writes_files"] is False


def test_build_module_context_bundle_summarizes_target_views():
    bundle = build_module_context_bundle(str(FIXTURE), FIXTURE, "leaf_mod")

    assert bundle["kind"] == "module-context-bundle"
    assert bundle["context_state"] == "available_as_data"
    assert bundle["target"] == "leaf_mod"
    assert bundle["preflight"]["status"] == "ready-for-review"
    assert bundle["writes_files"] is False
    assert bundle["module"]["name"] == "leaf_mod"
    assert bundle["summary_context"]["name"] == "leaf_mod"
    assert bundle["summary_context"]["port_count"] == 1
    assert bundle["dependency_context"]["direct_dependencies"] == []
    assert bundle["dependency_context"]["direct_dependents"] == ["top_mod"]
    assert bundle["dependency_context"]["unresolved_dependencies"] == []
    assert bundle["port_context"]["port_count"] == 1
    assert bundle["port_context"]["usage_site_count"] == 1
    assert bundle["refactor_context"]["review_target_count"] == 2
    assert [view["command"] for view in bundle["source_views"]] == [
        "module-summary",
        "dependencies",
        "port-usage",
        "refactor-impact",
    ]
    assert bundle["safety"]["read_only"] is True
    assert bundle["safety"]["writes_files"] is False
    assert bundle["safety"]["applies_refactor"] is False
    assert bundle["safety"]["applies_patch"] is False
    assert bundle["safety"]["runs_validation"] is False
    assert bundle["safety"]["invokes_pccx_lab"] is False
    assert bundle["safety"]["invokes_launcher"] is False
    assert bundle["safety"]["provider_calls"] is False
    assert bundle["safety"]["hardware_access"] is False


def test_build_module_context_bundle_blocks_missing_module():
    bundle = build_module_context_bundle(str(FIXTURE), FIXTURE, "missing_mod")

    assert bundle["context_state"] == "blocked"
    assert bundle["preflight"]["status"] == "blocked"
    assert "module not found: missing_mod" in bundle["preflight"]["reasons"]
    assert bundle["module"] is None
    assert bundle["summary_context"] is None
    assert bundle["port_context"]["ports"] == []
    assert bundle["refactor_context"]["review_targets"] == []
    assert bundle["writes_files"] is False


def test_build_refactor_impact_view_reports_target_references():
    view = build_refactor_impact_view(str(FIXTURE), FIXTURE, "leaf_mod")

    assert view["kind"] == "module-refactor-impact-view"
    assert view["impact_state"] == "available_as_data"
    assert view["target"] == "leaf_mod"
    assert view["preflight"]["status"] == "ready-for-review"
    assert view["writes_files"] is False
    assert view["module"]["name"] == "leaf_mod"
    assert view["direct_dependencies"] == []
    assert view["direct_dependents"] == ["top_mod"]
    assert view["dependent_edges"] == [
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
    assert [target["kind"] for target in view["review_targets"]] == [
        "module-declaration",
        "dependent-instantiation",
    ]
    assert view["safety"]["read_only"] is True
    assert view["safety"]["writes_files"] is False
    assert view["safety"]["applies_refactor"] is False
    assert view["safety"]["applies_patch"] is False
    assert view["safety"]["runs_validation"] is False
    assert view["safety"]["invokes_pccx_lab"] is False
    assert view["safety"]["invokes_launcher"] is False
    assert view["safety"]["provider_calls"] is False
    assert view["safety"]["hardware_access"] is False


def test_build_refactor_impact_view_blocks_missing_module():
    view = build_refactor_impact_view(str(FIXTURE), FIXTURE, "missing_mod")

    assert view["preflight"]["status"] == "blocked"
    assert "module not found: missing_mod" in view["preflight"]["reasons"]
    assert view["module"] is None
    assert view["review_targets"] == []
    assert view["writes_files"] is False


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


def test_build_refactor_validation_plan_is_proposal_only():
    plan = build_refactor_validation_plan(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert plan["kind"] == "module-refactor-validation-plan"
    assert plan["validation_state"] == "proposal-only"
    assert plan["preflight"]["status"] == "ready-for-review"
    assert plan["writes_files"] is False
    assert plan["refactor_proposal"]["requested_change"]["new_name"] == "leaf_mod_next"
    assert plan["review_context"]["review_target_count"] == 2
    assert plan["command_descriptor_count"] == 8
    groups = {group["phase"]: group for group in plan["validation_groups"]}
    assert groups["pre-change-review"]["command_count"] == 3
    assert groups["post-change-local-validation"]["command_count"] == 5
    locate_command = groups["post-change-local-validation"]["commands"][-1]
    assert locate_command["id"] == "locate-new-module"
    assert locate_command["argv"] == [
        "python",
        "-m",
        "pccx_ide_cli",
        "locate",
        str(FIXTURE),
        "leaf_mod_next",
        "--kind",
        "module",
        "--format",
        "json",
    ]
    assert locate_command["state"] == "proposed-not-run"
    assert locate_command["shell"] is False
    assert plan["safety"]["read_only"] is True
    assert plan["safety"]["emits_command_descriptors"] is True
    assert plan["safety"]["runs_validation"] is False
    assert plan["safety"]["runs_shell"] is False
    assert plan["safety"]["invokes_pccx_lab"] is False
    assert plan["safety"]["invokes_launcher"] is False
    assert plan["safety"]["hardware_access"] is False


def test_build_refactor_validation_plan_blocks_post_change_commands():
    plan = build_refactor_validation_plan(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert plan["validation_state"] == "blocked"
    assert "missing required direction" in plan["preflight"]["reasons"]
    groups = {group["phase"]: group for group in plan["validation_groups"]}
    assert groups["pre-change-review"]["command_count"] == 3
    assert groups["post-change-local-validation"]["status"] == "blocked"
    assert groups["post-change-local-validation"]["commands"] == []
    assert groups["post-change-local-validation"]["blocked_by"] == [
        "missing required direction"
    ]


def test_build_refactor_review_packet_summarizes_existing_views():
    packet = build_refactor_review_packet(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert packet["kind"] == "module-refactor-review-packet"
    assert packet["packet_state"] == "proposal-only"
    assert packet["review_state"] == "ready-for-review"
    assert packet["preflight"]["status"] == "ready-for-review"
    assert packet["writes_files"] is False
    assert packet["proposal_summary"]["requested_change"]["new_name"] == "leaf_mod_next"
    assert packet["proposal_summary"]["planned_step_count"] == 4
    assert packet["context_summary"] == {
        "context_state": "available_as_data",
        "direct_dependency_count": 0,
        "direct_dependent_count": 1,
        "port_count": 1,
        "review_target_count": 2,
        "summary_available": True,
        "summary_readiness": "ready-for-review",
        "unresolved_dependency_count": 0,
        "usage_site_count": 1,
    }
    assert packet["validation_summary"]["command_descriptor_count"] == 8
    phases = {phase["phase"]: phase for phase in packet["validation_summary"]["phases"]}
    assert phases["pre-change-review"]["command_ids"] == [
        "module-context",
        "refactor-impact",
        "refactor-plan",
    ]
    assert phases["post-change-local-validation"]["command_ids"][-1] == (
        "locate-new-module"
    )
    assert packet["safety"]["read_only"] is True
    assert packet["safety"]["summarizes_command_descriptors"] is True
    assert packet["safety"]["emits_command_descriptors"] is False
    assert packet["safety"]["writes_files"] is False
    assert packet["safety"]["runs_validation"] is False
    assert packet["safety"]["runs_shell"] is False
    assert packet["safety"]["invokes_pccx_lab"] is False
    assert packet["safety"]["invokes_launcher"] is False
    assert packet["safety"]["hardware_access"] is False


def test_build_refactor_review_packet_reports_blocked_state():
    packet = build_refactor_review_packet(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert packet["review_state"] == "blocked"
    assert "missing required direction" in packet["preflight"]["reasons"]
    phases = {phase["phase"]: phase for phase in packet["validation_summary"]["phases"]}
    assert phases["pre-change-review"]["command_ids"] == [
        "module-context",
        "refactor-impact",
        "refactor-plan",
    ]
    assert phases["post-change-local-validation"]["status"] == "blocked"
    assert phases["post-change-local-validation"]["command_ids"] == []


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


def test_format_module_summary_text_mentions_ports_and_boundary():
    view = build_module_summary_view(str(FIXTURE), FIXTURE)
    text = format_module_summary_text(view)

    assert "module summary: available_as_data" in text
    assert "2 ports" in text
    assert "module leaf_mod (complete header, ready-for-review)" in text
    assert "input clk at line 5 (detected)" in text
    assert "read-only: no file writes" in text


def test_format_module_port_usage_text_mentions_usage_and_no_execution():
    view = build_module_port_usage_view(str(FIXTURE), FIXTURE, "leaf_mod")
    text = format_module_port_usage_text(view)

    assert "port usage: available_as_data" in text
    assert "preflight: ready-for-review" in text
    assert "input clk at line 5 (detected)" in text
    assert "top_mod instantiates leaf_mod as u_leaf" in text
    assert "named connections: clk" in text
    assert "writes files: no" in text
    assert "read-only: no file writes" in text


def test_format_module_context_text_mentions_context_and_no_execution():
    bundle = build_module_context_bundle(str(FIXTURE), FIXTURE, "leaf_mod")
    text = format_module_context_text(bundle)

    assert "module context: available_as_data" in text
    assert "preflight: ready-for-review" in text
    assert "summary: 1 port; ready-for-review" in text
    assert "dependents: top_mod" in text
    assert "port usage: 1 site" in text
    assert "review targets: 2" in text
    assert "writes files: no" in text
    assert "read-only: no file writes" in text


def test_format_refactor_impact_text_mentions_references_and_no_execution():
    view = build_refactor_impact_view(str(FIXTURE), FIXTURE, "leaf_mod")
    text = format_refactor_impact_text(view)

    assert "refactor impact: available_as_data" in text
    assert "preflight: ready-for-review" in text
    assert "dependents: top_mod" in text
    assert "top_mod instantiates leaf_mod as u_leaf" in text
    assert "writes files: no" in text
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


def test_format_refactor_validation_plan_text_mentions_no_execution():
    plan = build_refactor_validation_plan(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_validation_plan_text(plan)

    assert "validation plan: proposal-only" in text
    assert "pre-change-review: proposal-only" in text
    assert "post-change-local-validation: proposal-only" in text
    assert "organization-destination:" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "no validation, shell, refactor, patch, file write" in text


def test_format_refactor_review_packet_text_mentions_summary_only_boundary():
    packet = build_refactor_review_packet(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )
    text = format_refactor_review_packet_text(packet)

    assert "review packet: proposal-only" in text
    assert "review state: ready-for-review" in text
    assert "validation descriptors: 8" in text
    assert "validation phase: pre-change-review" in text
    assert "module-context, refactor-impact, refactor-plan" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "summary-only: no command argv" in text


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


def test_cli_module_summary_json():
    result = _run_cli("module-summary", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-summary-view"
    assert payload["port_count"] == 2
    assert payload["modules"][0]["ports"][0]["name"] == "clk"
    assert payload["safety"]["writes_files"] is False


def test_cli_module_summary_text():
    result = _run_cli("module-summary", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module summary: available_as_data" in result.stdout
    assert "input clk at line 5 (detected)" in result.stdout


def test_cli_port_usage_json():
    result = _run_cli(
        "port-usage",
        str(FIXTURE),
        "--module",
        "leaf_mod",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-port-usage-view"
    assert payload["target"] == "leaf_mod"
    assert payload["port_count"] == 1
    assert payload["usage_sites"][0]["connection_names"] == ["clk"]
    assert payload["safety"]["writes_files"] is False


def test_cli_port_usage_text():
    result = _run_cli(
        "port-usage",
        str(FIXTURE),
        "--module",
        "leaf_mod",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "port usage: available_as_data" in result.stdout
    assert "top_mod instantiates leaf_mod as u_leaf" in result.stdout


def test_cli_module_context_json():
    result = _run_cli(
        "module-context",
        str(FIXTURE),
        "--module",
        "leaf_mod",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-context-bundle"
    assert payload["target"] == "leaf_mod"
    assert payload["summary_context"]["port_count"] == 1
    assert payload["dependency_context"]["direct_dependents"] == ["top_mod"]
    assert payload["port_context"]["usage_site_count"] == 1
    assert payload["refactor_context"]["review_target_count"] == 2
    assert payload["safety"]["writes_files"] is False


def test_cli_module_context_text():
    result = _run_cli(
        "module-context",
        str(FIXTURE),
        "--module",
        "leaf_mod",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "module context: available_as_data" in result.stdout
    assert "dependents: top_mod" in result.stdout


def test_cli_refactor_impact_json():
    result = _run_cli(
        "refactor-impact",
        str(FIXTURE),
        "--module",
        "leaf_mod",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-refactor-impact-view"
    assert payload["target"] == "leaf_mod"
    assert payload["direct_dependents"] == ["top_mod"]
    assert payload["safety"]["writes_files"] is False


def test_cli_refactor_impact_text():
    result = _run_cli(
        "refactor-impact",
        str(FIXTURE),
        "--module",
        "leaf_mod",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "refactor impact: available_as_data" in result.stdout
    assert "top_mod instantiates leaf_mod as u_leaf" in result.stdout


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


def test_cli_validation_plan_json():
    result = _run_cli(
        "validation-plan",
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
    assert payload["kind"] == "module-refactor-validation-plan"
    assert payload["validation_state"] == "proposal-only"
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["runs_validation"] is False


def test_cli_validation_plan_text():
    result = _run_cli(
        "validation-plan",
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
    assert "validation plan: proposal-only" in result.stdout
    assert "runs validation: no" in result.stdout
    assert "port-usage:" in result.stdout


def test_cli_refactor_review_json():
    result = _run_cli(
        "refactor-review",
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
    assert payload["kind"] == "module-refactor-review-packet"
    assert payload["review_state"] == "ready-for-review"
    assert payload["context_summary"]["review_target_count"] == 2
    assert payload["validation_summary"]["command_descriptor_count"] == 8
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["runs_validation"] is False


def test_cli_refactor_review_text():
    result = _run_cli(
        "refactor-review",
        str(FIXTURE),
        "--action",
        "move-module",
        "--module",
        "leaf_mod",
        "--destination",
        "rtl/leaf_mod.sv",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "review packet: proposal-only" in result.stdout
    assert "review state: ready-for-review" in result.stdout
    assert "validation descriptors:" in result.stdout
    assert "summary-only: no command argv" in result.stdout


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


def test_cli_module_summary_missing_path_exits_nonzero():
    result = _run_cli("module-summary", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_port_usage_missing_path_exits_nonzero():
    result = _run_cli(
        "port-usage",
        str(FIXTURE.parent / "missing.sv"),
        "--module",
        "leaf_mod",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_refactor_impact_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-impact",
        str(FIXTURE.parent / "missing.sv"),
        "--module",
        "leaf_mod",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_module_context_missing_path_exits_nonzero():
    result = _run_cli(
        "module-context",
        str(FIXTURE.parent / "missing.sv"),
        "--module",
        "leaf_mod",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_validation_plan_missing_path_exits_nonzero():
    result = _run_cli(
        "validation-plan",
        str(FIXTURE.parent / "missing.sv"),
        "--action",
        "rename-module",
        "--module",
        "leaf_mod",
        "--new-name",
        "leaf_mod_next",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_refactor_review_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-review",
        str(FIXTURE.parent / "missing.sv"),
        "--action",
        "rename-module",
        "--module",
        "leaf_mod",
        "--new-name",
        "leaf_mod_next",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_docs_cover_organization_flow_and_limits():
    contract = CONTRACT_DOC.read_text(encoding="utf-8")
    workflow = WORKFLOW_DOC.read_text(encoding="utf-8")
    assert "organization <path>" in contract
    assert "hierarchy <path>" in contract
    assert "dependencies <path>" in contract
    assert "module-summary <path>" in contract
    assert "port-usage <path>" in contract
    assert "module-context <path>" in contract
    assert "refactor-impact <path>" in contract
    assert "validation-plan <path>" in contract
    assert "refactor-review <path>" in contract
    assert "MODULE_ORGANIZATION_WORKFLOW.md" in contract
    assert "proposal-only" in workflow
    assert "module-hierarchy-view" in workflow
    assert "module-dependency-view" in workflow
    assert "module-summary-view" in workflow
    assert "module-port-usage-view" in workflow
    assert "module-context-bundle" in workflow
    assert "module-refactor-impact-view" in workflow
    assert "module-refactor-validation-plan" in workflow
    assert "module-refactor-review-packet" in workflow
    assert "proposed-not-run" in workflow
    assert "summary-only review packet" in workflow
    assert "does not write files" in workflow
    assert "not a full SystemVerilog parser" in workflow

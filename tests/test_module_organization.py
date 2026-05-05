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
CYCLIC_FIXTURE = REPO_ROOT / "fixtures" / "organization" / "cyclic_hierarchy.sv"
DUPLICATE_FIXTURE = REPO_ROOT / "fixtures" / "organization" / "duplicate_modules.sv"
UNRESOLVED_FIXTURE = REPO_ROOT / "fixtures" / "organization" / "unresolved_instances.sv"
ORPHAN_FIXTURE = REPO_ROOT / "fixtures" / "organization" / "orphan_modules.sv"
FANOUT_FIXTURE = REPO_ROOT / "fixtures" / "organization" / "fanout_hierarchy.sv"
INCOMPLETE_FIXTURE = REPO_ROOT / "fixtures" / "missing_endmodule.sv"
CONTRACT_DOC = REPO_ROOT / "docs" / "EDITOR_BRIDGE_CONTRACT.md"
WORKFLOW_DOC = REPO_ROOT / "docs" / "MODULE_ORGANIZATION_WORKFLOW.md"

sys.path.insert(0, str(SRC))

from pccx_ide_cli.module_organization import (  # noqa: E402
    build_module_dependency_view,
    build_module_boundary_audit,
    build_module_context_bundle,
    build_module_depth_report,
    build_module_duplicate_report,
    build_module_fanin_report,
    build_module_fanout_report,
    build_module_graph_health_summary,
    build_module_hierarchy_cycle_report,
    build_module_hierarchy_view,
    build_module_leaf_candidate_report,
    build_module_orphan_candidate_report,
    build_module_organization_export,
    build_module_port_usage_view,
    build_module_root_candidate_report,
    build_module_summary_view,
    build_module_unresolved_instance_report,
    build_refactor_candidate_list,
    build_refactor_approval_decision,
    build_refactor_application_result,
    build_refactor_application_request,
    build_refactor_checklist_summary,
    build_refactor_handoff_summary,
    build_refactor_impact_view,
    build_refactor_proposal,
    build_refactor_readiness_summary,
    build_refactor_review_packet,
    build_refactor_session_status,
    build_refactor_validation_plan,
    format_refactor_approval_decision_text,
    format_refactor_application_result_text,
    format_refactor_application_request_text,
    format_refactor_checklist_summary_text,
    format_refactor_handoff_summary_text,
    format_refactor_session_status_text,
    format_module_boundary_audit_text,
    format_module_dependency_text,
    format_module_context_text,
    format_module_depth_report_text,
    format_module_duplicate_report_text,
    format_module_fanin_report_text,
    format_module_fanout_report_text,
    format_module_graph_health_summary_text,
    format_module_hierarchy_cycle_text,
    format_module_hierarchy_text,
    format_module_leaf_candidate_report_text,
    format_module_orphan_candidate_report_text,
    format_module_organization_text,
    format_module_port_usage_text,
    format_module_root_candidate_report_text,
    format_module_summary_text,
    format_module_unresolved_instance_report_text,
    format_refactor_candidate_list_text,
    format_refactor_impact_text,
    format_refactor_proposal_text,
    format_refactor_readiness_summary_text,
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


def test_build_module_boundary_audit_reports_complete_boundaries():
    audit = build_module_boundary_audit(str(FIXTURE), FIXTURE)

    assert audit["kind"] == "module-boundary-audit"
    assert audit["audit_state"] == "available_as_data"
    assert audit["refactor_readiness"] == "ready-for-review"
    assert audit["module_count"] == 2
    assert audit["complete_module_count"] == 2
    assert audit["incomplete_module_count"] == 0
    assert audit["blocked_reasons"] == []
    assert audit["boundary_state_counts"] == {
        "complete": 2,
        "incomplete": 0,
    }
    assert [row["name"] for row in audit["modules"]] == ["leaf_mod", "top_mod"]
    assert all(row["boundary_state"] == "complete" for row in audit["modules"])
    assert all(
        row["refactor_preflight_state"] == "ready-for-review"
        for row in audit["modules"]
    )
    assert audit["safety"]["read_only"] is True
    assert audit["safety"]["boundary_audit_only"] is True
    assert audit["safety"]["writes_files"] is False
    assert audit["safety"]["applies_refactor"] is False
    assert audit["safety"]["generates_patch"] is False
    assert audit["safety"]["runs_validation"] is False
    assert audit["safety"]["runs_shell"] is False
    assert audit["safety"]["invokes_pccx_lab"] is False
    assert audit["safety"]["invokes_launcher"] is False
    assert audit["safety"]["invokes_vendor_tools"] is False
    assert audit["safety"]["provider_calls"] is False
    assert audit["safety"]["hardware_access"] is False
    assert audit["writes_files"] is False


def test_build_module_boundary_audit_blocks_incomplete_boundaries():
    audit = build_module_boundary_audit(str(INCOMPLETE_FIXTURE), INCOMPLETE_FIXTURE)

    assert audit["refactor_readiness"] == "blocked"
    assert audit["module_count"] == 1
    assert audit["complete_module_count"] == 0
    assert audit["incomplete_module_count"] == 1
    assert audit["incomplete_modules"] == [
        {
            "file": str(INCOMPLETE_FIXTURE),
            "name": "bad_module",
            "reasons": ["missing endmodule for module: bad_module"],
            "start_line": 1,
        }
    ]
    assert audit["modules"][0]["boundary_state"] == "incomplete"
    assert audit["modules"][0]["refactor_preflight_state"] == "blocked"
    assert audit["modules"][0]["end_line"] is None
    assert audit["blocked_reasons"] == [
        "missing endmodule for module: bad_module"
    ]
    assert audit["writes_files"] is False


def test_build_module_duplicate_report_detects_ambiguous_names():
    report = build_module_duplicate_report(str(DUPLICATE_FIXTURE), DUPLICATE_FIXTURE)

    assert report["kind"] == "module-duplicate-report"
    assert report["report_state"] == "duplicates-detected"
    assert report["module_count"] == 3
    assert report["unique_module_name_count"] == 2
    assert report["duplicate_name_count"] == 1
    assert report["duplicate_declaration_count"] == 2
    assert report["duplicate_names"] == ["dup_mod"]
    assert report["blocked_reasons"] == ["ambiguous module name: dup_mod"]
    assert report["next_required_action"] == (
        "rename or disambiguate duplicate module declarations before refactor planning"
    )
    duplicate = report["duplicates"][0]
    assert duplicate["name"] == "dup_mod"
    assert duplicate["declaration_count"] == 2
    assert duplicate["refactor_preflight_state"] == "blocked"
    assert [location["start_line"] for location in duplicate["locations"]] == [4, 10]
    assert report["safety"]["read_only"] is True
    assert report["safety"]["duplicate_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_duplicate_report_allows_unique_names():
    report = build_module_duplicate_report(str(FIXTURE), FIXTURE)

    assert report["report_state"] == "no-duplicates-detected"
    assert report["duplicate_name_count"] == 0
    assert report["duplicate_declaration_count"] == 0
    assert report["duplicates"] == []
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == "continue module organization and refactor review"


def test_build_refactor_candidate_list_reports_action_enablement():
    candidates = build_refactor_candidate_list(str(FIXTURE), FIXTURE)

    assert candidates["kind"] == "module-refactor-candidate-list"
    assert candidates["candidate_state"] == "available_as_data"
    assert candidates["module_count"] == 2
    assert candidates["ready_module_count"] == 2
    assert candidates["blocked_module_count"] == 0
    assert candidates["action_count"] == 3
    assert candidates["blocked_reasons"] == []
    assert [action["action"] for action in candidates["actions"]] == [
        "rename-module",
        "extract-port",
        "move-module",
    ]
    leaf = candidates["candidates"][0]
    assert leaf["module"]["name"] == "leaf_mod"
    assert leaf["candidate_state"] == "ready-for-request"
    assert leaf["blocked_reasons"] == []
    actions = {action["action"]: action for action in leaf["actions"]}
    assert actions["rename-module"]["required_inputs"] == ["new_name"]
    assert actions["extract-port"]["required_inputs"] == [
        "port_name",
        "direction",
    ]
    assert actions["extract-port"]["optional_inputs"] == ["width"]
    assert actions["move-module"]["required_inputs"] == ["destination"]
    assert all(action["proposal_only"] is True for action in leaf["actions"])
    assert all(action["writes_files"] is False for action in leaf["actions"])
    assert all(action["applies_refactor"] is False for action in leaf["actions"])
    assert candidates["safety"]["read_only"] is True
    assert candidates["safety"]["candidate_metadata_only"] is True
    assert candidates["safety"]["action_enablement_only"] is True
    assert candidates["safety"]["emits_command_descriptors"] is False
    assert candidates["safety"]["writes_files"] is False
    assert candidates["safety"]["applies_refactor"] is False
    assert candidates["safety"]["runs_validation"] is False
    assert candidates["safety"]["runs_shell"] is False
    assert candidates["safety"]["invokes_pccx_lab"] is False
    assert candidates["safety"]["invokes_launcher"] is False
    assert candidates["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(candidates)


def test_build_refactor_candidate_list_blocks_incomplete_boundaries():
    candidates = build_refactor_candidate_list(
        str(INCOMPLETE_FIXTURE),
        INCOMPLETE_FIXTURE,
    )

    assert candidates["candidate_state"] == "available_as_data"
    assert candidates["ready_module_count"] == 0
    assert candidates["blocked_module_count"] == 1
    assert candidates["blocked_reasons"] == [
        "module boundary is incomplete: bad_module"
    ]
    candidate = candidates["candidates"][0]
    assert candidate["candidate_state"] == "blocked"
    assert candidate["blocked_reasons"] == [
        "module boundary is incomplete: bad_module"
    ]
    assert all(action["state"] == "blocked" for action in candidate["actions"])
    assert all(
        action["blocked_reasons"] == [
            "module boundary is incomplete: bad_module"
        ]
        for action in candidate["actions"]
    )
    assert candidates["writes_files"] is False


def test_build_refactor_readiness_summary_reports_request_readiness():
    summary = build_refactor_readiness_summary(str(FIXTURE), FIXTURE)

    assert summary["kind"] == "module-refactor-readiness-summary"
    assert summary["readiness_state"] == "ready-for-request"
    assert summary["ready_for_request"] is True
    assert summary["module_count"] == 2
    assert summary["complete_module_count"] == 2
    assert summary["incomplete_module_count"] == 0
    assert summary["ready_module_count"] == 2
    assert summary["blocked_module_count"] == 0
    assert summary["blocked_reasons"] == []
    assert summary["next_required_action"] == (
        "choose a proposal-only refactor action and create a reviewed refactor-plan"
    )
    assert [card["card_id"] for card in summary["status_cards"]] == [
        "boundary-audit",
        "candidate-list",
    ]
    assert summary["safety"]["read_only"] is True
    assert summary["safety"]["readiness_summary_only"] is True
    assert summary["safety"]["combines_boundary_audit"] is True
    assert summary["safety"]["combines_candidate_list"] is True
    assert summary["safety"]["selects_refactor_action"] is False
    assert summary["safety"]["captures_requested_inputs"] is False
    assert summary["safety"]["emits_command_descriptors"] is False
    assert summary["safety"]["writes_files"] is False
    assert summary["safety"]["applies_refactor"] is False
    assert summary["safety"]["runs_validation"] is False
    assert summary["safety"]["runs_shell"] is False
    assert summary["safety"]["invokes_pccx_lab"] is False
    assert summary["safety"]["invokes_launcher"] is False
    assert summary["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(summary)


def test_build_refactor_readiness_summary_blocks_incomplete_boundaries():
    summary = build_refactor_readiness_summary(
        str(INCOMPLETE_FIXTURE),
        INCOMPLETE_FIXTURE,
    )

    assert summary["readiness_state"] == "blocked"
    assert summary["ready_for_request"] is False
    assert summary["module_count"] == 1
    assert summary["complete_module_count"] == 0
    assert summary["incomplete_module_count"] == 1
    assert summary["ready_module_count"] == 0
    assert summary["blocked_module_count"] == 1
    assert summary["blocked_reasons"] == [
        "missing endmodule for module: bad_module",
        "module boundary is incomplete: bad_module",
    ]
    assert summary["next_required_action"] == (
        "resolve scanner boundary blockers before requesting refactor plans"
    )
    assert summary["writes_files"] is False


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


def test_build_module_hierarchy_cycle_report_detects_cycles():
    report = build_module_hierarchy_cycle_report(
        str(CYCLIC_FIXTURE),
        CYCLIC_FIXTURE,
    )

    assert report["kind"] == "module-hierarchy-cycle-report"
    assert report["cycle_state"] == "cycles-detected"
    assert report["has_cycles"] is True
    assert report["module_count"] == 2
    assert report["edge_count"] == 2
    assert report["resolved_edge_count"] == 2
    assert report["cycle_count"] == 1
    assert report["cycles"][0]["cycle_id"] == "cycle-1"
    assert report["cycles"][0]["module_path"] == [
        "alpha_mod",
        "beta_mod",
        "alpha_mod",
    ]
    assert report["cycles"][0]["summary"] == "alpha_mod -> beta_mod -> alpha_mod"
    assert [edge["instance"] for edge in report["cycles"][0]["edges"]] == [
        "u_beta",
        "u_alpha",
    ]
    assert report["blocked_reasons"] == [
        "scanner-detected hierarchy cycle: alpha_mod -> beta_mod -> alpha_mod"
    ]
    assert report["next_required_action"] == (
        "review scanner-detected hierarchy cycles before refactor planning"
    )
    assert report["safety"]["read_only"] is True
    assert report["safety"]["cycle_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_hierarchy_cycle_report_allows_acyclic_hierarchy():
    report = build_module_hierarchy_cycle_report(str(FIXTURE), FIXTURE)

    assert report["cycle_state"] == "no-cycles-detected"
    assert report["has_cycles"] is False
    assert report["cycle_count"] == 0
    assert report["cycles"] == []
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == "continue hierarchy and refactor review"


def test_build_module_unresolved_instance_report_detects_missing_modules():
    report = build_module_unresolved_instance_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )

    assert report["kind"] == "module-unresolved-instance-report"
    assert report["report_state"] == "unresolved-instances-detected"
    assert report["has_unresolved_instances"] is True
    assert report["module_count"] == 1
    assert report["edge_count"] == 1
    assert report["resolved_edge_count"] == 0
    assert report["unresolved_instance_count"] == 1
    assert report["unresolved_module_count"] == 1
    assert report["unresolved_modules"] == ["missing_child"]
    assert report["blocked_reasons"] == [
        "unresolved module instantiation: missing_child as u_missing in unresolved_top"
    ]
    assert report["next_required_action"] == (
        "resolve scanner-detected unresolved instantiations before refactor planning"
    )
    instance = report["unresolved_instances"][0]
    assert instance["unresolved_id"] == "unresolved-1"
    assert instance["target_module"] == "missing_child"
    assert instance["parent"] == "unresolved_top"
    assert instance["instance"] == "u_missing"
    assert instance["file"] == str(UNRESOLVED_FIXTURE)
    assert instance["line"] == 5
    assert instance["column"] == 5
    assert instance["resolution_state"] == "unresolved"
    assert instance["refactor_preflight_state"] == "blocked"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["unresolved_instance_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_unresolved_instance_report_allows_resolved_hierarchy():
    report = build_module_unresolved_instance_report(str(FIXTURE), FIXTURE)

    assert report["report_state"] == "no-unresolved-instances-detected"
    assert report["has_unresolved_instances"] is False
    assert report["unresolved_instance_count"] == 0
    assert report["unresolved_module_count"] == 0
    assert report["unresolved_instances"] == []
    assert report["unresolved_modules"] == []
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == "continue hierarchy and refactor review"


def test_build_module_root_candidate_report_detects_top_modules():
    report = build_module_root_candidate_report(str(FIXTURE), FIXTURE)

    assert report["kind"] == "module-root-candidate-report"
    assert report["report_state"] == "roots-detected"
    assert report["module_count"] == 2
    assert report["edge_count"] == 1
    assert report["resolved_edge_count"] == 1
    assert report["unresolved_edge_count"] == 0
    assert report["root_count"] == 1
    assert report["root_names"] == ["top_mod"]
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "review scanner-detected root candidates for top-level organization"
    )
    root = report["roots"][0]
    assert root["name"] == "top_mod"
    assert root["file"] == str(FIXTURE)
    assert root["start_line"] == 9
    assert root["start_column"] == 1
    assert root["complete"] is True
    assert root["declaration_count"] == 1
    assert root["direct_dependencies"] == ["leaf_mod"]
    assert root["direct_dependency_count"] == 1
    assert root["unresolved_dependencies"] == []
    assert root["unresolved_dependency_count"] == 0
    assert root["refactor_preflight_state"] == "ready-for-review"
    assert root["reason"] == "not instantiated by another resolved module"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["root_candidate_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_root_candidate_report_blocks_when_no_roots_detected():
    report = build_module_root_candidate_report(str(CYCLIC_FIXTURE), CYCLIC_FIXTURE)

    assert report["report_state"] == "no-roots-detected"
    assert report["root_count"] == 0
    assert report["root_names"] == []
    assert report["roots"] == []
    assert report["blocked_reasons"] == ["no root candidates detected"]
    assert report["next_required_action"] == (
        "resolve hierarchy blockers before root-candidate review"
    )


def test_build_module_leaf_candidate_report_detects_leaf_modules():
    report = build_module_leaf_candidate_report(str(FIXTURE), FIXTURE)

    assert report["kind"] == "module-leaf-candidate-report"
    assert report["report_state"] == "leaves-detected"
    assert report["module_count"] == 2
    assert report["edge_count"] == 1
    assert report["resolved_edge_count"] == 1
    assert report["unresolved_edge_count"] == 0
    assert report["leaf_count"] == 1
    assert report["leaf_names"] == ["leaf_mod"]
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "review scanner-detected leaf candidates for dependency-end organization"
    )
    leaf = report["leaves"][0]
    assert leaf["name"] == "leaf_mod"
    assert leaf["file"] == str(FIXTURE)
    assert leaf["start_line"] == 4
    assert leaf["start_column"] == 1
    assert leaf["complete"] is True
    assert leaf["declaration_count"] == 1
    assert leaf["direct_dependents"] == ["top_mod"]
    assert leaf["direct_dependent_count"] == 1
    assert leaf["unresolved_dependencies"] == []
    assert leaf["unresolved_dependency_count"] == 0
    assert leaf["refactor_preflight_state"] == "ready-for-review"
    assert leaf["reason"] == "does not instantiate another resolved module"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["leaf_candidate_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_leaf_candidate_report_blocks_unresolved_dependencies():
    report = build_module_leaf_candidate_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )

    assert report["report_state"] == "leaves-detected"
    assert report["leaf_names"] == ["unresolved_top"]
    assert report["blocked_reasons"] == [
        "unresolved dependencies for leaf candidate: missing_child"
    ]
    leaf = report["leaves"][0]
    assert leaf["refactor_preflight_state"] == "blocked"
    assert leaf["unresolved_dependencies"] == ["missing_child"]
    assert leaf["unresolved_dependency_count"] == 1
    assert leaf["blocked_reasons"] == [
        "unresolved dependencies for leaf candidate: missing_child"
    ]


def test_build_module_leaf_candidate_report_blocks_when_no_leaves_detected():
    report = build_module_leaf_candidate_report(
        str(CYCLIC_FIXTURE),
        CYCLIC_FIXTURE,
    )

    assert report["report_state"] == "no-leaves-detected"
    assert report["leaf_count"] == 0
    assert report["leaf_names"] == []
    assert report["leaves"] == []
    assert report["blocked_reasons"] == ["no leaf candidates detected"]
    assert report["next_required_action"] == (
        "resolve hierarchy blockers before leaf-candidate review"
    )


def test_build_module_orphan_candidate_report_detects_isolated_modules():
    report = build_module_orphan_candidate_report(str(ORPHAN_FIXTURE), ORPHAN_FIXTURE)

    assert report["kind"] == "module-orphan-candidate-report"
    assert report["report_state"] == "orphans-detected"
    assert report["module_count"] == 3
    assert report["edge_count"] == 1
    assert report["resolved_edge_count"] == 1
    assert report["unresolved_edge_count"] == 0
    assert report["orphan_count"] == 1
    assert report["orphan_names"] == ["orphan_mod"]
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "review scanner-detected orphan candidates for isolation or cleanup"
    )
    orphan = report["orphans"][0]
    assert orphan["name"] == "orphan_mod"
    assert orphan["file"] == str(ORPHAN_FIXTURE)
    assert orphan["start_line"] == 17
    assert orphan["start_column"] == 1
    assert orphan["complete"] is True
    assert orphan["declaration_count"] == 1
    assert orphan["direct_dependencies"] == []
    assert orphan["direct_dependency_count"] == 0
    assert orphan["direct_dependents"] == []
    assert orphan["direct_dependent_count"] == 0
    assert orphan["unresolved_dependencies"] == []
    assert orphan["unresolved_dependency_count"] == 0
    assert orphan["refactor_preflight_state"] == "ready-for-review"
    assert orphan["reason"] == "no resolved dependencies or dependents detected by scanner"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["orphan_candidate_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_orphan_candidate_report_blocks_when_no_orphans_detected():
    report = build_module_orphan_candidate_report(str(FIXTURE), FIXTURE)

    assert report["report_state"] == "no-orphans-detected"
    assert report["orphan_count"] == 0
    assert report["orphan_names"] == []
    assert report["orphans"] == []
    assert report["blocked_reasons"] == ["no orphan candidates detected"]
    assert report["next_required_action"] == "continue module organization review"


def test_build_module_orphan_candidate_report_blocks_unresolved_dependencies():
    report = build_module_orphan_candidate_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )

    assert report["report_state"] == "orphans-detected"
    assert report["orphan_names"] == ["unresolved_top"]
    assert report["blocked_reasons"] == [
        "unresolved dependencies for orphan candidate: missing_child"
    ]
    orphan = report["orphans"][0]
    assert orphan["refactor_preflight_state"] == "blocked"
    assert orphan["unresolved_dependencies"] == ["missing_child"]
    assert orphan["blocked_reasons"] == [
        "unresolved dependencies for orphan candidate: missing_child"
    ]


def test_build_module_depth_report_groups_hierarchy_levels():
    report = build_module_depth_report(str(FIXTURE), FIXTURE)

    assert report["kind"] == "module-depth-report"
    assert report["report_state"] == "depths-detected"
    assert report["module_count"] == 2
    assert report["edge_count"] == 1
    assert report["resolved_edge_count"] == 1
    assert report["unresolved_edge_count"] == 0
    assert report["depth_count"] == 2
    assert report["max_depth"] == 1
    assert report["root_names"] == ["top_mod"]
    assert report["levels"] == [
        {
            "depth": 0,
            "module_count": 1,
            "module_names": ["top_mod"],
        },
        {
            "depth": 1,
            "module_count": 1,
            "module_names": ["leaf_mod"],
        },
    ]
    assert report["unplaced_module_count"] == 0
    assert report["unplaced_module_names"] == []
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "review scanner-detected hierarchy depth levels for module organization"
    )
    modules = {module["name"]: module for module in report["modules"]}
    assert set(modules) == {"top_mod", "leaf_mod"}
    assert modules["top_mod"]["depth"] == 0
    assert modules["top_mod"]["direct_dependencies"] == ["leaf_mod"]
    assert modules["top_mod"]["direct_dependents"] == []
    assert modules["top_mod"]["unresolved_dependencies"] == []
    assert modules["top_mod"]["refactor_preflight_state"] == "ready-for-review"
    assert modules["leaf_mod"]["depth"] == 1
    assert modules["leaf_mod"]["direct_dependencies"] == []
    assert modules["leaf_mod"]["direct_dependents"] == ["top_mod"]
    assert modules["leaf_mod"]["unresolved_dependencies"] == []
    assert modules["leaf_mod"]["reason"] == (
        "reachable from scanner root candidates by resolved edges"
    )
    assert report["safety"]["read_only"] is True
    assert report["safety"]["depth_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_depth_report_blocks_when_no_roots_detected():
    report = build_module_depth_report(str(CYCLIC_FIXTURE), CYCLIC_FIXTURE)

    assert report["report_state"] == "no-depths-detected"
    assert report["depth_count"] == 0
    assert report["max_depth"] is None
    assert report["levels"] == []
    assert report["modules"] == []
    assert report["root_names"] == []
    assert report["unplaced_module_count"] == 2
    assert report["unplaced_module_names"] == ["alpha_mod", "beta_mod"]
    assert report["blocked_reasons"] == [
        "no root candidates detected",
        "unplaced modules: alpha_mod, beta_mod",
    ]
    assert report["next_required_action"] == (
        "resolve hierarchy blockers before depth-level review"
    )


def test_build_module_depth_report_blocks_unresolved_dependencies():
    report = build_module_depth_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )

    assert report["report_state"] == "depths-detected"
    assert report["depth_count"] == 1
    assert report["root_names"] == ["unresolved_top"]
    assert report["blocked_reasons"] == [
        "unresolved dependencies for depth report: missing_child"
    ]
    module = report["modules"][0]
    assert module["name"] == "unresolved_top"
    assert module["depth"] == 0
    assert module["refactor_preflight_state"] == "blocked"
    assert module["unresolved_dependencies"] == ["missing_child"]
    assert module["blocked_reasons"] == [
        "unresolved dependencies for depth report: missing_child"
    ]


def test_build_module_fanout_report_ranks_direct_dependencies():
    report = build_module_fanout_report(str(FANOUT_FIXTURE), FANOUT_FIXTURE)

    assert report["kind"] == "module-fanout-report"
    assert report["report_state"] == "fanout-detected"
    assert report["module_count"] == 4
    assert report["edge_count"] == 3
    assert report["resolved_edge_count"] == 3
    assert report["unresolved_edge_count"] == 0
    assert report["fanout_count"] == 2
    assert report["fanout_names"] == ["fanout_top", "fanout_child_a"]
    assert report["max_direct_dependency_count"] == 2
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "review scanner-detected fanout before refactor planning"
    )
    modules = {module["name"]: module for module in report["modules"]}
    assert list(modules) == [
        "fanout_top",
        "fanout_child_a",
        "fanout_child_b",
        "fanout_leaf",
    ]
    top = modules["fanout_top"]
    assert top["rank"] == 1
    assert top["direct_dependencies"] == ["fanout_child_a", "fanout_child_b"]
    assert top["direct_dependency_count"] == 2
    assert top["direct_dependents"] == []
    assert top["unresolved_dependencies"] == []
    assert top["fanout_state"] == "has-resolved-fanout"
    assert top["refactor_preflight_state"] == "ready-for-review"
    child_a = modules["fanout_child_a"]
    assert child_a["rank"] == 2
    assert child_a["direct_dependencies"] == ["fanout_leaf"]
    assert child_a["direct_dependents"] == ["fanout_top"]
    assert child_a["fanout_state"] == "has-resolved-fanout"
    leaf = modules["fanout_leaf"]
    assert leaf["fanout_state"] == "no-resolved-fanout"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["fanout_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_fanout_report_blocks_unresolved_dependencies():
    report = build_module_fanout_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )

    assert report["report_state"] == "no-fanout-detected"
    assert report["fanout_count"] == 0
    assert report["fanout_names"] == []
    assert report["blocked_reasons"] == [
        "unresolved dependencies for fanout report: missing_child",
        "no resolved fanout detected",
    ]
    module = report["modules"][0]
    assert module["name"] == "unresolved_top"
    assert module["refactor_preflight_state"] == "blocked"
    assert module["unresolved_dependencies"] == ["missing_child"]
    assert module["blocked_reasons"] == [
        "unresolved dependencies for fanout report: missing_child"
    ]


def test_build_module_fanout_report_blocks_when_no_modules_detected():
    empty_fixture = REPO_ROOT / "fixtures" / "empty.sv"
    report = build_module_fanout_report(str(empty_fixture), empty_fixture)

    assert report["report_state"] == "no-fanout-detected"
    assert report["fanout_count"] == 0
    assert report["modules"] == []
    assert report["blocked_reasons"] == ["no module declarations detected"]
    assert report["next_required_action"] == "continue module organization review"


def test_build_module_fanin_report_ranks_direct_dependents():
    report = build_module_fanin_report(str(FANOUT_FIXTURE), FANOUT_FIXTURE)

    assert report["kind"] == "module-fanin-report"
    assert report["report_state"] == "fanin-detected"
    assert report["module_count"] == 4
    assert report["edge_count"] == 3
    assert report["resolved_edge_count"] == 3
    assert report["unresolved_edge_count"] == 0
    assert report["fanin_count"] == 3
    assert report["fanin_names"] == [
        "fanout_child_a",
        "fanout_child_b",
        "fanout_leaf",
    ]
    assert report["max_direct_dependent_count"] == 1
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "review scanner-detected fanin before refactor planning"
    )
    modules = {module["name"]: module for module in report["modules"]}
    assert list(modules) == [
        "fanout_child_a",
        "fanout_child_b",
        "fanout_leaf",
        "fanout_top",
    ]
    child_a = modules["fanout_child_a"]
    assert child_a["rank"] == 1
    assert child_a["direct_dependencies"] == ["fanout_leaf"]
    assert child_a["direct_dependents"] == ["fanout_top"]
    assert child_a["direct_dependent_count"] == 1
    assert child_a["fanin_state"] == "has-resolved-fanin"
    child_b = modules["fanout_child_b"]
    assert child_b["rank"] == 2
    assert child_b["direct_dependencies"] == []
    assert child_b["direct_dependents"] == ["fanout_top"]
    assert child_b["fanin_state"] == "has-resolved-fanin"
    leaf = modules["fanout_leaf"]
    assert leaf["rank"] == 3
    assert leaf["direct_dependencies"] == []
    assert leaf["direct_dependents"] == ["fanout_child_a"]
    assert leaf["fanin_state"] == "has-resolved-fanin"
    top = modules["fanout_top"]
    assert top["rank"] == 4
    assert top["direct_dependents"] == []
    assert top["fanin_state"] == "no-resolved-fanin"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["fanin_report_only"] is True
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["applies_refactor"] is False
    assert report["safety"]["generates_patch"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["invokes_vendor_tools"] is False
    assert report["safety"]["provider_calls"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_fanin_report_blocks_unresolved_dependencies():
    report = build_module_fanin_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )

    assert report["report_state"] == "no-fanin-detected"
    assert report["fanin_count"] == 0
    assert report["fanin_names"] == []
    assert report["blocked_reasons"] == [
        "unresolved dependencies for fanin report: missing_child",
        "no resolved fanin detected",
    ]
    module = report["modules"][0]
    assert module["name"] == "unresolved_top"
    assert module["refactor_preflight_state"] == "blocked"
    assert module["unresolved_dependencies"] == ["missing_child"]
    assert module["blocked_reasons"] == [
        "unresolved dependencies for fanin report: missing_child"
    ]


def test_build_module_fanin_report_blocks_when_no_modules_detected():
    empty_fixture = REPO_ROOT / "fixtures" / "empty.sv"
    report = build_module_fanin_report(str(empty_fixture), empty_fixture)

    assert report["report_state"] == "no-fanin-detected"
    assert report["fanin_count"] == 0
    assert report["modules"] == []
    assert report["blocked_reasons"] == ["no module declarations detected"]
    assert report["next_required_action"] == "continue module organization review"


def test_build_module_graph_health_summary_combines_graph_signals():
    report = build_module_graph_health_summary(str(FIXTURE), FIXTURE)

    assert report["kind"] == "module-graph-health-summary"
    assert report["health_state"] == "ready-for-review"
    assert report["ready_for_review"] is True
    assert report["module_count"] == 2
    assert report["complete_module_count"] == 2
    assert report["incomplete_module_count"] == 0
    assert report["root_count"] == 1
    assert report["root_names"] == ["top_mod"]
    assert report["leaf_count"] == 1
    assert report["leaf_names"] == ["leaf_mod"]
    assert report["max_depth"] == 1
    assert report["resolved_edge_count"] == 1
    assert report["unresolved_edge_count"] == 0
    assert report["unresolved_instance_count"] == 0
    assert report["duplicate_name_count"] == 0
    assert report["unplaced_module_count"] == 0
    assert report["blocked_reasons"] == []
    assert report["next_required_action"] == (
        "continue module organization and refactor readiness review"
    )
    cards = {card["card_id"]: card for card in report["health_cards"]}
    assert cards["root-candidates"]["status"] == "roots-detected"
    assert cards["leaf-candidates"]["status"] == "leaves-detected"
    assert cards["depth-levels"]["status"] == "depths-detected"
    assert cards["hierarchy-cycles"]["status"] == "no-cycles-detected"
    assert cards["unresolved-instances"]["status"] == (
        "no-unresolved-instances-detected"
    )
    assert cards["duplicate-modules"]["status"] == "no-duplicates-detected"
    assert report["safety"]["read_only"] is True
    assert report["safety"]["graph_health_summary_only"] is True
    assert report["safety"]["combines_root_candidate_report"] is True
    assert report["safety"]["combines_leaf_candidate_report"] is True
    assert report["safety"]["combines_depth_report"] is True
    assert report["safety"]["combines_cycle_report"] is True
    assert report["safety"]["combines_unresolved_instance_report"] is True
    assert report["safety"]["combines_duplicate_report"] is True
    assert report["safety"]["writes_files"] is False
    assert report["safety"]["emits_command_descriptors"] is False
    assert report["safety"]["runs_validation"] is False
    assert report["safety"]["runs_shell"] is False
    assert report["safety"]["invokes_pccx_lab"] is False
    assert report["safety"]["invokes_launcher"] is False
    assert report["safety"]["hardware_access"] is False
    assert report["writes_files"] is False
    assert '"argv"' not in json.dumps(report)


def test_build_module_graph_health_summary_blocks_graph_issues():
    report = build_module_graph_health_summary(str(CYCLIC_FIXTURE), CYCLIC_FIXTURE)

    assert report["health_state"] == "blocked"
    assert report["ready_for_review"] is False
    assert report["root_count"] == 0
    assert report["leaf_count"] == 0
    assert report["unplaced_module_count"] == 2
    assert report["blocked_reasons"] == [
        "scanner-detected hierarchy cycle: alpha_mod -> beta_mod -> alpha_mod",
        "no root candidates detected",
        "no leaf candidates detected",
        "unplaced modules: alpha_mod, beta_mod",
    ]
    assert report["next_required_action"] == (
        "resolve scanner-detected module graph blockers before refactor planning"
    )


def test_build_module_graph_health_summary_blocks_unresolved_and_duplicates():
    unresolved = build_module_graph_health_summary(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )
    duplicates = build_module_graph_health_summary(
        str(DUPLICATE_FIXTURE),
        DUPLICATE_FIXTURE,
    )

    assert unresolved["health_state"] == "blocked"
    assert unresolved["unresolved_instance_count"] == 1
    assert unresolved["blocked_reasons"] == [
        "unresolved module instantiation: missing_child as u_missing in unresolved_top",
        "unresolved dependencies for depth report: missing_child",
    ]
    assert duplicates["health_state"] == "blocked"
    assert duplicates["duplicate_name_count"] == 1
    assert duplicates["duplicate_names"] == ["dup_mod"]
    assert "ambiguous module name: dup_mod" in duplicates["blocked_reasons"]


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


def test_build_refactor_approval_decision_records_unapproved_gate():
    decision = build_refactor_approval_decision(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert decision["kind"] == "module-refactor-approval-decision"
    assert decision["decision_state"] == "not-approved"
    assert decision["approval_decision"]["approved"] is False
    assert decision["approval_decision"]["approver"] == "not-recorded"
    assert decision["approval_decision"]["reason"] == (
        "explicit approval not recorded"
    )
    assert decision["preflight"]["status"] == "ready-for-review"
    assert decision["writes_files"] is False
    assert decision["packet_summary"]["kind"] == "module-refactor-review-packet"
    assert decision["packet_summary"]["review_state"] == "ready-for-review"
    assert decision["packet_summary"]["command_descriptor_count"] == 8
    assert decision["packet_summary"]["validation_phases"][0]["command_ids"] == [
        "module-context",
        "refactor-impact",
        "refactor-plan",
    ]
    assert decision["proposal_summary"]["requested_change"]["new_name"] == (
        "leaf_mod_next"
    )
    assert decision["safety"]["read_only"] is True
    assert decision["safety"]["decision_metadata_only"] is True
    assert decision["safety"]["approval_granted"] is False
    assert decision["safety"]["summarizes_command_descriptors"] is True
    assert decision["safety"]["emits_command_descriptors"] is False
    assert decision["safety"]["writes_files"] is False
    assert decision["safety"]["runs_validation"] is False
    assert decision["safety"]["runs_shell"] is False
    assert decision["safety"]["invokes_pccx_lab"] is False
    assert decision["safety"]["invokes_launcher"] is False
    assert decision["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(decision)


def test_build_refactor_approval_decision_reports_blocked_preflight():
    decision = build_refactor_approval_decision(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert decision["decision_state"] == "blocked"
    assert decision["approval_decision"]["approved"] is False
    assert decision["approval_decision"]["reason"] == "preflight blocked"
    assert "missing required direction" in decision["preflight"]["reasons"]
    phases = {
        phase["phase"]: phase
        for phase in decision["packet_summary"]["validation_phases"]
    }
    assert phases["post-change-local-validation"]["status"] == "blocked"
    assert phases["post-change-local-validation"]["command_ids"] == []


def test_build_refactor_application_request_records_not_accepted_gate():
    request = build_refactor_application_request(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert request["kind"] == "module-refactor-application-request"
    assert request["application_state"] == "not-accepted"
    assert request["application_request"]["accepted"] is False
    assert request["application_request"]["applied"] is False
    assert request["application_request"]["result"] == "not_applied"
    assert request["application_request"]["reason"] == "approval not granted"
    assert request["application_request"]["required_approval_decision"] == (
        "not-approved"
    )
    assert request["preflight"]["status"] == "ready-for-review"
    assert request["writes_files"] is False
    assert request["approval_summary"]["kind"] == "module-refactor-approval-decision"
    assert request["approval_summary"]["approved"] is False
    assert request["approval_summary"]["decision_state"] == "not-approved"
    assert request["approval_summary"]["review_state"] == "ready-for-review"
    assert request["approval_summary"]["command_descriptor_count"] == 8
    assert request["proposal_summary"]["requested_change"]["new_name"] == (
        "leaf_mod_next"
    )
    assert request["safety"]["read_only"] is True
    assert request["safety"]["application_metadata_only"] is True
    assert request["safety"]["request_accepted"] is False
    assert request["safety"]["approval_granted"] is False
    assert request["safety"]["summarizes_command_descriptors"] is True
    assert request["safety"]["emits_command_descriptors"] is False
    assert request["safety"]["writes_files"] is False
    assert request["safety"]["applies_refactor"] is False
    assert request["safety"]["runs_validation"] is False
    assert request["safety"]["runs_shell"] is False
    assert request["safety"]["invokes_pccx_lab"] is False
    assert request["safety"]["invokes_launcher"] is False
    assert request["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(request)


def test_build_refactor_application_request_reports_blocked_preflight():
    request = build_refactor_application_request(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert request["application_state"] == "blocked"
    assert request["application_request"]["accepted"] is False
    assert request["application_request"]["applied"] is False
    assert request["application_request"]["reason"] == "preflight blocked"
    assert "missing required direction" in request["preflight"]["reasons"]
    phases = {
        phase["phase"]: phase
        for phase in request["approval_summary"]["validation_phases"]
    }
    assert phases["post-change-local-validation"]["status"] == "blocked"
    assert phases["post-change-local-validation"]["command_ids"] == []


def test_build_refactor_application_result_records_not_applied_receipt():
    result = build_refactor_application_result(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert result["kind"] == "module-refactor-application-result"
    assert result["result_state"] == "not-applied"
    assert result["application_result"]["result"] == "not_applied"
    assert result["application_result"]["write_attempted"] is False
    assert result["application_result"]["patch_generated"] is False
    assert result["application_result"]["files_changed"] == []
    assert result["application_result"]["file_change_count"] == 0
    assert result["application_result"]["validation_run"] is False
    assert result["application_result"]["validation_result"] == "not_run"
    assert result["application_result"]["rollback_required"] is False
    assert result["application_result"]["rollback_performed"] is False
    assert result["preflight"]["status"] == "ready-for-review"
    assert result["writes_files"] is False
    assert result["application_summary"]["kind"] == (
        "module-refactor-application-request"
    )
    assert result["application_summary"]["application_state"] == "not-accepted"
    assert result["application_summary"]["accepted"] is False
    assert result["application_summary"]["applied"] is False
    assert result["application_summary"]["approval_decision_state"] == (
        "not-approved"
    )
    assert result["application_summary"]["command_descriptor_count"] == 8
    assert result["proposal_summary"]["requested_change"]["new_name"] == (
        "leaf_mod_next"
    )
    assert result["safety"]["read_only"] is True
    assert result["safety"]["application_result_metadata_only"] is True
    assert result["safety"]["write_attempted"] is False
    assert result["safety"]["request_accepted"] is False
    assert result["safety"]["approval_granted"] is False
    assert result["safety"]["summarizes_command_descriptors"] is True
    assert result["safety"]["emits_command_descriptors"] is False
    assert result["safety"]["writes_files"] is False
    assert result["safety"]["generates_patch"] is False
    assert result["safety"]["applies_refactor"] is False
    assert result["safety"]["runs_validation"] is False
    assert result["safety"]["rollback_required"] is False
    assert result["safety"]["runs_shell"] is False
    assert result["safety"]["invokes_pccx_lab"] is False
    assert result["safety"]["invokes_launcher"] is False
    assert result["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(result)


def test_build_refactor_application_result_reports_blocked_preflight():
    result = build_refactor_application_result(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert result["result_state"] == "blocked"
    assert result["application_result"]["result"] == "not_applied"
    assert result["application_result"]["reason"] == "preflight blocked"
    assert result["application_result"]["write_attempted"] is False
    assert "missing required direction" in result["preflight"]["reasons"]
    phases = {
        phase["phase"]: phase
        for phase in result["application_summary"]["validation_phases"]
    }
    assert phases["post-change-local-validation"]["status"] == "blocked"
    assert phases["post-change-local-validation"]["command_ids"] == []


def test_build_refactor_handoff_summary_records_summary_only_handoff():
    summary = build_refactor_handoff_summary(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert summary["kind"] == "module-refactor-handoff-summary"
    assert summary["handoff_state"] == "ready-for-review"
    assert summary["handoff_summary"]["public_text_ready"] is False
    assert summary["handoff_summary"]["pull_request_ready"] is False
    assert summary["handoff_summary"]["comment_ready"] is False
    assert summary["handoff_summary"]["files_changed"] == 0
    assert summary["handoff_summary"]["write_attempted"] is False
    assert summary["handoff_summary"]["patch_generated"] is False
    assert summary["handoff_summary"]["validation_run"] is False
    assert summary["handoff_summary"]["rollback_required"] is False
    assert summary["application_result_summary"]["kind"] == (
        "module-refactor-application-result"
    )
    assert summary["application_result_summary"]["application_result"] == (
        "not_applied"
    )
    assert summary["application_result_summary"]["result_state"] == (
        "not-applied"
    )
    assert summary["application_result_summary"]["write_attempted"] is False
    assert summary["application_result_summary"]["patch_generated"] is False
    assert summary["application_result_summary"]["file_change_count"] == 0
    assert summary["application_result_summary"]["validation_run"] is False
    assert summary["application_result_summary"]["rollback_required"] is False
    assert "pull-request-create" in summary["blocked_actions"]
    assert "comment-write" in summary["blocked_actions"]
    assert "project-mutation" in summary["blocked_actions"]
    assert summary["safety"]["read_only"] is True
    assert summary["safety"]["handoff_summary_only"] is True
    assert summary["safety"]["public_text_published"] is False
    assert summary["safety"]["pull_request_created"] is False
    assert summary["safety"]["comment_written"] is False
    assert summary["safety"]["project_mutation"] is False
    assert summary["safety"]["writes_files"] is False
    assert summary["safety"]["generates_patch"] is False
    assert summary["safety"]["runs_validation"] is False
    assert summary["safety"]["runs_shell"] is False
    assert summary["safety"]["invokes_pccx_lab"] is False
    assert summary["safety"]["invokes_launcher"] is False
    assert summary["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(summary)


def test_build_refactor_handoff_summary_reports_blocked_preflight():
    summary = build_refactor_handoff_summary(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert summary["handoff_state"] == "blocked"
    assert summary["handoff_summary"]["ready_for_maintainer_review"] is False
    assert summary["handoff_summary"]["recommended_next_step"] == (
        "resolve refactor preflight blockers before handoff"
    )
    assert summary["application_result_summary"]["result_state"] == "blocked"
    assert "missing required direction" in summary["preflight"]["reasons"]
    phases = {
        phase["phase"]: phase
        for phase in summary["application_result_summary"]["validation_phases"]
    }
    assert phases["post-change-local-validation"]["status"] == "blocked"
    assert phases["post-change-local-validation"]["command_ids"] == []


def test_build_refactor_checklist_summary_records_summary_only_items():
    checklist = build_refactor_checklist_summary(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert checklist["kind"] == "module-refactor-checklist-summary"
    assert checklist["checklist_state"] == "ready-for-review"
    assert checklist["handoff_summary"]["kind"] == (
        "module-refactor-handoff-summary"
    )
    assert checklist["handoff_summary"]["ready_for_maintainer_review"] is True
    assert checklist["result_summary"]["application_result"] == "not_applied"
    assert checklist["result_summary"]["write_attempted"] is False
    assert checklist["result_summary"]["patch_generated"] is False
    assert checklist["result_summary"]["file_change_count"] == 0
    assert checklist["result_summary"]["validation_run"] is False
    assert checklist["result_summary"]["rollback_required"] is False
    assert [item["item_id"] for item in checklist["checklist_items"]] == [
        "preflight",
        "context-review",
        "validation-plan-review",
        "approval-gate",
        "application-gate",
        "handoff-review",
    ]
    items = {item["item_id"]: item for item in checklist["checklist_items"]}
    assert items["preflight"]["complete"] is True
    assert items["context-review"]["status"] == "pending-maintainer-review"
    assert items["validation-plan-review"]["command_descriptor_count"] == 8
    assert items["approval-gate"]["status"] == "not-approved"
    assert items["application-gate"]["write_attempted"] is False
    assert "approval-grant" in checklist["blocked_actions"]
    assert "application-accept" in checklist["blocked_actions"]
    assert checklist["safety"]["read_only"] is True
    assert checklist["safety"]["checklist_summary_only"] is True
    assert checklist["safety"]["approval_granted"] is False
    assert checklist["safety"]["request_accepted"] is False
    assert checklist["safety"]["writes_files"] is False
    assert checklist["safety"]["generates_patch"] is False
    assert checklist["safety"]["runs_validation"] is False
    assert checklist["safety"]["runs_shell"] is False
    assert checklist["safety"]["invokes_pccx_lab"] is False
    assert checklist["safety"]["invokes_launcher"] is False
    assert checklist["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(checklist)


def test_build_refactor_checklist_summary_reports_blocked_preflight():
    checklist = build_refactor_checklist_summary(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert checklist["checklist_state"] == "blocked"
    assert checklist["handoff_summary"]["ready_for_maintainer_review"] is False
    assert checklist["handoff_summary"]["recommended_next_step"] == (
        "resolve refactor preflight blockers before handoff"
    )
    assert "missing required direction" in checklist["preflight"]["reasons"]
    items = {item["item_id"]: item for item in checklist["checklist_items"]}
    assert items["preflight"]["status"] == "blocked"
    assert items["preflight"]["complete"] is False
    assert items["context-review"]["status"] == "blocked-by-preflight"
    assert items["validation-plan-review"]["status"] == "blocked-by-preflight"


def test_build_refactor_session_status_summarizes_checklist_only():
    session = build_refactor_session_status(
        str(FIXTURE),
        FIXTURE,
        "rename-module",
        "leaf_mod",
        new_name="leaf_mod_next",
    )

    assert session["kind"] == "module-refactor-session-status"
    assert session["session_state"] == "ready-for-review"
    assert session["current_stage"] == "maintainer-review"
    assert session["next_required_action"] == (
        "review checklist items before approval or application"
    )
    assert session["session_summary"]["checklist_kind"] == (
        "module-refactor-checklist-summary"
    )
    assert session["session_summary"]["ready_for_maintainer_review"] is True
    assert session["session_summary"]["required_item_count"] == 6
    assert session["session_summary"]["complete_required_count"] == 1
    assert session["session_summary"]["incomplete_required_count"] == 5
    assert session["result_summary"]["application_result"] == "not_applied"
    assert session["result_summary"]["write_attempted"] is False
    assert session["result_summary"]["patch_generated"] is False
    assert session["result_summary"]["validation_run"] is False
    assert [item["item_id"] for item in session["session_items"]] == [
        "preflight",
        "context-review",
        "validation-plan-review",
        "approval-gate",
        "application-gate",
        "handoff-review",
    ]
    assert "session-persistence" in session["blocked_actions"]
    assert "status-writeback" in session["blocked_actions"]
    assert "notification-dispatch" in session["blocked_actions"]
    assert session["safety"]["read_only"] is True
    assert session["safety"]["session_status_only"] is True
    assert session["safety"]["session_persistence"] is False
    assert session["safety"]["status_writeback"] is False
    assert session["safety"]["notification_dispatched"] is False
    assert session["safety"]["approval_granted"] is False
    assert session["safety"]["request_accepted"] is False
    assert session["safety"]["writes_files"] is False
    assert session["safety"]["generates_patch"] is False
    assert session["safety"]["runs_validation"] is False
    assert session["safety"]["runs_shell"] is False
    assert session["safety"]["public_text_published"] is False
    assert session["safety"]["pull_request_created"] is False
    assert session["safety"]["comment_written"] is False
    assert session["safety"]["project_mutation"] is False
    assert session["safety"]["invokes_pccx_lab"] is False
    assert session["safety"]["invokes_launcher"] is False
    assert session["safety"]["hardware_access"] is False
    assert '"argv"' not in json.dumps(session)


def test_build_refactor_session_status_reports_blocked_preflight():
    session = build_refactor_session_status(
        str(FIXTURE),
        FIXTURE,
        "extract-port",
        "top_mod",
        port_name="valid_i",
    )

    assert session["session_state"] == "blocked"
    assert session["current_stage"] == "preflight-blocked"
    assert session["next_required_action"] == (
        "resolve refactor preflight blockers before session review"
    )
    assert session["session_summary"]["ready_for_maintainer_review"] is False
    assert "missing required direction" in session["preflight"]["reasons"]
    items = {item["item_id"]: item for item in session["session_items"]}
    assert items["preflight"]["status"] == "blocked"
    assert items["preflight"]["complete"] is False
    assert items["context-review"]["status"] == "blocked-by-preflight"
    assert items["validation-plan-review"]["status"] == "blocked-by-preflight"


def test_format_module_organization_text_mentions_boundary_and_hierarchy():
    export = build_module_organization_export(str(FIXTURE), FIXTURE)
    text = format_module_organization_text(export)
    assert "2 modules" in text
    assert "module top_mod (complete)" in text
    assert "top_mod -> leaf_mod as u_leaf" in text
    assert "refactoring: proposal-only, no file writes" in text


def test_format_module_boundary_audit_text_mentions_read_only_gate():
    audit = build_module_boundary_audit(str(INCOMPLETE_FIXTURE), INCOMPLETE_FIXTURE)
    text = format_module_boundary_audit_text(audit)

    assert "boundary audit: available_as_data" in text
    assert "refactor readiness: blocked" in text
    assert "writes files: no" in text
    assert "1 module; 0 complete; 1 incomplete" in text
    assert "module bad_module (incomplete; blocked)" in text
    assert "blocked: missing endmodule for module: bad_module" in text
    assert "read-only: no file writes" in text


def test_format_module_duplicate_report_text_mentions_duplicates_and_boundary():
    report = build_module_duplicate_report(str(DUPLICATE_FIXTURE), DUPLICATE_FIXTURE)
    text = format_module_duplicate_report_text(report)

    assert "module duplicates: duplicates-detected" in text
    assert "dup_mod: 2 declarations" in text
    assert "blocked: ambiguous module name: dup_mod" in text
    assert "read-only duplicate report: no command argv" in text


def test_format_refactor_candidate_list_text_mentions_actions_and_no_execution():
    candidates = build_refactor_candidate_list(str(FIXTURE), FIXTURE)
    text = format_refactor_candidate_list_text(candidates)

    assert "refactor candidates: available_as_data" in text
    assert "2 modules; 2 ready; 0 blocked" in text
    assert "rename-module: ready-for-request" in text
    assert "required=new_name" in text
    assert "extract-port: ready-for-request" in text
    assert "optional=width" in text
    assert "writes files: no" in text
    assert "read-only candidate metadata: no command argv" in text


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


def test_format_module_hierarchy_cycle_text_mentions_cycle_and_boundary():
    report = build_module_hierarchy_cycle_report(
        str(CYCLIC_FIXTURE),
        CYCLIC_FIXTURE,
    )
    text = format_module_hierarchy_cycle_text(report)

    assert "hierarchy cycles: cycles-detected" in text
    assert "cycle-1: alpha_mod -> beta_mod -> alpha_mod" in text
    assert "alpha_mod -> beta_mod as u_beta" in text
    assert "blocked: scanner-detected hierarchy cycle" in text
    assert "read-only cycle report: no command argv" in text


def test_format_module_unresolved_instance_report_text_mentions_boundary():
    report = build_module_unresolved_instance_report(
        str(UNRESOLVED_FIXTURE),
        UNRESOLVED_FIXTURE,
    )
    text = format_module_unresolved_instance_report_text(report)

    assert "unresolved instances: unresolved-instances-detected" in text
    assert "unresolved modules: missing_child" in text
    assert "unresolved-1: unresolved_top -> missing_child as u_missing" in text
    assert "blocked: unresolved module instantiation" in text
    assert "read-only unresolved report: no command argv" in text


def test_format_module_root_candidate_report_text_mentions_boundary():
    report = build_module_root_candidate_report(str(FIXTURE), FIXTURE)
    text = format_module_root_candidate_report_text(report)

    assert "module roots: roots-detected" in text
    assert "1 root candidate" in text
    assert "module top_mod (ready-for-review)" in text
    assert "dependencies=leaf_mod; unresolved=none" in text
    assert "read-only root report: no command argv" in text


def test_format_module_leaf_candidate_report_text_mentions_boundary():
    report = build_module_leaf_candidate_report(str(FIXTURE), FIXTURE)
    text = format_module_leaf_candidate_report_text(report)

    assert "module leaves: leaves-detected" in text
    assert "1 leaf candidate" in text
    assert "module leaf_mod (ready-for-review)" in text
    assert "dependents=top_mod; unresolved=none" in text
    assert "read-only leaf report: no command argv" in text


def test_format_module_orphan_candidate_report_text_mentions_boundary():
    report = build_module_orphan_candidate_report(str(ORPHAN_FIXTURE), ORPHAN_FIXTURE)
    text = format_module_orphan_candidate_report_text(report)

    assert "module orphans: orphans-detected" in text
    assert "1 orphan candidate" in text
    assert "module orphan_mod (ready-for-review)" in text
    assert "dependencies=none; dependents=none; unresolved=none" in text
    assert "read-only orphan report: no command argv" in text


def test_format_module_depth_report_text_mentions_boundary():
    report = build_module_depth_report(str(FIXTURE), FIXTURE)
    text = format_module_depth_report_text(report)

    assert "module depths: depths-detected" in text
    assert "2 depth levels" in text
    assert "max depth: 1" in text
    assert "depth 0: top_mod" in text
    assert "depth 1: leaf_mod" in text
    assert "module top_mod depth=0 (ready-for-review)" in text
    assert "dependencies=leaf_mod; dependents=none; unresolved=none" in text
    assert "read-only depth report: no command argv" in text


def test_format_module_fanin_report_text_mentions_boundary():
    report = build_module_fanin_report(str(FANOUT_FIXTURE), FANOUT_FIXTURE)
    text = format_module_fanin_report_text(report)

    assert "module fanin: fanin-detected" in text
    assert "3 fanin modules" in text
    assert "max direct dependents: 1" in text
    assert "rank 1:" in text
    assert "module fanout_child_a (ready-for-review)" in text
    assert "dependencies=fanout_leaf; dependents=fanout_top" in text
    assert "read-only fanin report: no command argv" in text


def test_format_module_graph_health_summary_text_mentions_boundary():
    report = build_module_graph_health_summary(str(FIXTURE), FIXTURE)
    text = format_module_graph_health_summary_text(report)

    assert "module graph health: ready-for-review" in text
    assert "ready for review: yes" in text
    assert "1 root; 1 leaf; max depth: 1" in text
    assert "status: hierarchy-cycles (no-cycles-detected)" in text
    assert "roots: top_mod" in text
    assert "leaves: leaf_mod" in text
    assert "read-only graph health summary: no command argv" in text


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


def test_format_refactor_approval_decision_text_mentions_unapproved_boundary():
    decision = build_refactor_approval_decision(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_approval_decision_text(decision)

    assert "approval decision: not-approved" in text
    assert "approved: no" in text
    assert "review state: ready-for-review" in text
    assert "validation descriptors:" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "decision metadata only: no command argv" in text


def test_format_refactor_application_request_text_mentions_not_applied_boundary():
    request = build_refactor_application_request(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_application_request_text(request)

    assert "application request: not-accepted" in text
    assert "accepted: no" in text
    assert "applied: no" in text
    assert "approval decision: not-approved" in text
    assert "review state: ready-for-review" in text
    assert "validation descriptors:" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "application metadata only: no command argv" in text


def test_format_refactor_application_result_text_mentions_result_receipt():
    result = build_refactor_application_result(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_application_result_text(result)

    assert "application result: not-applied" in text
    assert "result: not_applied" in text
    assert "application request: not-accepted" in text
    assert "write attempted: no" in text
    assert "patch generated: no" in text
    assert "files changed: 0" in text
    assert "validation run: no" in text
    assert "rollback required: no" in text
    assert "approval decision: not-approved" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "result metadata only: no command argv" in text


def test_format_refactor_handoff_summary_text_mentions_summary_only_boundary():
    summary = build_refactor_handoff_summary(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_handoff_summary_text(summary)

    assert "refactor handoff: ready-for-review" in text
    assert "application result: not-applied" in text
    assert "write attempted: no" in text
    assert "patch generated: no" in text
    assert "files changed: 0" in text
    assert "validation run: no" in text
    assert "rollback required: no" in text
    assert "public text ready: no" in text
    assert "pull request ready: no" in text
    assert "comment ready: no" in text
    assert "approval decision: not-approved" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "summary-only handoff: no command argv" in text


def test_format_refactor_checklist_summary_text_mentions_summary_only_boundary():
    checklist = build_refactor_checklist_summary(
        str(FIXTURE),
        FIXTURE,
        "move-module",
        "leaf_mod",
        destination="rtl/leaf_mod.sv",
    )
    text = format_refactor_checklist_summary_text(checklist)

    assert "refactor checklist: ready-for-review" in text
    assert "handoff: ready-for-review" in text
    assert "ready for maintainer review: yes" in text
    assert "write attempted: no" in text
    assert "patch generated: no" in text
    assert "files changed: 0" in text
    assert "validation run: no" in text
    assert "rollback required: no" in text
    assert "approval decision: not-approved" in text
    assert "application result: not_applied" in text
    assert "checklist: preflight (ready-for-review)" in text
    assert "checklist: approval-gate (not-approved)" in text
    assert "writes files: no" in text
    assert "runs validation: no" in text
    assert "summary-only checklist: no command argv" in text


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


def test_cli_boundary_audit_json():
    result = _run_cli("boundary-audit", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-boundary-audit"
    assert payload["refactor_readiness"] == "ready-for-review"
    assert payload["complete_module_count"] == 2
    assert payload["incomplete_module_count"] == 0
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["runs_validation"] is False


def test_cli_boundary_audit_text():
    result = _run_cli(
        "boundary-audit",
        str(INCOMPLETE_FIXTURE),
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "boundary audit: available_as_data" in result.stdout
    assert "refactor readiness: blocked" in result.stdout
    assert "module bad_module (incomplete; blocked)" in result.stdout
    assert "blocked: missing endmodule for module: bad_module" in result.stdout
    assert "read-only: no file writes" in result.stdout


def test_cli_module_duplicates_json():
    result = _run_cli("module-duplicates", str(DUPLICATE_FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-duplicate-report"
    assert payload["report_state"] == "duplicates-detected"
    assert payload["duplicate_names"] == ["dup_mod"]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_duplicates_text():
    result = _run_cli("module-duplicates", str(DUPLICATE_FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module duplicates: duplicates-detected" in result.stdout
    assert "dup_mod: 2 declarations" in result.stdout
    assert "read-only duplicate report: no command argv" in result.stdout


def test_cli_refactor_candidates_json():
    result = _run_cli("refactor-candidates", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-refactor-candidate-list"
    assert payload["candidate_state"] == "available_as_data"
    assert payload["ready_module_count"] == 2
    assert payload["blocked_module_count"] == 0
    assert payload["candidates"][0]["actions"][0]["action"] == "rename-module"
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_candidates_text():
    result = _run_cli("refactor-candidates", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "refactor candidates: available_as_data" in result.stdout
    assert "rename-module: ready-for-request" in result.stdout
    assert "read-only candidate metadata: no command argv" in result.stdout


def test_cli_refactor_readiness_json():
    result = _run_cli("refactor-readiness", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-refactor-readiness-summary"
    assert payload["readiness_state"] == "ready-for-request"
    assert payload["ready_for_request"] is True
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_readiness_text():
    result = _run_cli(
        "refactor-readiness",
        str(INCOMPLETE_FIXTURE),
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "refactor readiness: blocked" in result.stdout
    assert "ready for request: no" in result.stdout
    assert "blocked: missing endmodule for module: bad_module" in result.stdout
    assert "blocked: module boundary is incomplete: bad_module" in result.stdout
    assert "summary-only readiness: no command argv" in result.stdout


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


def test_cli_hierarchy_cycles_json():
    result = _run_cli("hierarchy-cycles", str(CYCLIC_FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-hierarchy-cycle-report"
    assert payload["cycle_state"] == "cycles-detected"
    assert payload["cycle_count"] == 1
    assert payload["cycles"][0]["module_path"] == [
        "alpha_mod",
        "beta_mod",
        "alpha_mod",
    ]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_hierarchy_cycles_text():
    result = _run_cli("hierarchy-cycles", str(CYCLIC_FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "hierarchy cycles: cycles-detected" in result.stdout
    assert "cycle-1: alpha_mod -> beta_mod -> alpha_mod" in result.stdout
    assert "read-only cycle report: no command argv" in result.stdout


def test_cli_unresolved_instances_json():
    result = _run_cli(
        "unresolved-instances",
        str(UNRESOLVED_FIXTURE),
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-unresolved-instance-report"
    assert payload["report_state"] == "unresolved-instances-detected"
    assert payload["unresolved_modules"] == ["missing_child"]
    assert payload["unresolved_instances"][0]["target_module"] == "missing_child"
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_unresolved_instances_text():
    result = _run_cli(
        "unresolved-instances",
        str(UNRESOLVED_FIXTURE),
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "unresolved instances: unresolved-instances-detected" in result.stdout
    assert "unresolved-1: unresolved_top -> missing_child as u_missing" in result.stdout
    assert "read-only unresolved report: no command argv" in result.stdout


def test_cli_module_roots_json():
    result = _run_cli("module-roots", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-root-candidate-report"
    assert payload["report_state"] == "roots-detected"
    assert payload["root_names"] == ["top_mod"]
    assert payload["roots"][0]["direct_dependencies"] == ["leaf_mod"]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_roots_text():
    result = _run_cli("module-roots", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module roots: roots-detected" in result.stdout
    assert "module top_mod (ready-for-review)" in result.stdout
    assert "read-only root report: no command argv" in result.stdout


def test_cli_module_leaves_json():
    result = _run_cli("module-leaves", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-leaf-candidate-report"
    assert payload["report_state"] == "leaves-detected"
    assert payload["leaf_names"] == ["leaf_mod"]
    assert payload["leaves"][0]["direct_dependents"] == ["top_mod"]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_leaves_text():
    result = _run_cli("module-leaves", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module leaves: leaves-detected" in result.stdout
    assert "module leaf_mod (ready-for-review)" in result.stdout
    assert "read-only leaf report: no command argv" in result.stdout


def test_cli_module_orphans_json():
    result = _run_cli("module-orphans", str(ORPHAN_FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-orphan-candidate-report"
    assert payload["report_state"] == "orphans-detected"
    assert payload["orphan_names"] == ["orphan_mod"]
    assert payload["orphans"][0]["direct_dependencies"] == []
    assert payload["orphans"][0]["direct_dependents"] == []
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_orphans_text():
    result = _run_cli("module-orphans", str(ORPHAN_FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module orphans: orphans-detected" in result.stdout
    assert "module orphan_mod (ready-for-review)" in result.stdout
    assert "read-only orphan report: no command argv" in result.stdout


def test_cli_module_depths_json():
    result = _run_cli("module-depths", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-depth-report"
    assert payload["report_state"] == "depths-detected"
    assert payload["depth_count"] == 2
    assert payload["max_depth"] == 1
    assert payload["levels"][0]["module_names"] == ["top_mod"]
    assert payload["levels"][1]["module_names"] == ["leaf_mod"]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_depths_text():
    result = _run_cli("module-depths", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module depths: depths-detected" in result.stdout
    assert "depth 0: top_mod" in result.stdout
    assert "depth 1: leaf_mod" in result.stdout
    assert "read-only depth report: no command argv" in result.stdout


def test_cli_module_fanout_json():
    result = _run_cli("module-fanout", str(FANOUT_FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-fanout-report"
    assert payload["report_state"] == "fanout-detected"
    assert payload["fanout_names"] == ["fanout_top", "fanout_child_a"]
    assert payload["max_direct_dependency_count"] == 2
    assert payload["modules"][0]["name"] == "fanout_top"
    assert payload["modules"][0]["direct_dependencies"] == [
        "fanout_child_a",
        "fanout_child_b",
    ]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_fanout_text():
    result = _run_cli("module-fanout", str(FANOUT_FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module fanout: fanout-detected" in result.stdout
    assert "rank 1:" in result.stdout
    assert "module fanout_top (ready-for-review)" in result.stdout
    assert "dependencies=fanout_child_a, fanout_child_b" in result.stdout
    assert "read-only fanout report: no command argv" in result.stdout


def test_cli_module_fanin_json():
    result = _run_cli("module-fanin", str(FANOUT_FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-fanin-report"
    assert payload["report_state"] == "fanin-detected"
    assert payload["fanin_names"] == [
        "fanout_child_a",
        "fanout_child_b",
        "fanout_leaf",
    ]
    assert payload["max_direct_dependent_count"] == 1
    assert payload["modules"][0]["name"] == "fanout_child_a"
    assert payload["modules"][0]["direct_dependents"] == ["fanout_top"]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_fanin_text():
    result = _run_cli("module-fanin", str(FANOUT_FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module fanin: fanin-detected" in result.stdout
    assert "rank 1:" in result.stdout
    assert "module fanout_child_a (ready-for-review)" in result.stdout
    assert "dependents=fanout_top" in result.stdout
    assert "read-only fanin report: no command argv" in result.stdout


def test_cli_module_health_json():
    result = _run_cli("module-health", str(FIXTURE), "--format", "json")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["kind"] == "module-graph-health-summary"
    assert payload["health_state"] == "ready-for-review"
    assert payload["ready_for_review"] is True
    assert payload["root_names"] == ["top_mod"]
    assert payload["leaf_names"] == ["leaf_mod"]
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["emits_command_descriptors"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_module_health_text():
    result = _run_cli("module-health", str(FIXTURE), "--format", "text")
    assert result.returncode == 0, result.stderr
    assert "module graph health: ready-for-review" in result.stdout
    assert "status: duplicate-modules (no-duplicates-detected)" in result.stdout
    assert "read-only graph health summary: no command argv" in result.stdout


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


def test_cli_refactor_approval_json():
    result = _run_cli(
        "refactor-approval",
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
    assert payload["kind"] == "module-refactor-approval-decision"
    assert payload["decision_state"] == "not-approved"
    assert payload["approval_decision"]["approved"] is False
    assert payload["packet_summary"]["review_state"] == "ready-for-review"
    assert payload["packet_summary"]["command_descriptor_count"] == 8
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_approval_text():
    result = _run_cli(
        "refactor-approval",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "approval decision: blocked" in result.stdout
    assert "approved: no" in result.stdout
    assert "blocked: missing required direction" in result.stdout
    assert "decision metadata only: no command argv" in result.stdout


def test_cli_refactor_application_json():
    result = _run_cli(
        "refactor-application",
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
    assert payload["kind"] == "module-refactor-application-request"
    assert payload["application_state"] == "not-accepted"
    assert payload["application_request"]["accepted"] is False
    assert payload["application_request"]["applied"] is False
    assert payload["approval_summary"]["decision_state"] == "not-approved"
    assert payload["approval_summary"]["command_descriptor_count"] == 8
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_application_text():
    result = _run_cli(
        "refactor-application",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "application request: blocked" in result.stdout
    assert "accepted: no" in result.stdout
    assert "applied: no" in result.stdout
    assert "blocked: missing required direction" in result.stdout
    assert "application metadata only: no command argv" in result.stdout


def test_cli_refactor_result_json():
    result = _run_cli(
        "refactor-result",
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
    assert payload["kind"] == "module-refactor-application-result"
    assert payload["result_state"] == "not-applied"
    assert payload["application_result"]["result"] == "not_applied"
    assert payload["application_result"]["write_attempted"] is False
    assert payload["application_result"]["patch_generated"] is False
    assert payload["application_result"]["files_changed"] == []
    assert payload["application_result"]["validation_run"] is False
    assert payload["application_result"]["rollback_required"] is False
    assert payload["application_summary"]["application_state"] == "not-accepted"
    assert payload["application_summary"]["command_descriptor_count"] == 8
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["generates_patch"] is False
    assert payload["safety"]["runs_validation"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_result_text():
    result = _run_cli(
        "refactor-result",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "application result: blocked" in result.stdout
    assert "write attempted: no" in result.stdout
    assert "patch generated: no" in result.stdout
    assert "files changed: 0" in result.stdout
    assert "validation run: no" in result.stdout
    assert "rollback required: no" in result.stdout
    assert "blocked: missing required direction" in result.stdout
    assert "result metadata only: no command argv" in result.stdout


def test_cli_refactor_handoff_json():
    result = _run_cli(
        "refactor-handoff",
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
    assert payload["kind"] == "module-refactor-handoff-summary"
    assert payload["handoff_state"] == "ready-for-review"
    assert payload["handoff_summary"]["public_text_ready"] is False
    assert payload["handoff_summary"]["pull_request_ready"] is False
    assert payload["handoff_summary"]["comment_ready"] is False
    assert payload["application_result_summary"]["kind"] == (
        "module-refactor-application-result"
    )
    assert payload["application_result_summary"]["application_result"] == (
        "not_applied"
    )
    assert payload["safety"]["handoff_summary_only"] is True
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["generates_patch"] is False
    assert payload["safety"]["runs_validation"] is False
    assert payload["safety"]["pull_request_created"] is False
    assert payload["safety"]["comment_written"] is False
    assert payload["safety"]["project_mutation"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_handoff_text():
    result = _run_cli(
        "refactor-handoff",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "refactor handoff: blocked" in result.stdout
    assert "write attempted: no" in result.stdout
    assert "patch generated: no" in result.stdout
    assert "files changed: 0" in result.stdout
    assert "validation run: no" in result.stdout
    assert "public text ready: no" in result.stdout
    assert "pull request ready: no" in result.stdout
    assert "comment ready: no" in result.stdout
    assert "blocked: missing required direction" in result.stdout
    assert "summary-only handoff: no command argv" in result.stdout


def test_cli_refactor_checklist_json():
    result = _run_cli(
        "refactor-checklist",
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
    assert payload["kind"] == "module-refactor-checklist-summary"
    assert payload["checklist_state"] == "ready-for-review"
    assert payload["handoff_summary"]["ready_for_maintainer_review"] is True
    assert payload["result_summary"]["application_result"] == "not_applied"
    assert payload["result_summary"]["write_attempted"] is False
    assert payload["result_summary"]["patch_generated"] is False
    assert payload["result_summary"]["validation_run"] is False
    assert payload["safety"]["checklist_summary_only"] is True
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["generates_patch"] is False
    assert payload["safety"]["runs_validation"] is False
    assert payload["safety"]["runs_shell"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_checklist_text():
    result = _run_cli(
        "refactor-checklist",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "refactor checklist: blocked" in result.stdout
    assert "ready for maintainer review: no" in result.stdout
    assert "validation run: no" in result.stdout
    assert "approval decision: blocked" in result.stdout
    assert "application result: not_applied" in result.stdout
    assert "checklist: preflight (blocked)" in result.stdout
    assert "blocked: missing required direction" in result.stdout
    assert "summary-only checklist: no command argv" in result.stdout


def test_cli_refactor_session_json():
    result = _run_cli(
        "refactor-session",
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
    assert payload["kind"] == "module-refactor-session-status"
    assert payload["session_state"] == "ready-for-review"
    assert payload["current_stage"] == "maintainer-review"
    assert payload["session_summary"]["ready_for_maintainer_review"] is True
    assert payload["session_summary"]["incomplete_required_count"] == 5
    assert payload["result_summary"]["application_result"] == "not_applied"
    assert payload["result_summary"]["write_attempted"] is False
    assert payload["result_summary"]["patch_generated"] is False
    assert payload["result_summary"]["validation_run"] is False
    assert payload["safety"]["session_status_only"] is True
    assert payload["safety"]["session_persistence"] is False
    assert payload["safety"]["status_writeback"] is False
    assert payload["safety"]["notification_dispatched"] is False
    assert payload["safety"]["writes_files"] is False
    assert payload["safety"]["generates_patch"] is False
    assert payload["safety"]["runs_validation"] is False
    assert payload["safety"]["runs_shell"] is False
    assert '"argv"' not in result.stdout


def test_cli_refactor_session_text():
    result = _run_cli(
        "refactor-session",
        str(FIXTURE),
        "--action",
        "extract-port",
        "--module",
        "top_mod",
        "--port-name",
        "valid_i",
        "--format",
        "text",
    )
    assert result.returncode == 0, result.stderr
    assert "refactor session: blocked" in result.stdout
    assert "current stage: preflight-blocked" in result.stdout
    assert "ready for maintainer review: no" in result.stdout
    assert "validation run: no" in result.stdout
    assert "approval decision: blocked" in result.stdout
    assert "application result: not_applied" in result.stdout
    assert "session item: preflight (blocked)" in result.stdout
    assert "blocked: missing required direction" in result.stdout
    assert "summary-only session status: no command argv" in result.stdout


def test_cli_organization_missing_path_exits_nonzero():
    result = _run_cli("organization", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_boundary_audit_missing_path_exits_nonzero():
    result = _run_cli("boundary-audit", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_module_duplicates_missing_path_exits_nonzero():
    result = _run_cli("module-duplicates", str(FIXTURE.parent / "missing.sv"))
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


def test_cli_hierarchy_cycles_missing_path_exits_nonzero():
    result = _run_cli("hierarchy-cycles", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_unresolved_instances_missing_path_exits_nonzero():
    result = _run_cli("unresolved-instances", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_module_roots_missing_path_exits_nonzero():
    result = _run_cli("module-roots", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_module_orphans_missing_path_exits_nonzero():
    result = _run_cli("module-orphans", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_module_fanout_missing_path_exits_nonzero():
    result = _run_cli("module-fanout", str(FIXTURE.parent / "missing.sv"))
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_cli_module_fanin_missing_path_exits_nonzero():
    result = _run_cli("module-fanin", str(FIXTURE.parent / "missing.sv"))
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


def test_cli_refactor_approval_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-approval",
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


def test_cli_refactor_application_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-application",
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


def test_cli_refactor_result_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-result",
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


def test_cli_refactor_handoff_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-handoff",
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


def test_cli_refactor_checklist_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-checklist",
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


def test_cli_refactor_session_missing_path_exits_nonzero():
    result = _run_cli(
        "refactor-session",
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
    assert "boundary-audit <path>" in contract
    assert "module-duplicates <path>" in contract
    assert "refactor-readiness <path>" in contract
    assert "hierarchy <path>" in contract
    assert "dependencies <path>" in contract
    assert "hierarchy-cycles <path>" in contract
    assert "unresolved-instances <path>" in contract
    assert "module-roots <path>" in contract
    assert "module-leaves <path>" in contract
    assert "module-orphans <path>" in contract
    assert "module-depths <path>" in contract
    assert "module-fanout <path>" in contract
    assert "module-fanin <path>" in contract
    assert "module-health <path>" in contract
    assert "module-summary <path>" in contract
    assert "port-usage <path>" in contract
    assert "module-context <path>" in contract
    assert "refactor-impact <path>" in contract
    assert "validation-plan <path>" in contract
    assert "refactor-review <path>" in contract
    assert "refactor-approval <path>" in contract
    assert "refactor-application <path>" in contract
    assert "refactor-result <path>" in contract
    assert "refactor-handoff <path>" in contract
    assert "refactor-checklist <path>" in contract
    assert "refactor-session <path>" in contract
    assert "MODULE_ORGANIZATION_WORKFLOW.md" in contract
    assert "proposal-only" in workflow
    assert "module-boundary-audit" in workflow
    assert "module-duplicate-report" in workflow
    assert "module-refactor-readiness-summary" in workflow
    assert "module-hierarchy-view" in workflow
    assert "module-dependency-view" in workflow
    assert "module-hierarchy-cycle-report" in workflow
    assert "module-unresolved-instance-report" in workflow
    assert "module-root-candidate-report" in workflow
    assert "module-leaf-candidate-report" in workflow
    assert "module-orphan-candidate-report" in workflow
    assert "module-depth-report" in workflow
    assert "module-fanout-report" in workflow
    assert "module-fanin-report" in workflow
    assert "module-graph-health-summary" in workflow
    assert "module-summary-view" in workflow
    assert "module-port-usage-view" in workflow
    assert "module-context-bundle" in workflow
    assert "module-refactor-impact-view" in workflow
    assert "module-refactor-validation-plan" in workflow
    assert "module-refactor-review-packet" in workflow
    assert "module-refactor-approval-decision" in workflow
    assert "module-refactor-application-request" in workflow
    assert "module-refactor-application-result" in workflow
    assert "module-refactor-handoff-summary" in workflow
    assert "module-refactor-checklist-summary" in workflow
    assert "module-refactor-session-status" in workflow
    assert "proposed-not-run" in workflow
    assert "summary-only review packet" in workflow
    assert "approval decision metadata" in workflow
    assert "application request metadata" in workflow
    assert "application result metadata" in workflow
    assert "refactor handoff metadata" in workflow
    assert "refactor checklist metadata" in workflow
    assert "refactor session status metadata" in workflow
    assert "boundary audit data" in workflow
    assert "duplicate-name report" in workflow
    assert "readiness metadata" in workflow
    assert "hierarchy cycle report" in workflow
    assert "unresolved instantiation report" in workflow
    assert "root-candidate report" in workflow
    assert "module graph health summary" in workflow
    assert "does not write files" in workflow
    assert "not a full SystemVerilog parser" in workflow

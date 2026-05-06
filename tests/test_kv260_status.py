# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
sys.path.insert(0, str(SRC))

from pccx_ide_cli.kv260_status import (
    LabTraceReader,
    LauncherStatusReader,
    create_kv260_status_panel,
    format_kv260_status_panel,
    panel_to_dict,
)


LAUNCHER_FIXTURE = REPO_ROOT / "docs/examples/kv260-status/launcher-npu-status.example.json"
TRACE_FIXTURE = REPO_ROOT / "docs/examples/kv260-status/lab-trace-manifest.example.json"


def _run_cli(*args: str) -> subprocess.CompletedProcess:
    env = {
        "PYTHONPATH": str(SRC),
        "PATH": os.environ.get("PATH", ""),
    }
    return subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", *args],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_readers_parse_tiny_fixtures_as_data_only() -> None:
    launcher = LauncherStatusReader.from_json_file(LAUNCHER_FIXTURE)
    manifest = LabTraceReader.from_json_file(TRACE_FIXTURE)

    assert launcher.bitstream_loaded is False
    assert launcher.bitstream_uuid is None
    assert manifest.schema_version == "pccx.lab.kv260.trace-manifest.v0"
    assert manifest.frame_count == 1
    assert manifest.frames[0].result_payload == "a55a0001"


def test_status_panel_and_preflight_are_deterministic() -> None:
    launcher = LauncherStatusReader.from_json_file(LAUNCHER_FIXTURE)
    manifest = LabTraceReader.from_json_file(TRACE_FIXTURE)
    panel = create_kv260_status_panel(launcher, manifest)
    payload = panel_to_dict(panel)
    text = format_kv260_status_panel(panel)

    assert payload["kind"] == "kv260-status-panel"
    assert payload["launcher"]["mirror_version"] == "pccx.ide.launcher-npu-status.local-mirror.v0"
    assert payload["safety"]["launcher_execution"] is False
    assert payload["safety"]["pccx_lab_execution"] is False
    assert payload["safety"]["ssh_execution"] is False
    assert [item["item_id"] for item in payload["preflight"]["items"]] == [
        "bitstream_loaded",
        "axi_reachable",
        "manifest_available",
    ]
    assert "KV260 Status Surface" in text
    assert "execution: no launcher, no pccx-lab, no shell, no SSH, no KV260 control" in text


def test_cli_kv260_status_prints_text_and_json() -> None:
    text_result = _run_cli("kv260-status")
    assert text_result.returncode == 0, text_result.stderr
    assert "KV260 Status Surface" in text_result.stdout
    assert "launcherMirror: pccx.ide.launcher-npu-status.local-mirror.v0" in text_result.stdout
    assert "preflight:" in text_result.stdout

    json_result = _run_cli("kv260-status", "--format", "json")
    assert json_result.returncode == 0, json_result.stderr
    payload = json.loads(json_result.stdout)
    assert payload["kind"] == "kv260-status-panel"
    assert payload["lab"]["source_kind"] == "file_replay"


def test_readers_reject_unsafe_or_invalid_shapes() -> None:
    with pytest.raises(ValueError, match="bitstream_loaded"):
        LauncherStatusReader.from_object({"bitstream_loaded": "false"})

    invalid_manifest = json.loads(TRACE_FIXTURE.read_text(encoding="utf-8"))
    invalid_manifest["source_kind"] = "ssh_log_tail"
    with pytest.raises(ValueError, match="file_replay"):
        LabTraceReader.from_object(invalid_manifest)


def test_touched_sources_do_not_add_execution_paths() -> None:
    source = (SRC / "pccx_ide_cli" / "kv260_status.py").read_text(encoding="utf-8")
    combined = "\n".join([
        source,
        (REPO_ROOT / "docs/KV260_READ_ONLY_STATUS_SURFACE.md").read_text(encoding="utf-8"),
    ])
    forbidden_source_terms = [
        "subprocess",
        "os.system",
        "popen",
        "socket",
        "paramiko",
        "requests",
        "urllib",
        "write_text",
        "open(",
    ]
    for term in forbidden_source_terms:
        assert term not in source, term
    assert "/home/" not in combined
    assert "password:" not in combined.lower()

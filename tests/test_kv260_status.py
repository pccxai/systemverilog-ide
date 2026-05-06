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
    LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
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
    assert launcher.serial_probe.status == "not_run"
    assert manifest.schema_version == "pccx.lab.kv260.trace-manifest.v0"
    assert manifest.frame_count == 1
    assert manifest.frames[0].result_payload == "a55a0001"


def test_status_panel_and_preflight_are_deterministic() -> None:
    launcher_data = json.loads(LAUNCHER_FIXTURE.read_text(encoding="utf-8"))
    launcher_data["serial_probe"] = {
        "schema_version": LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
        "status": "available",
        "tty_port": "/dev/ttyUSB0",
        "login_ok": True,
        "kernel_uname": "Linux kv260 6.6.0-test #1 SMP PREEMPT aarch64 GNU/Linux",
        "xrt_present": True,
        "last_preflight_at": "2026-05-06T09:00:00Z",
    }
    launcher = LauncherStatusReader.from_object(launcher_data)
    manifest = LabTraceReader.from_json_file(TRACE_FIXTURE)
    panel = create_kv260_status_panel(launcher, manifest)
    payload = panel_to_dict(panel)
    text = format_kv260_status_panel(panel)

    assert payload["kind"] == "kv260-status-panel"
    assert payload["launcher"]["mirror_version"] == "pccx.ide.launcher-npu-status.local-mirror.v0"
    assert payload["safety"]["launcher_execution"] is False
    assert payload["safety"]["pccx_lab_execution"] is False
    assert payload["safety"]["ssh_execution"] is False
    assert payload["serial_probe"]["tty_port"] == "/dev/ttyUSB0"
    assert payload["serial_probe"]["xrt_present"] is True
    assert payload["serial_probe"]["last_preflight_at"] == "2026-05-06T09:00:00Z"
    assert [item["item_id"] for item in payload["preflight"]["items"]] == [
        "serial_tty_port",
        "serial_login",
        "serial_xrt",
        "serial_probe_timestamp",
    ]
    assert "KV260 Status Surface" in text
    assert "serial.ttyPort: /dev/ttyUSB0" in text
    assert "serial.kernelUname: Linux kv260" in text
    assert "serial.xrtPresent: yes" in text
    assert "serial.lastPreflightAt: 2026-05-06T09:00:00Z" in text
    assert "execution: no launcher, no pccx-lab, no shell, no SSH, no KV260 control" in text


def test_preflight_not_run_is_graceful_default() -> None:
    launcher = LauncherStatusReader.from_json_file(LAUNCHER_FIXTURE)
    manifest = LabTraceReader.from_json_file(TRACE_FIXTURE)
    panel = create_kv260_status_panel(launcher, manifest)
    payload = panel_to_dict(panel)
    text = format_kv260_status_panel(panel)

    assert payload["serial_probe"]["status"] == "not_run"
    assert {item["state"] for item in payload["preflight"]["items"]} == {"not_run"}
    assert "serial.ttyPort: preflight not run" in text
    assert "serial.kernelUname: preflight not run" in text
    assert "serial.xrtPresent: preflight not run" in text


def test_live_serial_probe_type_only_skips_without_data() -> None:
    raw = os.environ.get("PCCX_KV260_SERIAL_PREFLIGHT_JSON")
    if not raw:
        pytest.skip("no live KV260 serial preflight JSON")
    launcher_data = json.loads(LAUNCHER_FIXTURE.read_text(encoding="utf-8"))
    launcher_data["serial_probe"] = json.loads(raw)
    launcher = LauncherStatusReader.from_object(launcher_data)
    manifest = LabTraceReader.from_json_file(TRACE_FIXTURE)
    panel = create_kv260_status_panel(launcher, manifest)

    assert panel.launcher_status.serial_probe.schema_version == (
        LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION
    )
    assert panel.launcher_status.serial_probe.status in {"available", "blocked", "not_run"}


def test_cli_kv260_status_prints_text_and_json() -> None:
    text_result = _run_cli("kv260-status")
    assert text_result.returncode == 0, text_result.stderr
    assert "KV260 Status Surface" in text_result.stdout
    assert "launcherMirror: pccx.ide.launcher-npu-status.local-mirror.v0" in text_result.stdout
    assert "preflight:" in text_result.stdout
    assert "serial.ttyPort: preflight not run" in text_result.stdout

    json_result = _run_cli("kv260-status", "--format", "json")
    assert json_result.returncode == 0, json_result.stderr
    payload = json.loads(json_result.stdout)
    assert payload["kind"] == "kv260-status-panel"
    assert payload["lab"]["source_kind"] == "file_replay"
    assert payload["serial_probe"]["status"] == "not_run"


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

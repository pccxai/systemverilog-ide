# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


LAUNCHER_NPU_STATUS_MIRROR_VERSION = "pccx.ide.launcher-npu-status.local-mirror.v0"
LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION = "pccx.launcher.kv260-serial-preflight.v0"
TRACE_MANIFEST_SCHEMA_VERSION = "pccx.lab.kv260.trace-manifest.v0"
KV260_STATUS_PANEL_VERSION = "pccx.ide.kv260-status-panel.v0"


@dataclass(frozen=True)
class SerialPreflightStatus:
    schema_version: str
    status: str
    tty_port: str | None
    login_ok: bool | None
    kernel_uname: str | None
    xrt_present: bool | None
    last_preflight_at: str | None


@dataclass(frozen=True)
class NPUStatus:
    bitstream_loaded: bool
    bitstream_uuid: str | None
    axi_base_addr: int | None
    axi_stat_register_value: int | None
    last_error: str | None
    serial_probe: SerialPreflightStatus


@dataclass(frozen=True)
class TraceFrame:
    frame_idx: int
    axi_stat_register_value: int
    engine_completion_mask: int
    cycle_count: int
    result_payload: str | None
    error: Mapping[str, Any] | None


@dataclass(frozen=True)
class TraceManifest:
    schema_version: str
    bitstream_uuid: str
    axi_base: str
    isa_version: str
    frame_count: int
    checksums: tuple[Mapping[str, Any], ...]
    runbook_ref: str
    source_kind: str
    frames: tuple[TraceFrame, ...]


@dataclass(frozen=True)
class PreflightItem:
    item_id: str
    label: str
    state: str
    satisfied: bool
    evidence: str


@dataclass(frozen=True)
class PreflightProposal:
    kind: str
    items: tuple[PreflightItem, ...]


@dataclass(frozen=True)
class Kv260StatusPanel:
    version: str
    launcher_status: NPUStatus
    trace_manifest: TraceManifest
    preflight: PreflightProposal


class LauncherStatusReader:
    """Read-only local mirror of launcher NPU and serial preflight status."""

    @classmethod
    def from_json_text(cls, text: str) -> NPUStatus:
        return cls.from_object(json.loads(text))

    @classmethod
    def from_json_file(cls, path: Path) -> NPUStatus:
        return cls.from_json_text(path.read_text(encoding="utf-8"))

    @staticmethod
    def from_object(value: Mapping[str, Any]) -> NPUStatus:
        if not isinstance(value, Mapping):
            raise ValueError("launcher NPU status must be a JSON object")
        bitstream_loaded = _bool_field(value, "bitstream_loaded")
        bitstream_uuid = _optional_string_field(value, "bitstream_uuid")
        axi_base_addr = _optional_int_field(value, "axi_base_addr")
        axi_stat_register_value = _optional_int_field(value, "axi_stat_register_value")
        last_error = _optional_string_field(value, "last_error")
        serial_probe = _serial_preflight_status(value.get("serial_probe"))
        return NPUStatus(
            bitstream_loaded=bitstream_loaded,
            bitstream_uuid=bitstream_uuid,
            axi_base_addr=axi_base_addr,
            axi_stat_register_value=axi_stat_register_value,
            last_error=last_error,
            serial_probe=serial_probe,
        )


class LabTraceReader:
    """Read-only parser for lab#160 `TraceManifest` JSON fixtures."""

    @classmethod
    def from_json_text(cls, text: str) -> TraceManifest:
        return cls.from_object(json.loads(text))

    @classmethod
    def from_json_file(cls, path: Path) -> TraceManifest:
        return cls.from_json_text(path.read_text(encoding="utf-8"))

    @staticmethod
    def from_object(value: Mapping[str, Any]) -> TraceManifest:
        if not isinstance(value, Mapping):
            raise ValueError("trace manifest must be a JSON object")
        schema_version = _string_field(value, "schema_version")
        if schema_version != TRACE_MANIFEST_SCHEMA_VERSION:
            raise ValueError(f"unsupported trace manifest schema_version: {schema_version}")
        source_kind = _string_field(value, "source_kind")
        if source_kind != "file_replay":
            raise ValueError("only file_replay trace manifests are displayable")
        frames = tuple(_trace_frame(frame, index) for index, frame in enumerate(_list_field(value, "frames")))
        frame_count = _int_field(value, "frame_count")
        if frame_count != len(frames):
            raise ValueError("trace manifest frame_count must match inline frames")
        return TraceManifest(
            schema_version=schema_version,
            bitstream_uuid=_string_field(value, "bitstream_uuid"),
            axi_base=_string_field(value, "axi_base"),
            isa_version=_string_field(value, "isa_version"),
            frame_count=frame_count,
            checksums=tuple(_mapping_item(item, "checksums", index) for index, item in enumerate(_list_field(value, "checksums"))),
            runbook_ref=_string_field(value, "runbook_ref"),
            source_kind=source_kind,
            frames=frames,
        )


def create_preflight_proposal(status: NPUStatus, manifest: TraceManifest) -> PreflightProposal:
    del manifest
    probe = status.serial_probe
    return PreflightProposal(
        kind="kv260-preflight-proposal",
        items=(
            PreflightItem(
                item_id="serial_tty_port",
                label="serial tty port",
                state=_probe_value_state(probe, probe.tty_port is not None),
                satisfied=probe.tty_port is not None,
                evidence=_probe_evidence(probe, probe.tty_port),
            ),
            _bool_probe_item(
                "serial_login",
                "serial login",
                probe,
                probe.login_ok,
                "login OK",
                "login not OK",
            ),
            _bool_probe_item(
                "serial_xrt",
                "XRT present",
                probe,
                probe.xrt_present,
                "xrt_present true",
                "xrt_present false",
            ),
            PreflightItem(
                item_id="serial_probe_timestamp",
                label="serial preflight timestamp",
                state=_probe_value_state(probe, probe.last_preflight_at is not None),
                satisfied=probe.last_preflight_at is not None,
                evidence=_probe_evidence(probe, probe.last_preflight_at),
            ),
        ),
    )


def create_kv260_status_panel(status: NPUStatus, manifest: TraceManifest) -> Kv260StatusPanel:
    return Kv260StatusPanel(
        version=KV260_STATUS_PANEL_VERSION,
        launcher_status=status,
        trace_manifest=manifest,
        preflight=create_preflight_proposal(status, manifest),
    )


def panel_to_dict(panel: Kv260StatusPanel) -> dict[str, Any]:
    return {
        "version": panel.version,
        "kind": "kv260-status-panel",
        "launcher": {
            "mirror_version": LAUNCHER_NPU_STATUS_MIRROR_VERSION,
            "bitstream_loaded": panel.launcher_status.bitstream_loaded,
            "bitstream_uuid": panel.launcher_status.bitstream_uuid,
            "axi_base_addr": panel.launcher_status.axi_base_addr,
            "axi_stat_register_value": panel.launcher_status.axi_stat_register_value,
            "last_error": panel.launcher_status.last_error,
            "serial_probe": {
                "schema_version": panel.launcher_status.serial_probe.schema_version,
                "status": panel.launcher_status.serial_probe.status,
                "tty_port": panel.launcher_status.serial_probe.tty_port,
                "login_ok": panel.launcher_status.serial_probe.login_ok,
                "kernel_uname": panel.launcher_status.serial_probe.kernel_uname,
                "xrt_present": panel.launcher_status.serial_probe.xrt_present,
                "last_preflight_at": panel.launcher_status.serial_probe.last_preflight_at,
            },
        },
        "serial_probe": {
            "schema_version": panel.launcher_status.serial_probe.schema_version,
            "status": panel.launcher_status.serial_probe.status,
            "tty_port": panel.launcher_status.serial_probe.tty_port,
            "login_ok": panel.launcher_status.serial_probe.login_ok,
            "kernel_uname": panel.launcher_status.serial_probe.kernel_uname,
            "kernel_uname_display": _truncate_uname(panel.launcher_status.serial_probe.kernel_uname),
            "xrt_present": panel.launcher_status.serial_probe.xrt_present,
            "last_preflight_at": panel.launcher_status.serial_probe.last_preflight_at,
        },
        "lab": {
            "schema_version": panel.trace_manifest.schema_version,
            "bitstream_uuid": panel.trace_manifest.bitstream_uuid,
            "axi_base": panel.trace_manifest.axi_base,
            "isa_version": panel.trace_manifest.isa_version,
            "frame_count": panel.trace_manifest.frame_count,
            "source_kind": panel.trace_manifest.source_kind,
            "runbook_ref": panel.trace_manifest.runbook_ref,
        },
        "preflight": {
            "kind": panel.preflight.kind,
            "items": [
                {
                    "item_id": item.item_id,
                    "label": item.label,
                    "state": item.state,
                    "satisfied": item.satisfied,
                    "evidence": item.evidence,
                }
                for item in panel.preflight.items
            ],
        },
        "safety": {
            "read_only": True,
            "launcher_execution": False,
            "pccx_lab_execution": False,
            "shell_execution": False,
            "ssh_execution": False,
            "kv260_control": False,
            "write_back": False,
        },
    }


def format_kv260_status_panel(panel: Kv260StatusPanel) -> str:
    status = panel.launcher_status
    probe = status.serial_probe
    manifest = panel.trace_manifest
    lines = [
        "KV260 Status Surface",
        f"version: {panel.version}",
        f"launcherMirror: {LAUNCHER_NPU_STATUS_MIRROR_VERSION}",
        f"launcher.bitstreamLoaded: {_yes_no(status.bitstream_loaded)}",
        f"launcher.bitstreamUuid: {status.bitstream_uuid or 'unavailable'}",
        f"launcher.axiBaseAddr: {_hex_or_unavailable(status.axi_base_addr)}",
        f"launcher.axiStatus: {_hex_or_unavailable(status.axi_stat_register_value)}",
        f"launcher.lastError: {status.last_error or 'none'}",
        f"serial.ttyPort: {probe.tty_port or 'preflight not run'}",
        f"serial.kernelUname: {_truncate_uname(probe.kernel_uname)}",
        f"serial.xrtPresent: {_optional_yes_no(probe.xrt_present)}",
        f"serial.lastPreflightAt: {probe.last_preflight_at or 'preflight not run'}",
        f"lab.schema: {manifest.schema_version}",
        f"lab.sourceKind: {manifest.source_kind}",
        f"lab.frames: {manifest.frame_count}",
        f"lab.axiBase: {manifest.axi_base}",
        f"lab.isaVersion: {manifest.isa_version}",
        "preflight:",
    ]
    for item in panel.preflight.items:
        lines.append(f"- {item.label}: {item.state} ({item.evidence})")
    lines.extend([
        "execution: no launcher, no pccx-lab, no shell, no SSH, no KV260 control",
        "writeBack: no",
    ])
    return "\n".join(lines) + "\n"


def default_launcher_status_path(repo_root: Path) -> Path:
    return repo_root / "docs" / "examples" / "kv260-status" / "launcher-npu-status.example.json"


def default_trace_manifest_path(repo_root: Path) -> Path:
    return repo_root / "docs" / "examples" / "kv260-status" / "lab-trace-manifest.example.json"


def _bool_field(value: Mapping[str, Any], key: str) -> bool:
    field = value.get(key)
    if not isinstance(field, bool):
        raise ValueError(f"{key} must be a boolean")
    return field


def _optional_bool_field(value: Mapping[str, Any], key: str) -> bool | None:
    field = value.get(key)
    if field is None:
        return None
    if not isinstance(field, bool):
        raise ValueError(f"{key} must be null or a boolean")
    return field


def _int_field(value: Mapping[str, Any], key: str) -> int:
    field = value.get(key)
    if not isinstance(field, int) or isinstance(field, bool) or field < 0:
        raise ValueError(f"{key} must be a non-negative integer")
    return field


def _optional_int_field(value: Mapping[str, Any], key: str) -> int | None:
    field = value.get(key)
    if field is None:
        return None
    if not isinstance(field, int) or isinstance(field, bool) or field < 0:
        raise ValueError(f"{key} must be null or a non-negative integer")
    return field


def _string_field(value: Mapping[str, Any], key: str) -> str:
    field = value.get(key)
    if not isinstance(field, str) or not field.strip() or "\n" in field or "\r" in field:
        raise ValueError(f"{key} must be a non-empty single-line string")
    return field


def _optional_string_field(value: Mapping[str, Any], key: str) -> str | None:
    field = value.get(key)
    if field is None:
        return None
    if not isinstance(field, str) or "\n" in field or "\r" in field:
        raise ValueError(f"{key} must be null or a single-line string")
    return field


def _serial_preflight_status(value: Any) -> SerialPreflightStatus:
    if value is None:
        value = {
            "schema_version": LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
            "status": "not_run",
            "tty_port": None,
            "login_ok": None,
            "kernel_uname": None,
            "xrt_present": None,
            "last_preflight_at": None,
        }
    if not isinstance(value, Mapping):
        raise ValueError("serial_probe must be a JSON object")
    schema_version = value.get("schema_version") or LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION
    if schema_version != LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION:
        raise ValueError(
            "serial_probe.schema_version must be "
            f"{LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION}"
        )
    status = value.get("status") or "not_run"
    if status not in {"available", "blocked", "not_run"}:
        raise ValueError("serial_probe.status must be available, blocked, or not_run")
    return SerialPreflightStatus(
        schema_version=schema_version,
        status=status,
        tty_port=_optional_string_field(value, "tty_port"),
        login_ok=_optional_bool_field(value, "login_ok"),
        kernel_uname=_optional_string_field(value, "kernel_uname"),
        xrt_present=_optional_bool_field(value, "xrt_present"),
        last_preflight_at=_optional_string_field(
            {"last_preflight_at": value.get("last_preflight_at", value.get("checked_at"))},
            "last_preflight_at",
        ),
    )


def _list_field(value: Mapping[str, Any], key: str) -> list[Any]:
    field = value.get(key)
    if not isinstance(field, list):
        raise ValueError(f"{key} must be an array")
    return field


def _mapping_item(value: Any, key: str, index: int) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{key}[{index}] must be an object")
    return value


def _trace_frame(value: Any, index: int) -> TraceFrame:
    item = _mapping_item(value, "frames", index)
    result_payload = item.get("result_payload")
    if result_payload is not None and not isinstance(result_payload, str):
        raise ValueError(f"frames[{index}].result_payload must be null or a string")
    error = item.get("error")
    if error is not None and not isinstance(error, Mapping):
        raise ValueError(f"frames[{index}].error must be null or an object")
    return TraceFrame(
        frame_idx=_int_field(item, "frame_idx"),
        axi_stat_register_value=_int_field(item, "axi_stat_register_value"),
        engine_completion_mask=_int_field(item, "engine_completion_mask"),
        cycle_count=_int_field(item, "cycle_count"),
        result_payload=result_payload,
        error=error,
    )


def _hex_or_unavailable(value: int | None) -> str:
    return "unavailable" if value is None else f"0x{value:x}"


def _yes_no(value: bool) -> str:
    return "yes" if value else "no"


def _optional_yes_no(value: bool | None) -> str:
    if value is None:
        return "preflight not run"
    return _yes_no(value)


def _probe_value_state(probe: SerialPreflightStatus, present: bool) -> str:
    if probe.status == "not_run":
        return "not_run"
    return "pass" if present else "blocked"


def _probe_evidence(probe: SerialPreflightStatus, value: str | None) -> str:
    if probe.status == "not_run":
        return "preflight not run"
    return value or "unavailable"


def _bool_probe_item(
    item_id: str,
    label: str,
    probe: SerialPreflightStatus,
    value: bool | None,
    true_text: str,
    false_text: str,
) -> PreflightItem:
    if probe.status == "not_run":
        return PreflightItem(
            item_id=item_id,
            label=label,
            state="not_run",
            satisfied=False,
            evidence="preflight not run",
        )
    return PreflightItem(
        item_id=item_id,
        label=label,
        state="pass" if value else "blocked",
        satisfied=value is True,
        evidence=true_text if value else false_text,
    )


def _truncate_uname(value: str | None, max_characters: int = 96) -> str:
    if not value:
        return "preflight not run"
    if len(value) <= max_characters:
        return value
    return value[: max_characters - 3] + "..."

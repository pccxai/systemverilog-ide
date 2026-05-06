// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const LAUNCHER_NPU_STATUS_MIRROR_VERSION =
  "pccx.ide.launcher-npu-status.local-mirror.v0";
export const LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION =
  "pccx.launcher.kv260-serial-preflight.v0";
export const TRACE_MANIFEST_SCHEMA_VERSION = "pccx.lab.kv260.trace-manifest.v0";
export const KV260_STATUS_PANEL_VERSION = "pccx.ide.kv260-status-panel.v0";

export const DEFAULT_SERIAL_PREFLIGHT_STATUS = Object.freeze({
  schema_version: LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION,
  status: "not_run",
  tty_port: null,
  login_ok: null,
  kernel_uname: null,
  xrt_present: null,
  last_preflight_at: null,
});

export const DEFAULT_LAUNCHER_NPU_STATUS = Object.freeze({
  bitstream_loaded: false,
  bitstream_uuid: null,
  axi_base_addr: null,
  axi_stat_register_value: null,
  last_error: "fixture only; lower-layer evidence not supplied",
  serial_probe: DEFAULT_SERIAL_PREFLIGHT_STATUS,
});

export const DEFAULT_TRACE_MANIFEST = Object.freeze({
  schema_version: TRACE_MANIFEST_SCHEMA_VERSION,
  bitstream_uuid: "00000000-0000-0000-0000-000000000160",
  axi_base: "0x00000000a0000000",
  isa_version: "pccx_v002",
  frame_count: 1,
  checksums: Object.freeze([
    Object.freeze({
      algorithm: "sha256",
      value: "fixture-only-not-a-hardware-capture",
      frame_idx: null,
    }),
  ]),
  runbook_ref: "pccxai/pccx-lab#160",
  source_kind: "file_replay",
  frames: Object.freeze([
    Object.freeze({
      frame_idx: 0,
      axi_stat_register_value: 1,
      engine_completion_mask: 3,
      cycle_count: 128,
      result_payload: "a55a0001",
    }),
  ]),
});

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const PRIVATE_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const MODEL_ARTIFACT_PATTERN =
  /\.(?:gguf|safetensors|ckpt|pt|pth|onnx|xclbin|bit)(?:\s|$|["'])/i;
const UNSUPPORTED_MARKER_PARTS = Object.freeze([
  ["production", "ready"],
  ["marketplace", "ready"],
  ["stable", "api"],
  ["stable", "abi"],
  ["kv260 inference ", "works"],
  ["gemma 3n e4b runs on ", "kv260"],
  ["20 tok/s ", "achieved"],
  ["timing ", "closed"],
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function assertSafeText(value, errors) {
  let text = "";
  try {
    text = JSON.stringify(value ?? {});
  } catch {
    addError(errors, "input", "must be JSON-serializable");
    return;
  }
  const lower = text.toLowerCase();
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    PRIVATE_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text)
  ) {
    addError(errors, "input", "must not include secrets, private paths, or model artifact paths");
  }
  for (const parts of UNSUPPORTED_MARKER_PARTS) {
    if (lower.includes(parts.join(""))) {
      addError(errors, "input", "must not include unsupported runtime or readiness claims");
    }
  }
}

function stringField(value, path, errors, maxCharacters = 500) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty string");
    return "";
  }
  if (
    value.length > maxCharacters ||
    value.includes("\0") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    addError(errors, path, `must be a single-line string up to ${maxCharacters} characters`);
  }
  return value;
}

function optionalStringField(value, path, errors, maxCharacters = 500) {
  if (value == null) {
    return null;
  }
  return stringField(value, path, errors, maxCharacters);
}

function boolField(value, path, errors) {
  if (typeof value !== "boolean") {
    addError(errors, path, "must be a boolean");
    return false;
  }
  return value;
}

function optionalBoolField(value, path, errors) {
  if (value == null) {
    return null;
  }
  return boolField(value, path, errors);
}

function optionalIntegerField(value, path, errors) {
  if (value == null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    addError(errors, path, "must be null or a non-negative integer");
    return null;
  }
  return value;
}

function integerField(value, path, errors) {
  if (!Number.isSafeInteger(value) || value < 0) {
    addError(errors, path, "must be a non-negative integer");
    return 0;
  }
  return value;
}

function firstPresent(value, keys) {
  for (const key of keys) {
    if (Object.hasOwn(value, key)) {
      return value[key];
    }
  }
  return undefined;
}

function arrayField(value, path, errors) {
  if (!Array.isArray(value)) {
    addError(errors, path, "must be an array");
    return [];
  }
  return value;
}

function normalizeSerialPreflightStatus(value, errors) {
  const probe = value ?? DEFAULT_SERIAL_PREFLIGHT_STATUS;
  if (!isObject(probe)) {
    addError(errors, "serial_probe", "must be an object");
    return { ...DEFAULT_SERIAL_PREFLIGHT_STATUS };
  }
  const schemaVersion = probe.schema_version ?? LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION;
  if (schemaVersion !== LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION) {
    addError(
      errors,
      "serial_probe.schema_version",
      `must be ${LAUNCHER_SERIAL_PREFLIGHT_STATUS_VERSION}`,
    );
  }
  const status = probe.status ?? "not_run";
  if (!["available", "blocked", "not_run"].includes(status)) {
    addError(errors, "serial_probe.status", "must be available, blocked, or not_run");
  }
  return {
    schema_version: schemaVersion,
    status,
    tty_port: optionalStringField(probe.tty_port, "serial_probe.tty_port", errors, 240),
    login_ok: optionalBoolField(probe.login_ok, "serial_probe.login_ok", errors),
    kernel_uname: optionalStringField(
      probe.kernel_uname,
      "serial_probe.kernel_uname",
      errors,
      500,
    ),
    xrt_present: optionalBoolField(probe.xrt_present, "serial_probe.xrt_present", errors),
    last_preflight_at: optionalStringField(
      firstPresent(probe, ["last_preflight_at", "checked_at"]),
      "serial_probe.last_preflight_at",
      errors,
      120,
    ),
  };
}

function normalizeTraceFrame(value, index, errors) {
  const frame = isObject(value) ? value : {};
  if (!isObject(value)) {
    addError(errors, `frames[${index}]`, "must be an object");
  }
  const resultPayload = frame.result_payload == null
    ? null
    : stringField(frame.result_payload, `frames[${index}].result_payload`, errors, 10000);
  const error = frame.error == null ? null : frame.error;
  if (error != null && !isObject(error)) {
    addError(errors, `frames[${index}].error`, "must be null or an object");
  }
  return {
    frame_idx: integerField(frame.frame_idx, `frames[${index}].frame_idx`, errors),
    axi_stat_register_value: integerField(
      frame.axi_stat_register_value,
      `frames[${index}].axi_stat_register_value`,
      errors,
    ),
    engine_completion_mask: integerField(
      frame.engine_completion_mask,
      `frames[${index}].engine_completion_mask`,
      errors,
    ),
    cycle_count: integerField(frame.cycle_count, `frames[${index}].cycle_count`, errors),
    result_payload: resultPayload,
    error,
  };
}

export class LauncherStatusReader {
  static consume(status = DEFAULT_LAUNCHER_NPU_STATUS) {
    const errors = [];
    if (!isObject(status)) {
      throw new Error("launcher NPU status must be an object");
    }
    assertSafeText(status, errors);
    const normalized = {
      bitstream_loaded: boolField(status.bitstream_loaded, "bitstream_loaded", errors),
      bitstream_uuid: optionalStringField(status.bitstream_uuid, "bitstream_uuid", errors, 160),
      axi_base_addr: optionalIntegerField(status.axi_base_addr, "axi_base_addr", errors),
      axi_stat_register_value: optionalIntegerField(
        status.axi_stat_register_value,
        "axi_stat_register_value",
        errors,
      ),
      last_error: optionalStringField(status.last_error, "last_error", errors, 500),
      serial_probe: normalizeSerialPreflightStatus(status.serial_probe, errors),
    };
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    return Object.freeze(normalized);
  }
}

export class LabTraceReader {
  static consume(manifest = DEFAULT_TRACE_MANIFEST) {
    const errors = [];
    if (!isObject(manifest)) {
      throw new Error("trace manifest must be an object");
    }
    assertSafeText(manifest, errors);
    const schemaVersion = stringField(manifest.schema_version, "schema_version", errors);
    if (schemaVersion !== TRACE_MANIFEST_SCHEMA_VERSION) {
      addError(errors, "schema_version", `must be ${TRACE_MANIFEST_SCHEMA_VERSION}`);
    }
    const sourceKind = stringField(manifest.source_kind, "source_kind", errors);
    if (sourceKind !== "file_replay") {
      addError(errors, "source_kind", "must be file_replay");
    }
    const frames = arrayField(manifest.frames, "frames", errors)
      .map((frame, index) => normalizeTraceFrame(frame, index, errors));
    const frameCount = integerField(manifest.frame_count, "frame_count", errors);
    if (frameCount !== frames.length) {
      addError(errors, "frame_count", "must match inline frames");
    }
    const normalized = {
      schema_version: schemaVersion,
      bitstream_uuid: stringField(manifest.bitstream_uuid, "bitstream_uuid", errors, 160),
      axi_base: stringField(manifest.axi_base, "axi_base", errors, 80),
      isa_version: stringField(manifest.isa_version, "isa_version", errors, 80),
      frame_count: frameCount,
      checksums: arrayField(manifest.checksums, "checksums", errors).map(clone),
      runbook_ref: stringField(manifest.runbook_ref, "runbook_ref", errors, 240),
      source_kind: sourceKind,
      frames,
    };
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    return Object.freeze(normalized);
  }
}

function hexOrUnavailable(value) {
  return value == null ? "unavailable" : `0x${value.toString(16)}`;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function probeEvidence(probe, value, unavailable = "preflight not run") {
  if (probe.status === "not_run") {
    return unavailable;
  }
  if (value == null || value === "") {
    return "unavailable";
  }
  return value;
}

function boolProbeItem(itemId, label, probe, value, trueText, falseText) {
  const notRun = probe.status === "not_run";
  return Object.freeze({
    itemId,
    label,
    state: notRun ? "not_run" : value ? "pass" : "blocked",
    satisfied: value === true,
    evidence: notRun ? "preflight not run" : value ? trueText : falseText,
  });
}

function truncateText(value, maxCharacters = 96) {
  if (!value) {
    return "preflight not run";
  }
  if (value.length <= maxCharacters) {
    return value;
  }
  return `${value.slice(0, maxCharacters - 3)}...`;
}

export function createPreflightProposal(launcherStatus, _traceManifest) {
  const probe = launcherStatus.serial_probe;
  return Object.freeze({
    kind: "kv260-preflight-proposal",
    items: Object.freeze([
      Object.freeze({
        itemId: "serial_tty_port",
        label: "serial tty port",
        state: probe.status === "not_run" ? "not_run" : probe.tty_port ? "pass" : "blocked",
        satisfied: Boolean(probe.tty_port),
        evidence: probeEvidence(probe, probe.tty_port),
      }),
      boolProbeItem("serial_login", "serial login", probe, probe.login_ok, "login OK", "login not OK"),
      boolProbeItem("serial_xrt", "XRT present", probe, probe.xrt_present, "xrt_present true", "xrt_present false"),
      Object.freeze({
        itemId: "serial_probe_timestamp",
        label: "serial preflight timestamp",
        state: probe.status === "not_run" ? "not_run" : probe.last_preflight_at ? "pass" : "blocked",
        satisfied: Boolean(probe.last_preflight_at),
        evidence: probeEvidence(probe, probe.last_preflight_at),
      }),
    ]),
  });
}

export function createKv260StatusPanel(inputs = {}) {
  const launcherStatus = LauncherStatusReader.consume(inputs.launcherStatus);
  const traceManifest = LabTraceReader.consume(inputs.traceManifest);
  return Object.freeze({
    version: KV260_STATUS_PANEL_VERSION,
    kind: "kv260-status-panel",
    source: Object.freeze({
      launcherTypeMirror: LAUNCHER_NPU_STATUS_MIRROR_VERSION,
      labManifestParser: "real",
      adapterOutput: true,
      executesLauncher: false,
      executesPccxLab: false,
      rawManifestParsedByUi: false,
    }),
    launcher: Object.freeze(launcherStatus),
    serialProbe: Object.freeze({
      schemaVersion: launcherStatus.serial_probe.schema_version,
      status: launcherStatus.serial_probe.status,
      ttyPort: launcherStatus.serial_probe.tty_port,
      loginOk: launcherStatus.serial_probe.login_ok,
      kernelUname: launcherStatus.serial_probe.kernel_uname,
      kernelUnameDisplay: truncateText(launcherStatus.serial_probe.kernel_uname),
      xrtPresent: launcherStatus.serial_probe.xrt_present,
      lastPreflightAt: launcherStatus.serial_probe.last_preflight_at,
    }),
    lab: Object.freeze({
      schemaVersion: traceManifest.schema_version,
      bitstreamUuid: traceManifest.bitstream_uuid,
      axiBase: traceManifest.axi_base,
      isaVersion: traceManifest.isa_version,
      frameCount: traceManifest.frame_count,
      sourceKind: traceManifest.source_kind,
      runbookRef: traceManifest.runbook_ref,
    }),
    preflight: createPreflightProposal(launcherStatus, traceManifest),
    safety: Object.freeze({
      dataOnly: true,
      readOnly: true,
      localOnly: true,
      launcherExecution: false,
      pccxLabExecution: false,
      shellExecution: false,
      sshExecution: false,
      kv260Control: false,
      providerCalls: false,
      networkCalls: false,
      telemetry: false,
      automaticUpload: false,
      writeBack: false,
    }),
  });
}

export function kv260StatusPanelJson(inputs = {}) {
  return `${JSON.stringify(createKv260StatusPanel(inputs), null, 2)}\n`;
}

export function formatKv260StatusPanel(panel = createKv260StatusPanel()) {
  const lines = [
    "KV260 Status Surface",
    `version: ${panel.version}`,
    `launcherMirror: ${panel.source.launcherTypeMirror}`,
    `launcher.bitstreamLoaded: ${yesNo(panel.launcher.bitstream_loaded)}`,
    `launcher.bitstreamUuid: ${panel.launcher.bitstream_uuid || "unavailable"}`,
    `launcher.axiBaseAddr: ${hexOrUnavailable(panel.launcher.axi_base_addr)}`,
    `launcher.axiStatus: ${hexOrUnavailable(panel.launcher.axi_stat_register_value)}`,
    `launcher.lastError: ${panel.launcher.last_error || "none"}`,
    `serial.ttyPort: ${panel.serialProbe.ttyPort || "preflight not run"}`,
    `serial.kernelUname: ${panel.serialProbe.kernelUnameDisplay}`,
    `serial.xrtPresent: ${
      panel.serialProbe.xrtPresent == null ? "preflight not run" : yesNo(panel.serialProbe.xrtPresent)
    }`,
    `serial.lastPreflightAt: ${panel.serialProbe.lastPreflightAt || "preflight not run"}`,
    `lab.schema: ${panel.lab.schemaVersion}`,
    `lab.sourceKind: ${panel.lab.sourceKind}`,
    `lab.frames: ${panel.lab.frameCount}`,
    `lab.axiBase: ${panel.lab.axiBase}`,
    `lab.isaVersion: ${panel.lab.isaVersion}`,
    "preflight:",
  ];
  for (const item of panel.preflight.items) {
    const state = item.state ?? (item.satisfied ? "pass" : "blocked");
    lines.push(`- ${item.label}: ${state} (${item.evidence})`);
  }
  lines.push("execution: no launcher, no pccx-lab, no shell, no SSH, no KV260 control");
  lines.push("writeBack: no");
  return `${lines.join("\n")}\n`;
}

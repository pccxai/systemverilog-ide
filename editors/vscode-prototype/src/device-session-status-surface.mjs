// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import {
  DEVICE_SESSION_ERROR_SEVERITIES,
  DEVICE_SESSION_STATUS_CONSUMER_VERSION,
  DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER,
  DEVICE_SESSION_STATUS_SCHEMA_VERSION,
  createDeviceSessionStatusConsumerBoundaryStatus,
} from "./device-session-status-consumer.mjs";

export const DEVICE_SESSION_STATUS_SURFACE_VERSION =
  "pccx.ideDeviceSessionStatusSurface.v0";

export const DEFAULT_DEVICE_SESSION_STATUS_CONSUMER_SUMMARY = Object.freeze({
  version: DEVICE_SESSION_STATUS_CONSUMER_VERSION,
  kind: "device-session-status-consumer",
  statusSchemaVersion: DEVICE_SESSION_STATUS_SCHEMA_VERSION,
  statusId: "device_session_status_gemma3n_e4b_kv260_placeholder",
  fixtureVersion: "device-session-status.gemma3n-e4b-kv260.2026-05-03",
  lastUpdatedSource: "pccx_launcher_issues_2_10_boundary_2026-05-03",
  statusAnswer: DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER,
  target: Object.freeze({
    device: "kv260",
    board: "xilinx_kria_kv260",
    model: "gemma3n-e4b",
  }),
  states: Object.freeze({
    connection: "not_configured",
    discovery: "not_started",
    authentication: "not_configured",
    runtime: "planned",
    modelLoad: "not_loaded",
    session: "inactive",
    logStream: "not_started",
    diagnostics: "available_as_placeholder",
    readiness: "blocked",
  }),
  statusPanel: Object.freeze({
    rowCount: 5,
    rows: Object.freeze([
      Object.freeze({
        rowId: "device_connection",
        label: "device connection",
        state: "not_configured",
        summary: "No KV260 target connection is configured by this fixture.",
        nextAction: "Run a read-only status check after a target is explicitly configured.",
      }),
      Object.freeze({
        rowId: "model_load",
        label: "model load",
        state: "not_loaded",
        summary: "Gemma 3N E4B is a target descriptor only; no model assets are loaded.",
        nextAction: "Keep model assets external until runtime evidence exists.",
      }),
      Object.freeze({
        rowId: "session_activity",
        label: "session activity",
        state: "inactive",
        summary: "No launcher session is active and no log stream has started.",
        nextAction: "Keep launch controls gated until readiness inputs are present.",
      }),
      Object.freeze({
        rowId: "pccx_lab_diagnostics",
        label: "pccx-lab diagnostics",
        state: "available_as_placeholder",
        summary: "Diagnostics handoff is represented as read-only local data only.",
        nextAction: "Use the pccx-lab CLI/core boundary later for validation, not launcher internals.",
      }),
      Object.freeze({
        rowId: "runtime_readiness",
        label: "runtime readiness",
        state: "blocked",
        summary: "Runtime, bitstream, board-smoke, and measurement evidence are still required.",
        nextAction: "Do not present the launch path as available until evidence-backed readiness changes.",
      }),
    ]),
  }),
  discoveryPathCount: 3,
  flowStepCount: 8,
  errorCount: 9,
  errorsBySeverity: Object.freeze({
    info: 0,
    warning: 0,
    blocked: 6,
    error: 0,
    placeholder: 3,
  }),
  pccxLabDiagnostics: Object.freeze({
    state: "planned",
    mode: "read_only_handoff",
    lowerBoundary: "pccx-lab CLI/core",
    automaticUpload: false,
    writeBack: false,
    executesPccxLab: false,
  }),
  safety: Object.freeze({
    dataOnly: true,
    readOnly: true,
    deterministic: true,
    launcherExecution: false,
    pccxLabExecution: false,
    pccxLabValidatorInvocation: false,
    systemverilogIdeExecution: false,
    shellExecution: false,
    touchesHardware: false,
    kv260Access: false,
    opensSerialPort: false,
    serialWrites: false,
    networkCalls: false,
    networkScan: false,
    sshExecution: false,
    authenticationAttempt: false,
    runtimeExecution: false,
    modelLoaded: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
    privatePathsIncluded: false,
    secretsIncluded: false,
    tokensIncluded: false,
    artifactBlobsIncluded: false,
    hardwareDumpsIncluded: false,
    providerCalls: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    writesArtifacts: false,
    firmwareFlashing: false,
    packageInstallation: false,
    stableApiAbiClaim: false,
  }),
  limitations: Object.freeze([
    "Data-only status panel fixture; no runtime is executed.",
    "No USB, serial, network, SSH, or authentication command is run by this contract.",
    "No model assets are bundled, loaded, or referenced by path.",
    "No KV260 hardware access, board programming, runtime start, provider call, telemetry, upload, or write-back is performed.",
    "The connection and launch flow is a gated plan until checked readiness evidence exists.",
    "This is not a release, tag, versioned compatibility commitment, MCP, LSP, IDE, marketplace, or telemetry implementation.",
  ]),
  issueRefs: Object.freeze([
    "pccxai/pccx-llm-launcher#10",
    "pccxai/pccx-llm-launcher#2",
    "pccxai/pccx-lab#50",
  ]),
});

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const PRIVATE_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const MODEL_ARTIFACT_PATTERN =
  /\.(?:gguf|safetensors|ckpt|pt|pth|onnx|xclbin|bit)(?:\s|$|["'])/i;
const UNSUPPORTED_CLAIM_PATTERNS = Object.freeze([
  /\bproduction[- ]ready\b/i,
  /\bmarketplace[- ]ready\b/i,
  /\bstable[- ]+(?:api|abi)\b/i,
  /\bkv260\s+inference\s+works\b/i,
  /\bgemma\s+3n\s+e4b\s+runs\s+on\s+kv260\b/i,
  /\b20\s+tok\/s\s+achieved\b/i,
  /\btiming\s+closed\b/i,
  /\bbitstream\s+ready\b/i,
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

function countField(value, path, errors) {
  if (!Number.isInteger(value) || value < 0) {
    addError(errors, path, "must be a non-negative integer");
    return 0;
  }
  return value;
}

function boolField(value, expected, path, errors) {
  if (typeof value !== "boolean") {
    addError(errors, path, "must be a boolean");
    return false;
  }
  if (value !== expected) {
    addError(errors, path, `must be ${expected}`);
  }
  return value;
}

function assertSafeSummaryText(summary, errors) {
  let text = "";
  try {
    text = JSON.stringify(summary ?? {});
  } catch {
    addError(errors, "summary", "must be JSON-serializable");
    return;
  }
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    PRIVATE_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text)
  ) {
    addError(errors, "summary", "must not include secrets, private paths, or model artifact paths");
  }
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      addError(errors, "summary", "must not include unsupported device/session claims");
    }
  }
}

function normalizeRows(value, errors) {
  if (!Array.isArray(value)) {
    addError(errors, "statusPanel.rows", "must be an array");
    return [];
  }
  return value.map((row, index) => {
    const item = isObject(row) ? row : {};
    if (!isObject(row)) {
      addError(errors, `statusPanel.rows[${index}]`, "must be an object");
    }
    return {
      rowId: stringField(item.rowId, `statusPanel.rows[${index}].rowId`, errors, 160),
      label: stringField(item.label, `statusPanel.rows[${index}].label`, errors, 160),
      state: stringField(item.state, `statusPanel.rows[${index}].state`, errors, 80),
      summary: stringField(item.summary, `statusPanel.rows[${index}].summary`, errors, 500),
      nextAction: stringField(
        item.nextAction,
        `statusPanel.rows[${index}].nextAction`,
        errors,
        500,
      ),
    };
  });
}

function normalizeCountMap(value, errors) {
  if (!isObject(value)) {
    addError(errors, "errorsBySeverity", "must be an object");
    return Object.fromEntries(DEVICE_SESSION_ERROR_SEVERITIES.map((severity) => [severity, 0]));
  }
  return Object.fromEntries(DEVICE_SESSION_ERROR_SEVERITIES.map((severity) => [
    severity,
    countField(value[severity], `errorsBySeverity.${severity}`, errors),
  ]));
}

function normalizeConsumerSummary(summary = DEFAULT_DEVICE_SESSION_STATUS_CONSUMER_SUMMARY) {
  const errors = [];
  if (!isObject(summary)) {
    throw new Error("device/session status summary must be an object");
  }

  assertSafeSummaryText(summary, errors);
  if (summary.version !== DEVICE_SESSION_STATUS_CONSUMER_VERSION) {
    addError(errors, "version", `must be ${DEVICE_SESSION_STATUS_CONSUMER_VERSION}`);
  }
  if (summary.kind !== "device-session-status-consumer") {
    addError(errors, "kind", "must be device-session-status-consumer");
  }
  if (summary.statusSchemaVersion !== DEVICE_SESSION_STATUS_SCHEMA_VERSION) {
    addError(errors, "statusSchemaVersion", `must be ${DEVICE_SESSION_STATUS_SCHEMA_VERSION}`);
  }
  if (summary.statusAnswer !== DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER) {
    addError(errors, "statusAnswer", `must be ${DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER}`);
  }

  const target = isObject(summary.target) ? summary.target : {};
  if (!isObject(summary.target)) {
    addError(errors, "target", "must be an object");
  }
  const states = isObject(summary.states) ? summary.states : {};
  if (!isObject(summary.states)) {
    addError(errors, "states", "must be an object");
  }
  const statusPanel = isObject(summary.statusPanel) ? summary.statusPanel : {};
  if (!isObject(summary.statusPanel)) {
    addError(errors, "statusPanel", "must be an object");
  }
  const rows = normalizeRows(statusPanel.rows, errors);
  const rowCount = countField(statusPanel.rowCount, "statusPanel.rowCount", errors);
  if (rowCount !== rows.length) {
    addError(errors, "statusPanel.rowCount", "must match statusPanel.rows length");
  }
  const errorsBySeverity = normalizeCountMap(summary.errorsBySeverity, errors);
  const errorTotal = Object.values(errorsBySeverity).reduce((sum, count) => sum + count, 0);
  const errorCount = countField(summary.errorCount, "errorCount", errors);
  if (errorTotal !== errorCount) {
    addError(errors, "errorsBySeverity", "must add up to errorCount");
  }
  const pccxLabDiagnostics = isObject(summary.pccxLabDiagnostics)
    ? summary.pccxLabDiagnostics
    : {};
  const safety = isObject(summary.safety) ? summary.safety : {};
  const limitations = Array.isArray(summary.limitations)
    ? summary.limitations.map((item, index) => stringField(item, `limitations[${index}]`, errors))
    : [];
  if (!Array.isArray(summary.limitations)) {
    addError(errors, "limitations", "must be an array");
  }
  const issueRefs = Array.isArray(summary.issueRefs)
    ? summary.issueRefs.map((item, index) => stringField(item, `issueRefs[${index}]`, errors, 160))
    : [];
  if (!Array.isArray(summary.issueRefs)) {
    addError(errors, "issueRefs", "must be an array");
  }

  const normalized = {
    version: summary.version,
    kind: summary.kind,
    statusSchemaVersion: summary.statusSchemaVersion,
    statusId: stringField(summary.statusId, "statusId", errors, 160),
    fixtureVersion: stringField(summary.fixtureVersion, "fixtureVersion", errors, 160),
    lastUpdatedSource: stringField(summary.lastUpdatedSource, "lastUpdatedSource", errors, 160),
    statusAnswer: summary.statusAnswer,
    target: {
      device: stringField(target.device, "target.device", errors, 80),
      board: stringField(target.board, "target.board", errors, 160),
      model: stringField(target.model, "target.model", errors, 160),
    },
    states: {
      connection: stringField(states.connection, "states.connection", errors, 80),
      discovery: stringField(states.discovery, "states.discovery", errors, 80),
      authentication: stringField(states.authentication, "states.authentication", errors, 80),
      runtime: stringField(states.runtime, "states.runtime", errors, 80),
      modelLoad: stringField(states.modelLoad, "states.modelLoad", errors, 80),
      session: stringField(states.session, "states.session", errors, 80),
      logStream: stringField(states.logStream, "states.logStream", errors, 80),
      diagnostics: stringField(states.diagnostics, "states.diagnostics", errors, 80),
      readiness: stringField(states.readiness, "states.readiness", errors, 80),
    },
    statusPanel: {
      rowCount,
      rows,
    },
    discoveryPathCount: countField(summary.discoveryPathCount, "discoveryPathCount", errors),
    flowStepCount: countField(summary.flowStepCount, "flowStepCount", errors),
    errorCount,
    errorsBySeverity,
    pccxLabDiagnostics: {
      state: stringField(pccxLabDiagnostics.state, "pccxLabDiagnostics.state", errors, 80),
      mode: stringField(pccxLabDiagnostics.mode, "pccxLabDiagnostics.mode", errors, 160),
      lowerBoundary: stringField(
        pccxLabDiagnostics.lowerBoundary,
        "pccxLabDiagnostics.lowerBoundary",
        errors,
        160,
      ),
      automaticUpload: boolField(
        pccxLabDiagnostics.automaticUpload,
        false,
        "pccxLabDiagnostics.automaticUpload",
        errors,
      ),
      writeBack: boolField(
        pccxLabDiagnostics.writeBack,
        false,
        "pccxLabDiagnostics.writeBack",
        errors,
      ),
      executesPccxLab: boolField(
        pccxLabDiagnostics.executesPccxLab,
        false,
        "pccxLabDiagnostics.executesPccxLab",
        errors,
      ),
    },
    safety: {
      dataOnly: boolField(safety.dataOnly, true, "safety.dataOnly", errors),
      readOnly: boolField(safety.readOnly, true, "safety.readOnly", errors),
      deterministic: boolField(safety.deterministic, true, "safety.deterministic", errors),
      launcherExecution: boolField(
        safety.launcherExecution,
        false,
        "safety.launcherExecution",
        errors,
      ),
      pccxLabExecution: boolField(
        safety.pccxLabExecution,
        false,
        "safety.pccxLabExecution",
        errors,
      ),
      pccxLabValidatorInvocation: boolField(
        safety.pccxLabValidatorInvocation,
        false,
        "safety.pccxLabValidatorInvocation",
        errors,
      ),
      systemverilogIdeExecution: boolField(
        safety.systemverilogIdeExecution,
        false,
        "safety.systemverilogIdeExecution",
        errors,
      ),
      shellExecution: boolField(safety.shellExecution, false, "safety.shellExecution", errors),
      touchesHardware: boolField(safety.touchesHardware, false, "safety.touchesHardware", errors),
      kv260Access: boolField(safety.kv260Access, false, "safety.kv260Access", errors),
      opensSerialPort: boolField(safety.opensSerialPort, false, "safety.opensSerialPort", errors),
      serialWrites: boolField(safety.serialWrites, false, "safety.serialWrites", errors),
      networkCalls: boolField(safety.networkCalls, false, "safety.networkCalls", errors),
      networkScan: boolField(safety.networkScan, false, "safety.networkScan", errors),
      sshExecution: boolField(safety.sshExecution, false, "safety.sshExecution", errors),
      authenticationAttempt: boolField(
        safety.authenticationAttempt,
        false,
        "safety.authenticationAttempt",
        errors,
      ),
      runtimeExecution: boolField(
        safety.runtimeExecution,
        false,
        "safety.runtimeExecution",
        errors,
      ),
      modelLoaded: boolField(safety.modelLoaded, false, "safety.modelLoaded", errors),
      modelExecution: boolField(safety.modelExecution, false, "safety.modelExecution", errors),
      modelWeightPathsIncluded: boolField(
        safety.modelWeightPathsIncluded,
        false,
        "safety.modelWeightPathsIncluded",
        errors,
      ),
      privatePathsIncluded: boolField(
        safety.privatePathsIncluded,
        false,
        "safety.privatePathsIncluded",
        errors,
      ),
      secretsIncluded: boolField(safety.secretsIncluded, false, "safety.secretsIncluded", errors),
      tokensIncluded: boolField(safety.tokensIncluded, false, "safety.tokensIncluded", errors),
      artifactBlobsIncluded: boolField(
        safety.artifactBlobsIncluded,
        false,
        "safety.artifactBlobsIncluded",
        errors,
      ),
      hardwareDumpsIncluded: boolField(
        safety.hardwareDumpsIncluded,
        false,
        "safety.hardwareDumpsIncluded",
        errors,
      ),
      providerCalls: boolField(safety.providerCalls, false, "safety.providerCalls", errors),
      telemetry: boolField(safety.telemetry, false, "safety.telemetry", errors),
      automaticUpload: boolField(
        safety.automaticUpload,
        false,
        "safety.automaticUpload",
        errors,
      ),
      writeBack: boolField(safety.writeBack, false, "safety.writeBack", errors),
      writesArtifacts: boolField(safety.writesArtifacts, false, "safety.writesArtifacts", errors),
      firmwareFlashing: boolField(
        safety.firmwareFlashing,
        false,
        "safety.firmwareFlashing",
        errors,
      ),
      packageInstallation: boolField(
        safety.packageInstallation,
        false,
        "safety.packageInstallation",
        errors,
      ),
      stableApiAbiClaim: boolField(
        safety.stableApiAbiClaim,
        false,
        "safety.stableApiAbiClaim",
        errors,
      ),
    },
    limitations,
    issueRefs,
  };

  if (errors.length > 0) {
    throw new Error(`invalid device/session status summary: ${errors.join("; ")}`);
  }

  return normalized;
}

export function cloneDefaultDeviceSessionStatusConsumerSummary() {
  return clone(DEFAULT_DEVICE_SESSION_STATUS_CONSUMER_SUMMARY);
}

export function createDeviceSessionStatusSurface(
  consumerSummary = DEFAULT_DEVICE_SESSION_STATUS_CONSUMER_SUMMARY,
) {
  const summary = normalizeConsumerSummary(consumerSummary);
  const boundary = createDeviceSessionStatusConsumerBoundaryStatus();
  const displaySummary = [
    summary.statusAnswer,
    `connection ${summary.states.connection}`,
    `session ${summary.states.session}`,
    "read-only",
  ].join(", ");

  return {
    version: DEVICE_SESSION_STATUS_SURFACE_VERSION,
    kind: "device-session-status-surface",
    source: {
      kind: summary.kind,
      version: summary.version,
      adapterOutput: true,
      rawStatusParsedByUi: false,
    },
    deviceSession: {
      status: "available",
      summaryAvailable: true,
      localOnly: true,
      experimental: true,
      statusAnswer: summary.statusAnswer,
      readinessState: summary.states.readiness,
    },
    fixture: {
      schemaVersion: summary.statusSchemaVersion,
      statusId: summary.statusId,
      fixtureVersion: summary.fixtureVersion,
      lastUpdatedSource: summary.lastUpdatedSource,
    },
    target: summary.target,
    states: summary.states,
    statusPanel: summary.statusPanel,
    counts: {
      discoveryPaths: summary.discoveryPathCount,
      flowSteps: summary.flowStepCount,
      errors: summary.errorCount,
      errorsBySeverity: summary.errorsBySeverity,
    },
    pccxLabDiagnostics: summary.pccxLabDiagnostics,
    limitations: summary.limitations,
    issueRefs: summary.issueRefs,
    safety: {
      ...summary.safety,
      localOnly: true,
      pccxLabValidatorInvocation: false,
      shellExecution: false,
      kv260RuntimeExecution: false,
      mcpCalls: false,
      lspImplemented: false,
      marketplaceFlow: false,
    },
    boundary: {
      version: boundary.version,
      supportedSchemaVersion: boundary.supportedSchemaVersion,
      expectedStatusAnswer: boundary.expectedStatusAnswer,
      coordinationRefs: [...boundary.coordinationRefs],
      fixtureConsumer: boundary.fixtureConsumer,
      readOnly: boundary.readOnly,
      invokesLauncher: boundary.invokesLauncher,
      invokesPccxLab: boundary.invokesPccxLab,
      invokesPccxLabValidator: boundary.invokesPccxLabValidator,
      shellExecution: boundary.shellExecution,
      opensSerialPort: boundary.opensSerialPort,
      serialWrites: boundary.serialWrites,
      sshExecution: boundary.sshExecution,
      networkCalls: boundary.networkCalls,
      networkScan: boundary.networkScan,
      touchesHardware: boundary.touchesHardware,
      kv260Access: boundary.kv260Access,
      runtimeExecution: boundary.runtimeExecution,
      modelExecution: boundary.modelExecution,
      modelWeightPathsIncluded: boundary.modelWeightPathsIncluded,
      providerCalls: boundary.providerCalls,
      mcpCalls: boundary.mcpCalls,
      lspImplemented: boundary.lspImplemented,
      marketplaceFlow: boundary.marketplaceFlow,
      telemetry: boundary.telemetry,
      automaticUpload: boundary.automaticUpload,
      writeBack: boundary.writeBack,
    },
    display: {
      title: "Device Session Status",
      summary: displaySummary,
      detailLines: [
        `schema: ${summary.statusSchemaVersion}`,
        `target: ${summary.target.model} on ${summary.target.device}`,
        `connection: ${summary.states.connection}`,
        `discovery: ${summary.states.discovery}`,
        `authentication: ${summary.states.authentication}`,
        `runtime: ${summary.states.runtime}`,
        `modelLoad: ${summary.states.modelLoad}`,
        `session: ${summary.states.session}`,
        `logStream: ${summary.states.logStream}`,
        `readiness: ${summary.states.readiness}`,
        `statusRows: ${summary.statusPanel.rowCount}`,
        `errors: ${summary.errorCount}`,
        "safety: data-only, read-only, local-only",
      ],
    },
  };
}

export function deviceSessionStatusSurfaceJson(
  consumerSummary = DEFAULT_DEVICE_SESSION_STATUS_CONSUMER_SUMMARY,
) {
  return `${JSON.stringify(createDeviceSessionStatusSurface(consumerSummary), null, 2)}\n`;
}

export function formatDeviceSessionStatusSurface(surface) {
  const status = surface ?? createDeviceSessionStatusSurface();
  return [
    status.display?.title ?? "Device Session Status",
    `schema: ${status.fixture?.schemaVersion ?? ""}`,
    `target: ${status.target?.model ?? ""} on ${status.target?.device ?? ""}`,
    `statusAnswer: ${status.deviceSession?.statusAnswer ?? ""}`,
    `connection: ${status.states?.connection ?? ""}`,
    `discovery: ${status.states?.discovery ?? ""}`,
    `authentication: ${status.states?.authentication ?? ""}`,
    `runtime: ${status.states?.runtime ?? ""}`,
    `modelLoad: ${status.states?.modelLoad ?? ""}`,
    `session: ${status.states?.session ?? ""}`,
    `logStream: ${status.states?.logStream ?? ""}`,
    `readiness: ${status.states?.readiness ?? ""}`,
    `statusRows: ${status.statusPanel?.rowCount ?? 0}`,
    `errors: ${status.counts?.errors ?? 0}`,
    `readOnly: ${status.safety?.readOnly ? "yes" : "no"}`,
    `dataOnly: ${status.safety?.dataOnly ? "yes" : "no"}`,
    "execution: no launcher, no pccx-lab, no serial/network/SSH, no KV260 runtime, no providers",
  ].join("\n");
}

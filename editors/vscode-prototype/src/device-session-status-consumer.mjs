// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const DEVICE_SESSION_STATUS_CONSUMER_VERSION =
  "pccx.ideDeviceSessionStatusConsumer.v0";
export const DEVICE_SESSION_STATUS_SCHEMA_VERSION = "pccx.deviceSessionStatus.v0";
export const DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER =
  "device_session_status_placeholder_blocked";
export const DEVICE_SESSION_STATUS_COORDINATION_REFS = Object.freeze([
  "pccxai/systemverilog-ide#61",
  "pccxai/pccx-llm-launcher#2",
  "pccxai/pccx-llm-launcher#10",
  "pccxai/pccx-lab#50",
]);

export const DEVICE_SESSION_STATUS_STATE_VALUES = Object.freeze([
  "target",
  "planned",
  "placeholder",
  "not_configured",
  "not_started",
  "requires_configuration",
  "ready_for_inputs",
  "blocked",
  "inactive",
  "not_loaded",
  "available_as_placeholder",
  "future_only",
]);

export const DEVICE_SESSION_ERROR_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "blocked",
  "error",
  "placeholder",
]);

const STATUS_FIELDS = Object.freeze([
  "schemaVersion",
  "statusId",
  "fixtureVersion",
  "lastUpdatedSource",
  "targetDevice",
  "targetBoard",
  "targetModel",
  "statusAnswer",
  "connectionState",
  "discoveryState",
  "authenticationState",
  "runtimeState",
  "modelLoadState",
  "sessionState",
  "logStreamState",
  "diagnosticsState",
  "readinessState",
  "statusPanel",
  "discoveryPaths",
  "connectionLaunchFlow",
  "errorTaxonomy",
  "pccxLabDiagnostics",
  "safetyFlags",
  "limitations",
  "issueRefs",
]);

const PANEL_ROW_FIELDS = Object.freeze([
  "rowId",
  "label",
  "state",
  "summary",
  "nextAction",
]);

const REQUIRED_PANEL_ROWS = Object.freeze([
  "device_connection",
  "model_load",
  "session_activity",
  "pccx_lab_diagnostics",
  "runtime_readiness",
]);

const DISCOVERY_PATH_FIELDS = Object.freeze([
  "pathId",
  "transport",
  "state",
  "summary",
  "suggestedUserAction",
]);

const DISCOVERY_TRANSPORTS = Object.freeze([
  "usb_serial",
  "network_host",
  "serial_console",
]);

const FLOW_STEP_FIELDS = Object.freeze([
  "stepId",
  "order",
  "stage",
  "state",
  "userAction",
  "launcherAction",
  "statusPanelUpdate",
  "sideEffectPolicy",
]);

const ERROR_FIELDS = Object.freeze([
  "errorId",
  "stage",
  "severity",
  "state",
  "userMessage",
  "suggestedRemediation",
  "claimBoundary",
]);

const REQUIRED_TRUE_SAFETY_FLAGS = Object.freeze([
  "dataOnly",
  "readOnly",
  "deterministic",
]);

const REQUIRED_FALSE_SAFETY_FLAGS = Object.freeze([
  "writesArtifacts",
  "touchesHardware",
  "kv260Access",
  "opensSerialPort",
  "serialWrites",
  "networkCalls",
  "networkScan",
  "sshExecution",
  "authenticationAttempt",
  "runtimeExecution",
  "modelLoaded",
  "modelExecution",
  "modelWeightPathsIncluded",
  "privatePathsIncluded",
  "secretsIncluded",
  "tokensIncluded",
  "generatedBlobsIncluded",
  "hardwareDumpsIncluded",
  "providerCalls",
  "telemetry",
  "automaticUpload",
  "writeBack",
  "executesPccxLab",
  "executesSystemverilogIde",
  "firmwareFlashing",
  "packageInstallation",
  "stableApiAbiClaim",
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const MODEL_ARTIFACT_PATTERN =
  /\.(?:gguf|safetensors|ckpt|pt|pth|onnx|xclbin|bit)(?:\s|$|["'])/i;
const RAW_ARTIFACT_PATTERN =
  /\b(?:raw[_-]?full[_-]?logs|hardware[_-]?dump|generated[_-]?blob)\b\s*[:=]/i;
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

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
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

function ensureValue(actual, expected, path, errors) {
  if (actual !== expected) {
    addError(errors, path, `must be ${expected}`);
  }
}

function ensureAllowed(actual, allowed, path, errors) {
  if (!allowed.includes(actual)) {
    addError(errors, path, `must be one of: ${allowed.join(", ")}`);
  }
}

function arrayPath(root, path, errors) {
  let current = root;
  for (const part of path) {
    current = isObject(current) ? current[part] : undefined;
  }
  if (!Array.isArray(current)) {
    addError(errors, path.join("."), "must be an array");
    return [];
  }
  return current;
}

function stringPath(root, path, errors, maxCharacters = 500) {
  let current = root;
  for (const part of path) {
    current = isObject(current) ? current[part] : undefined;
  }
  return stringField(current, path.join("."), errors, maxCharacters);
}

function assertSafeSerializedText(status, errors) {
  let text = "";
  try {
    text = JSON.stringify(status ?? {});
  } catch {
    addError(errors, "status", "must be JSON-serializable");
    return;
  }
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    HOME_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text) ||
    RAW_ARTIFACT_PATTERN.test(text)
  ) {
    addError(
      errors,
      "status",
      "must not include secrets, private paths, raw artifacts, or model artifact paths",
    );
  }
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      addError(errors, "status", "must not include unsupported device/session claims");
    }
  }
}

function validateState(value, path, errors) {
  const state = stringField(value, path, errors, 80);
  ensureAllowed(state, DEVICE_SESSION_STATUS_STATE_VALUES, path, errors);
  return state;
}

function validateStatusPanel(status, errors) {
  const rows = arrayPath(status, ["statusPanel"], errors);
  if (rows.length === 0) {
    addError(errors, "statusPanel", "must contain at least one row");
  }
  const seen = new Set();
  const normalized = rows.map((row, index) => {
    if (!isObject(row)) {
      addError(errors, `statusPanel[${index}]`, "must be an object");
      return {
        rowId: "",
        label: "",
        state: "",
        summary: "",
        nextAction: "",
      };
    }
    for (const field of PANEL_ROW_FIELDS) {
      if (!Object.hasOwn(row, field)) {
        addError(errors, `statusPanel[${index}].${field}`, "is required");
      }
    }
    const rowId = stringField(row.rowId, `statusPanel[${index}].rowId`, errors, 160);
    const state = validateState(row.state, `statusPanel[${index}].state`, errors);
    seen.add(rowId);
    return {
      rowId,
      label: stringField(row.label, `statusPanel[${index}].label`, errors, 160),
      state,
      summary: stringField(row.summary, `statusPanel[${index}].summary`, errors, 500),
      nextAction: stringField(row.nextAction, `statusPanel[${index}].nextAction`, errors, 500),
    };
  });

  for (const rowId of REQUIRED_PANEL_ROWS) {
    if (!seen.has(rowId)) {
      addError(errors, "statusPanel", `must include row ${rowId}`);
    }
  }
  return normalized;
}

function validateDiscoveryPaths(status, errors) {
  const paths = arrayPath(status, ["discoveryPaths"], errors);
  if (paths.length === 0) {
    addError(errors, "discoveryPaths", "must contain at least one item");
  }
  paths.forEach((path, index) => {
    if (!isObject(path)) {
      addError(errors, `discoveryPaths[${index}]`, "must be an object");
      return;
    }
    for (const field of DISCOVERY_PATH_FIELDS) {
      if (!Object.hasOwn(path, field)) {
        addError(errors, `discoveryPaths[${index}].${field}`, "is required");
      }
    }
    ensureAllowed(
      stringField(path.transport, `discoveryPaths[${index}].transport`, errors, 80),
      DISCOVERY_TRANSPORTS,
      `discoveryPaths[${index}].transport`,
      errors,
    );
    validateState(path.state, `discoveryPaths[${index}].state`, errors);
    stringField(path.pathId, `discoveryPaths[${index}].pathId`, errors, 160);
    stringField(path.summary, `discoveryPaths[${index}].summary`, errors, 500);
    stringField(
      path.suggestedUserAction,
      `discoveryPaths[${index}].suggestedUserAction`,
      errors,
      500,
    );
  });
  return paths.length;
}

function validateFlowSteps(status, errors) {
  const steps = arrayPath(status, ["connectionLaunchFlow"], errors);
  if (steps.length === 0) {
    addError(errors, "connectionLaunchFlow", "must contain at least one item");
  }
  steps.forEach((step, index) => {
    if (!isObject(step)) {
      addError(errors, `connectionLaunchFlow[${index}]`, "must be an object");
      return;
    }
    for (const field of FLOW_STEP_FIELDS) {
      if (!Object.hasOwn(step, field)) {
        addError(errors, `connectionLaunchFlow[${index}].${field}`, "is required");
      }
    }
    if (!Number.isInteger(step.order) || step.order !== index + 1) {
      addError(errors, `connectionLaunchFlow[${index}].order`, "must be contiguous from 1");
    }
    for (const field of [
      "stepId",
      "stage",
      "userAction",
      "launcherAction",
      "statusPanelUpdate",
      "sideEffectPolicy",
    ]) {
      stringField(step[field], `connectionLaunchFlow[${index}].${field}`, errors, 500);
    }
    validateState(step.state, `connectionLaunchFlow[${index}].state`, errors);
  });
  return steps.length;
}

function zeroCounts(values) {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

function validateErrorTaxonomy(status, errors) {
  const items = arrayPath(status, ["errorTaxonomy"], errors);
  const bySeverity = zeroCounts(DEVICE_SESSION_ERROR_SEVERITIES);
  if (items.length === 0) {
    addError(errors, "errorTaxonomy", "must contain at least one item");
  }
  items.forEach((item, index) => {
    if (!isObject(item)) {
      addError(errors, `errorTaxonomy[${index}]`, "must be an object");
      return;
    }
    for (const field of ERROR_FIELDS) {
      if (!Object.hasOwn(item, field)) {
        addError(errors, `errorTaxonomy[${index}].${field}`, "is required");
      }
    }
    const severity = stringField(item.severity, `errorTaxonomy[${index}].severity`, errors, 80);
    ensureAllowed(
      severity,
      DEVICE_SESSION_ERROR_SEVERITIES,
      `errorTaxonomy[${index}].severity`,
      errors,
    );
    if (Object.hasOwn(bySeverity, severity)) {
      bySeverity[severity] += 1;
    }
    validateState(item.state, `errorTaxonomy[${index}].state`, errors);
    for (const field of ["errorId", "stage", "userMessage", "suggestedRemediation", "claimBoundary"]) {
      stringField(item[field], `errorTaxonomy[${index}].${field}`, errors, 500);
    }
  });
  return {
    count: items.length,
    bySeverity,
  };
}

function validatePccxLabDiagnostics(status, errors) {
  ensureValue(
    stringPath(status, ["pccxLabDiagnostics", "state"], errors, 80),
    "planned",
    "pccxLabDiagnostics.state",
    errors,
  );
  ensureValue(
    stringPath(status, ["pccxLabDiagnostics", "mode"], errors, 160),
    "read_only_handoff",
    "pccxLabDiagnostics.mode",
    errors,
  );
  stringPath(status, ["pccxLabDiagnostics", "lowerBoundary"], errors, 160);
  boolField(status.pccxLabDiagnostics?.automaticUpload, false, "pccxLabDiagnostics.automaticUpload", errors);
  boolField(status.pccxLabDiagnostics?.writeBack, false, "pccxLabDiagnostics.writeBack", errors);
  boolField(status.pccxLabDiagnostics?.executesPccxLab, false, "pccxLabDiagnostics.executesPccxLab", errors);
  return {
    state: "planned",
    mode: "read_only_handoff",
    lowerBoundary: stringPath(status, ["pccxLabDiagnostics", "lowerBoundary"], errors, 160),
    automaticUpload: false,
    writeBack: false,
    executesPccxLab: false,
  };
}

function validateSafety(status, errors) {
  const safety = isObject(status.safetyFlags) ? status.safetyFlags : {};
  if (!isObject(status.safetyFlags)) {
    addError(errors, "safetyFlags", "must be an object");
  }

  for (const flag of REQUIRED_TRUE_SAFETY_FLAGS) {
    boolField(safety[flag], true, `safetyFlags.${flag}`, errors);
  }
  for (const flag of REQUIRED_FALSE_SAFETY_FLAGS) {
    boolField(safety[flag], false, `safetyFlags.${flag}`, errors);
  }

  return {
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
    generatedBlobsIncluded: false,
    hardwareDumpsIncluded: false,
    providerCalls: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    writesArtifacts: false,
    firmwareFlashing: false,
    packageInstallation: false,
    stableApiAbiClaim: false,
  };
}

export function createDeviceSessionStatusConsumerBoundaryStatus() {
  return {
    version: DEVICE_SESSION_STATUS_CONSUMER_VERSION,
    kind: "device-session-status-consumer-boundary",
    supportedSchemaVersion: DEVICE_SESSION_STATUS_SCHEMA_VERSION,
    expectedStatusAnswer: DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER,
    coordinationRefs: [...DEVICE_SESSION_STATUS_COORDINATION_REFS],
    dataOnly: true,
    readOnly: true,
    fixtureConsumer: true,
    validatesLocalJson: true,
    invokesLauncher: false,
    invokesPccxLab: false,
    invokesPccxLabValidator: false,
    shellExecution: false,
    opensSerialPort: false,
    serialWrites: false,
    sshExecution: false,
    networkCalls: false,
    networkScan: false,
    touchesHardware: false,
    kv260Access: false,
    runtimeExecution: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
    providerCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    stableApi: false,
  };
}

export function consumeDeviceSessionStatus(status = {}) {
  const errors = [];
  if (!isObject(status)) {
    throw new Error("device/session status must be an object");
  }

  for (const field of STATUS_FIELDS) {
    if (!Object.hasOwn(status, field)) {
      addError(errors, field, "is required");
    }
  }

  assertSafeSerializedText(status, errors);

  ensureValue(status.schemaVersion, DEVICE_SESSION_STATUS_SCHEMA_VERSION, "schemaVersion", errors);
  ensureValue(
    status.statusId,
    "device_session_status_gemma3n_e4b_kv260_placeholder",
    "statusId",
    errors,
  );
  ensureValue(
    status.statusAnswer,
    DEVICE_SESSION_STATUS_EXPECTED_STATUS_ANSWER,
    "statusAnswer",
    errors,
  );
  ensureValue(status.targetDevice, "kv260", "targetDevice", errors);
  ensureValue(status.targetBoard, "xilinx_kria_kv260", "targetBoard", errors);
  ensureValue(status.targetModel, "gemma3n-e4b", "targetModel", errors);

  const states = {
    connection: validateState(status.connectionState, "connectionState", errors),
    discovery: validateState(status.discoveryState, "discoveryState", errors),
    authentication: validateState(status.authenticationState, "authenticationState", errors),
    runtime: validateState(status.runtimeState, "runtimeState", errors),
    modelLoad: validateState(status.modelLoadState, "modelLoadState", errors),
    session: validateState(status.sessionState, "sessionState", errors),
    logStream: validateState(status.logStreamState, "logStreamState", errors),
    diagnostics: validateState(status.diagnosticsState, "diagnosticsState", errors),
    readiness: validateState(status.readinessState, "readinessState", errors),
  };
  ensureValue(states.connection, "not_configured", "connectionState", errors);
  ensureValue(states.discovery, "not_started", "discoveryState", errors);
  ensureValue(states.authentication, "not_configured", "authenticationState", errors);
  ensureValue(states.runtime, "planned", "runtimeState", errors);
  ensureValue(states.modelLoad, "not_loaded", "modelLoadState", errors);
  ensureValue(states.session, "inactive", "sessionState", errors);
  ensureValue(states.logStream, "not_started", "logStreamState", errors);
  ensureValue(states.diagnostics, "available_as_placeholder", "diagnosticsState", errors);
  ensureValue(states.readiness, "blocked", "readinessState", errors);

  const rows = validateStatusPanel(status, errors);
  const discoveryPathCount = validateDiscoveryPaths(status, errors);
  const flowStepCount = validateFlowSteps(status, errors);
  const errorSummary = validateErrorTaxonomy(status, errors);
  const pccxLabDiagnostics = validatePccxLabDiagnostics(status, errors);
  const safety = validateSafety(status, errors);
  const limitations = arrayPath(status, ["limitations"], errors).map((item, index) => (
    stringField(item, `limitations[${index}]`, errors, 500)
  ));
  const issueRefs = arrayPath(status, ["issueRefs"], errors).map((item, index) => (
    stringField(item, `issueRefs[${index}]`, errors, 160)
  ));
  const statusId = stringField(status.statusId, "statusId", errors, 160);
  const fixtureVersion = stringField(status.fixtureVersion, "fixtureVersion", errors, 160);
  const lastUpdatedSource = stringField(
    status.lastUpdatedSource,
    "lastUpdatedSource",
    errors,
    160,
  );

  if (errors.length > 0) {
    throw new Error(`invalid device/session status: ${errors.join("; ")}`);
  }

  return {
    version: DEVICE_SESSION_STATUS_CONSUMER_VERSION,
    kind: "device-session-status-consumer",
    statusSchemaVersion: status.schemaVersion,
    statusId,
    fixtureVersion,
    lastUpdatedSource,
    statusAnswer: status.statusAnswer,
    target: {
      device: status.targetDevice,
      board: status.targetBoard,
      model: status.targetModel,
    },
    states,
    statusPanel: {
      rowCount: rows.length,
      rows,
    },
    discoveryPathCount,
    flowStepCount,
    errorCount: errorSummary.count,
    errorsBySeverity: errorSummary.bySeverity,
    pccxLabDiagnostics,
    safety,
    limitations,
    issueRefs,
  };
}

export function validateDeviceSessionStatus(status = {}) {
  try {
    return {
      ok: true,
      summary: consumeDeviceSessionStatus(status),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      summary: null,
      errors: error.message.replace(/^invalid device\/session status: /, "").split("; "),
    };
  }
}

export function consumeDeviceSessionStatusJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid device/session status JSON: parse failed");
  }
  return consumeDeviceSessionStatus(parsed);
}

export function validateDeviceSessionStatusJson(text) {
  try {
    return {
      ok: true,
      summary: consumeDeviceSessionStatusJson(text),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      summary: null,
      errors: error.message.replace(/^invalid device\/session status: /, "").split("; "),
    };
  }
}

export function deviceSessionStatusConsumerJson(status = {}) {
  return `${JSON.stringify(consumeDeviceSessionStatus(status), null, 2)}\n`;
}

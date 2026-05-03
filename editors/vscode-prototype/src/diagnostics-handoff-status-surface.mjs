import {
  DIAGNOSTICS_HANDOFF_CATEGORIES,
  DIAGNOSTICS_HANDOFF_CONSUMER_VERSION,
  DIAGNOSTICS_HANDOFF_SCHEMA_VERSION,
  DIAGNOSTICS_HANDOFF_SEVERITIES,
  createDiagnosticsHandoffConsumerBoundaryStatus,
} from "./diagnostics-handoff-consumer.mjs";

export const DIAGNOSTICS_HANDOFF_STATUS_SURFACE_VERSION =
  "pccx.ideDiagnosticsHandoffStatusSurface.v0";

export const DEFAULT_DIAGNOSTICS_HANDOFF_CONSUMER_SUMMARY = Object.freeze({
  version: DIAGNOSTICS_HANDOFF_CONSUMER_VERSION,
  kind: "diagnostics-handoff-consumer",
  handoffSchemaVersion: DIAGNOSTICS_HANDOFF_SCHEMA_VERSION,
  handoffId: "launcher_diagnostics_handoff_gemma3n_e4b_kv260_placeholder",
  handoffKind: "read_only_handoff",
  producerId: "pccx-llm-launcher",
  consumerId: "pccx-lab",
  targetKind: "kv260",
  diagnosticCount: 5,
  diagnosticsBySeverity: Object.freeze({
    info: 2,
    warning: 1,
    blocked: 2,
    error: 0,
  }),
  diagnosticsByCategory: Object.freeze({
    configuration: 1,
    model_descriptor: 1,
    runtime_descriptor: 1,
    target_device: 0,
    evidence: 1,
    safety: 1,
    diagnostics_handoff: 0,
  }),
  descriptorRefs: Object.freeze({
    launcherOperationId: "pccxlab.diagnostics.handoff",
    modelId: "gemma3n_e4b_placeholder",
    runtimeId: "kv260_pccx_placeholder",
    referenceKind: "descriptor_ref_only",
  }),
  transportKinds: Object.freeze([
    "json_file",
    "stdout_json",
    "read_only_local_artifact_reference",
  ]),
  safety: Object.freeze({
    dataOnly: true,
    readOnly: true,
    fixtureConsumer: true,
    launcherExecution: false,
    pccxLabExecution: false,
    shellExecution: false,
    providerCalls: false,
    networkCalls: false,
    runtimeCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
  }),
  limitations: Object.freeze([
    "Data-only placeholder; no pccx-lab execution is performed.",
    "No launcher runtime execution, model execution, provider call, or network call is performed.",
    "No KV260 hardware access is performed.",
    "No telemetry, automatic upload, or auto write-back is included.",
    "No raw full logs, prompts, source code, private paths, secrets, tokens, provider configuration, generated blobs, or model weight paths are included.",
    "The contract is not a versioned compatibility commitment.",
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
  ["autonomous coding ", "system"],
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

function stringField(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty string");
    return "";
  }
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    addError(errors, path, "must be a single-line string");
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

function validateCountMap(value, keys, path, errors) {
  if (!isObject(value)) {
    addError(errors, path, "must be an object");
    return Object.fromEntries(keys.map((key) => [key, 0]));
  }
  return Object.fromEntries(keys.map((key) => [
    key,
    countField(value[key], `${path}.${key}`, errors),
  ]));
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
  const lower = text.toLowerCase();
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    PRIVATE_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text)
  ) {
    addError(errors, "summary", "must not include secrets, private paths, or model artifact paths");
  }
  for (const parts of UNSUPPORTED_MARKER_PARTS) {
    if (lower.includes(parts.join(""))) {
      addError(errors, "summary", "must not include unsupported runtime or readiness claims");
    }
  }
}

function normalizeConsumerSummary(summary = DEFAULT_DIAGNOSTICS_HANDOFF_CONSUMER_SUMMARY) {
  const errors = [];
  if (!isObject(summary)) {
    throw new Error("diagnostics handoff summary must be an object");
  }

  assertSafeSummaryText(summary, errors);
  if (summary.version !== DIAGNOSTICS_HANDOFF_CONSUMER_VERSION) {
    addError(errors, "version", `must be ${DIAGNOSTICS_HANDOFF_CONSUMER_VERSION}`);
  }
  if (summary.kind !== "diagnostics-handoff-consumer") {
    addError(errors, "kind", "must be diagnostics-handoff-consumer");
  }
  if (summary.handoffSchemaVersion !== DIAGNOSTICS_HANDOFF_SCHEMA_VERSION) {
    addError(errors, "handoffSchemaVersion", `must be ${DIAGNOSTICS_HANDOFF_SCHEMA_VERSION}`);
  }
  if (summary.handoffKind !== "read_only_handoff") {
    addError(errors, "handoffKind", "must be read_only_handoff");
  }

  const diagnosticCount = countField(summary.diagnosticCount, "diagnosticCount", errors);
  const diagnosticsBySeverity = validateCountMap(
    summary.diagnosticsBySeverity,
    DIAGNOSTICS_HANDOFF_SEVERITIES,
    "diagnosticsBySeverity",
    errors,
  );
  const diagnosticsByCategory = validateCountMap(
    summary.diagnosticsByCategory,
    DIAGNOSTICS_HANDOFF_CATEGORIES,
    "diagnosticsByCategory",
    errors,
  );
  const severityTotal = Object.values(diagnosticsBySeverity).reduce((sum, count) => sum + count, 0);
  const categoryTotal = Object.values(diagnosticsByCategory).reduce((sum, count) => sum + count, 0);
  if (severityTotal !== diagnosticCount) {
    addError(errors, "diagnosticsBySeverity", "must add up to diagnosticCount");
  }
  if (categoryTotal !== diagnosticCount) {
    addError(errors, "diagnosticsByCategory", "must add up to diagnosticCount");
  }

  const safety = isObject(summary.safety) ? summary.safety : {};
  const normalizedSafety = {
    dataOnly: boolField(safety.dataOnly, true, "safety.dataOnly", errors),
    readOnly: boolField(safety.readOnly, true, "safety.readOnly", errors),
    fixtureConsumer: boolField(safety.fixtureConsumer, true, "safety.fixtureConsumer", errors),
    launcherExecution: boolField(safety.launcherExecution, false, "safety.launcherExecution", errors),
    pccxLabExecution: boolField(safety.pccxLabExecution, false, "safety.pccxLabExecution", errors),
    shellExecution: boolField(safety.shellExecution, false, "safety.shellExecution", errors),
    providerCalls: boolField(safety.providerCalls, false, "safety.providerCalls", errors),
    networkCalls: boolField(safety.networkCalls, false, "safety.networkCalls", errors),
    runtimeCalls: boolField(safety.runtimeCalls, false, "safety.runtimeCalls", errors),
    mcpCalls: boolField(safety.mcpCalls, false, "safety.mcpCalls", errors),
    lspImplemented: boolField(safety.lspImplemented, false, "safety.lspImplemented", errors),
    marketplaceFlow: boolField(safety.marketplaceFlow, false, "safety.marketplaceFlow", errors),
    telemetry: boolField(safety.telemetry, false, "safety.telemetry", errors),
    automaticUpload: boolField(safety.automaticUpload, false, "safety.automaticUpload", errors),
    writeBack: boolField(safety.writeBack, false, "safety.writeBack", errors),
  };

  const descriptorRefs = isObject(summary.descriptorRefs) ? summary.descriptorRefs : {};
  const transportKinds = Array.isArray(summary.transportKinds)
    ? summary.transportKinds.map((kind, index) => stringField(kind, `transportKinds[${index}]`, errors))
    : [];
  if (!Array.isArray(summary.transportKinds)) {
    addError(errors, "transportKinds", "must be an array");
  }
  const limitations = Array.isArray(summary.limitations)
    ? summary.limitations.map((item, index) => stringField(item, `limitations[${index}]`, errors))
    : [];
  if (!Array.isArray(summary.limitations)) {
    addError(errors, "limitations", "must be an array");
  }

  const normalized = {
    version: summary.version,
    kind: summary.kind,
    handoffSchemaVersion: summary.handoffSchemaVersion,
    handoffId: stringField(summary.handoffId, "handoffId", errors),
    handoffKind: summary.handoffKind,
    producerId: stringField(summary.producerId, "producerId", errors),
    consumerId: stringField(summary.consumerId, "consumerId", errors),
    targetKind: stringField(summary.targetKind, "targetKind", errors),
    diagnosticCount,
    diagnosticsBySeverity,
    diagnosticsByCategory,
    descriptorRefs: {
      launcherOperationId: stringField(
        descriptorRefs.launcherOperationId,
        "descriptorRefs.launcherOperationId",
        errors,
      ),
      modelId: stringField(descriptorRefs.modelId, "descriptorRefs.modelId", errors),
      runtimeId: stringField(descriptorRefs.runtimeId, "descriptorRefs.runtimeId", errors),
      referenceKind: stringField(descriptorRefs.referenceKind, "descriptorRefs.referenceKind", errors),
    },
    transportKinds,
    safety: normalizedSafety,
    limitations,
  };

  if (errors.length > 0) {
    throw new Error(`invalid diagnostics handoff summary: ${errors.join("; ")}`);
  }

  return normalized;
}

export function createDiagnosticsHandoffStatusSurface(
  consumerSummary = DEFAULT_DIAGNOSTICS_HANDOFF_CONSUMER_SUMMARY,
) {
  const summary = normalizeConsumerSummary(consumerSummary);
  const boundary = createDiagnosticsHandoffConsumerBoundaryStatus();
  const severity = summary.diagnosticsBySeverity;
  const displaySummary = [
    `${summary.diagnosticCount} diagnostic item(s)`,
    `${severity.blocked} blocked`,
    `${severity.warning} warning`,
    "read-only",
  ].join(", ");

  return {
    version: DIAGNOSTICS_HANDOFF_STATUS_SURFACE_VERSION,
    kind: "diagnostics-handoff-status-surface",
    source: {
      kind: summary.kind,
      version: summary.version,
      adapterOutput: true,
      rawHandoffParsedByUi: false,
    },
    readiness: {
      status: "available",
      summaryAvailable: true,
      localOnly: true,
      experimental: true,
    },
    handoff: {
      schemaVersion: summary.handoffSchemaVersion,
      handoffId: summary.handoffId,
      handoffKind: summary.handoffKind,
      producerId: summary.producerId,
      consumerId: summary.consumerId,
      targetKind: summary.targetKind,
    },
    diagnostics: {
      count: summary.diagnosticCount,
      bySeverity: summary.diagnosticsBySeverity,
      byCategory: summary.diagnosticsByCategory,
    },
    descriptorRefs: summary.descriptorRefs,
    transportKinds: summary.transportKinds,
    limitations: summary.limitations,
    safety: {
      dataOnly: true,
      readOnly: true,
      localOnly: true,
      launcherExecution: false,
      pccxLabExecution: false,
      pccxLabValidatorInvocation: false,
      shellExecution: false,
      providerCalls: false,
      networkCalls: false,
      runtimeCalls: false,
      mcpCalls: false,
      lspImplemented: false,
      marketplaceFlow: false,
      telemetry: false,
      automaticUpload: false,
      writeBack: false,
    },
    boundary: {
      version: boundary.version,
      supportedSchemaVersion: boundary.supportedSchemaVersion,
      dataOnly: boundary.dataOnly === true,
      readOnly: boundary.readOnly === true,
      invokesLauncher: boundary.invokesLauncher === true,
      invokesPccxLab: boundary.invokesPccxLab === true,
      invokesPccxLabValidator: boundary.invokesPccxLabValidator === true,
      shellExecution: boundary.shellExecution === true,
      providerCalls: boundary.providerCalls === true,
      runtimeCalls: boundary.runtimeCalls === true,
      mcpCalls: boundary.mcpCalls === true,
      lspImplemented: boundary.lspImplemented === true,
      marketplaceFlow: boundary.marketplaceFlow === true,
    },
    display: {
      title: "Diagnostics Handoff Summary",
      summary: displaySummary,
      detailLines: [
        `schema: ${summary.handoffSchemaVersion}`,
        `handoff: ${summary.handoffId}`,
        `target: ${summary.targetKind}`,
        `descriptorRefs: model=${summary.descriptorRefs.modelId} runtime=${summary.descriptorRefs.runtimeId}`,
        `transport: ${summary.transportKinds.join(", ")}`,
        "safety: data-only, read-only, local-only",
      ],
    },
  };
}

export function diagnosticsHandoffStatusSurfaceJson(
  consumerSummary = DEFAULT_DIAGNOSTICS_HANDOFF_CONSUMER_SUMMARY,
) {
  return `${JSON.stringify(createDiagnosticsHandoffStatusSurface(consumerSummary), null, 2)}\n`;
}

export function formatDiagnosticsHandoffStatusSurface(surface) {
  const status = surface ?? createDiagnosticsHandoffStatusSurface();
  return [
    status.display?.title ?? "Diagnostics Handoff Summary",
    `schema: ${status.handoff?.schemaVersion ?? ""}`,
    `handoff: ${status.handoff?.handoffId ?? ""}`,
    `target: ${status.handoff?.targetKind ?? ""}`,
    `diagnostics: ${status.diagnostics?.count ?? 0}`,
    `severity: info=${status.diagnostics?.bySeverity?.info ?? 0} warning=${status.diagnostics?.bySeverity?.warning ?? 0} blocked=${status.diagnostics?.bySeverity?.blocked ?? 0} error=${status.diagnostics?.bySeverity?.error ?? 0}`,
    `transport: ${(status.transportKinds ?? []).join(", ")}`,
    `readOnly: ${status.safety?.readOnly ? "yes" : "no"}`,
    `dataOnly: ${status.safety?.dataOnly ? "yes" : "no"}`,
    "execution: no launcher, no pccx-lab, no shell, no provider/runtime/MCP/LSP",
  ].join("\n");
}

export function cloneDefaultDiagnosticsHandoffConsumerSummary() {
  return clone(DEFAULT_DIAGNOSTICS_HANDOFF_CONSUMER_SUMMARY);
}

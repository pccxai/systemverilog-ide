export const DIAGNOSTICS_HANDOFF_CONSUMER_VERSION =
  "pccx.ideDiagnosticsHandoffConsumer.v0";
export const DIAGNOSTICS_HANDOFF_SCHEMA_VERSION = "pccx.diagnosticsHandoff.v0";

export const DIAGNOSTICS_HANDOFF_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "blocked",
  "error",
]);

export const DIAGNOSTICS_HANDOFF_CATEGORIES = Object.freeze([
  "configuration",
  "model_descriptor",
  "runtime_descriptor",
  "target_device",
  "evidence",
  "safety",
  "diagnostics_handoff",
]);

const HANDOFF_FIELDS = Object.freeze([
  "schemaVersion",
  "handoffId",
  "handoffKind",
  "producer",
  "consumer",
  "createdAt",
  "sessionId",
  "launcherStatusRef",
  "modelDescriptorRef",
  "runtimeDescriptorRef",
  "targetKind",
  "targetDevice",
  "diagnostics",
  "evidenceRefs",
  "artifactRefs",
  "privacyFlags",
  "safetyFlags",
  "transport",
  "limitations",
  "issueRefs",
]);

const DIAGNOSTIC_FIELDS = Object.freeze([
  "diagnosticId",
  "severity",
  "category",
  "source",
  "title",
  "summary",
  "relatedContractRefs",
  "suggestedNextAction",
  "evidenceState",
  "redactionState",
]);

const TRANSPORT_KINDS = Object.freeze([
  "json_file",
  "stdout_json",
  "read_only_local_artifact_reference",
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/;
const MODEL_ARTIFACT_PATTERN =
  /\.(?:gguf|safetensors|ckpt|pt|pth|onnx|xclbin|bit)(?:\s|$|["'])/i;
const RAW_ARTIFACT_PATTERN =
  /\b(?:raw[_-]?full[_-]?logs|hardware[_-]?dump|generated[_-]?blob|bitstream)\b\s*[:=]/i;

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

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
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

function stringPath(root, path, errors) {
  let current = root;
  for (const part of path) {
    current = isObject(current) ? current[part] : undefined;
  }
  return stringField(current, path.join("."), errors);
}

function boolPath(root, path, expected, errors) {
  let current = root;
  for (const part of path) {
    current = isObject(current) ? current[part] : undefined;
  }
  if (typeof current !== "boolean") {
    addError(errors, path.join("."), "must be a boolean");
    return false;
  }
  if (current !== expected) {
    addError(errors, path.join("."), `must be ${expected}`);
  }
  return current;
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

function assertSafeSerializedText(handoff, errors) {
  let text = "";
  try {
    text = JSON.stringify(handoff ?? {});
  } catch {
    addError(errors, "handoff", "must be JSON-serializable");
    return;
  }
  const lower = text.toLowerCase();
  if (
    SECRET_ASSIGNMENT_PATTERN.test(text) ||
    HOME_PATH_PATTERN.test(text) ||
    MODEL_ARTIFACT_PATTERN.test(text) ||
    RAW_ARTIFACT_PATTERN.test(text)
  ) {
    addError(
      errors,
      "handoff",
      "must not include secrets, private paths, raw artifacts, or model artifact paths",
    );
  }
  for (const parts of UNSUPPORTED_MARKER_PARTS) {
    const marker = parts.join("");
    if (lower.includes(marker)) {
      addError(errors, "handoff", "must not include unsupported runtime or readiness claims");
    }
  }
}

function zeroCounts(values) {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

function validateDiagnostics(handoff, errors) {
  const diagnostics = arrayPath(handoff, ["diagnostics"], errors);
  const diagnosticsBySeverity = zeroCounts(DIAGNOSTICS_HANDOFF_SEVERITIES);
  const diagnosticsByCategory = zeroCounts(DIAGNOSTICS_HANDOFF_CATEGORIES);

  if (diagnostics.length === 0) {
    addError(errors, "diagnostics", "must contain at least one diagnostic item");
  }

  diagnostics.forEach((diagnostic, index) => {
    if (!isObject(diagnostic)) {
      addError(errors, `diagnostics[${index}]`, "must be an object");
      return;
    }
    for (const field of DIAGNOSTIC_FIELDS) {
      if (!Object.hasOwn(diagnostic, field)) {
        addError(errors, `diagnostics[${index}].${field}`, "is required");
      }
    }
    const severity = stringField(diagnostic.severity, `diagnostics[${index}].severity`, errors);
    const category = stringField(diagnostic.category, `diagnostics[${index}].category`, errors);
    ensureAllowed(
      severity,
      DIAGNOSTICS_HANDOFF_SEVERITIES,
      `diagnostics[${index}].severity`,
      errors,
    );
    ensureAllowed(
      category,
      DIAGNOSTICS_HANDOFF_CATEGORIES,
      `diagnostics[${index}].category`,
      errors,
    );
    if (Object.hasOwn(diagnosticsBySeverity, severity)) {
      diagnosticsBySeverity[severity] += 1;
    }
    if (Object.hasOwn(diagnosticsByCategory, category)) {
      diagnosticsByCategory[category] += 1;
    }
    if (!Array.isArray(diagnostic.relatedContractRefs) ||
        diagnostic.relatedContractRefs.length === 0) {
      addError(errors, `diagnostics[${index}].relatedContractRefs`, "must be a non-empty array");
    }
  });

  return {
    diagnosticCount: diagnostics.length,
    diagnosticsBySeverity,
    diagnosticsByCategory,
  };
}

function validateReferences(handoff, errors) {
  const launcherOperationId = stringPath(
    handoff,
    ["launcherStatusRef", "operationId"],
    errors,
  );
  const modelId = stringPath(handoff, ["modelDescriptorRef", "modelId"], errors);
  const runtimeId = stringPath(handoff, ["runtimeDescriptorRef", "runtimeId"], errors);
  ensureValue(launcherOperationId, "pccxlab.diagnostics.handoff", "launcherStatusRef.operationId", errors);
  ensureValue(
    stringPath(handoff, ["launcherStatusRef", "referenceKind"], errors),
    "descriptor_ref_only",
    "launcherStatusRef.referenceKind",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["modelDescriptorRef", "referenceKind"], errors),
    "descriptor_ref_only",
    "modelDescriptorRef.referenceKind",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["runtimeDescriptorRef", "referenceKind"], errors),
    "descriptor_ref_only",
    "runtimeDescriptorRef.referenceKind",
    errors,
  );
  return {
    launcherOperationId,
    modelId,
    runtimeId,
    referenceKind: "descriptor_ref_only",
  };
}

function validateArtifacts(handoff, errors) {
  arrayPath(handoff, ["artifactRefs"], errors).forEach((artifact, index) => {
    if (!isObject(artifact)) {
      addError(errors, `artifactRefs[${index}]`, "must be an object");
      return;
    }
    ensureValue(
      stringField(artifact.referenceKind, `artifactRefs[${index}].referenceKind`, errors),
      "read_only_local_artifact_reference",
      `artifactRefs[${index}].referenceKind`,
      errors,
    );
    const reference = stringField(artifact.reference, `artifactRefs[${index}].reference`, errors);
    if (
      reference.startsWith("/") ||
      reference.includes(":\\") ||
      reference.startsWith("http://") ||
      reference.startsWith("https://")
    ) {
      addError(
        errors,
        `artifactRefs[${index}].reference`,
        "must be a relative read-only local artifact reference",
      );
    }
  });
}

function validateTransport(handoff, errors) {
  const kinds = [];
  arrayPath(handoff, ["transport"], errors).forEach((transport, index) => {
    if (!isObject(transport)) {
      addError(errors, `transport[${index}]`, "must be an object");
      return;
    }
    const kind = stringField(transport.transportKind, `transport[${index}].transportKind`, errors);
    ensureAllowed(kind, TRANSPORT_KINDS, `transport[${index}].transportKind`, errors);
    ensureValue(
      stringField(transport.mode, `transport[${index}].mode`, errors),
      "read_only_handoff",
      `transport[${index}].mode`,
      errors,
    );
    ensureValue(
      stringField(transport.execution, `transport[${index}].execution`, errors),
      "no_pccx_lab_execution",
      `transport[${index}].execution`,
      errors,
    );
    kinds.push(kind);
  });
  return kinds;
}

function validateSafety(handoff, errors) {
  ensureValue(
    stringPath(handoff, ["privacyFlags", "uploadPolicy"], errors),
    "no_user_data_upload",
    "privacyFlags.uploadPolicy",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["privacyFlags", "telemetryPolicy"], errors),
    "no_telemetry",
    "privacyFlags.telemetryPolicy",
    errors,
  );

  [
    ["privacyFlags", "automaticUpload"],
    ["privacyFlags", "rawFullLogsIncluded"],
    ["privacyFlags", "userPromptsIncluded"],
    ["privacyFlags", "userSourceCodeIncluded"],
    ["privacyFlags", "privatePathsIncluded"],
    ["privacyFlags", "secretsIncluded"],
    ["privacyFlags", "tokensIncluded"],
    ["privacyFlags", "providerConfigsIncluded"],
    ["privacyFlags", "modelWeightPathsIncluded"],
    ["privacyFlags", "generatedBlobsIncluded"],
    ["safetyFlags", "executesPccxLab"],
    ["safetyFlags", "executesLauncher"],
    ["safetyFlags", "runtimeExecution"],
    ["safetyFlags", "touchesHardware"],
    ["safetyFlags", "kv260Access"],
    ["safetyFlags", "modelExecution"],
    ["safetyFlags", "networkCalls"],
    ["safetyFlags", "providerCalls"],
    ["safetyFlags", "shellExecution"],
    ["safetyFlags", "mcpServerImplemented"],
    ["safetyFlags", "lspImplemented"],
    ["safetyFlags", "marketplaceFlow"],
    ["safetyFlags", "telemetry"],
    ["safetyFlags", "automaticUpload"],
    ["safetyFlags", "writeBack"],
  ].forEach((path) => boolPath(handoff, path, false, errors));

  [
    ["safetyFlags", "dataOnly"],
    ["safetyFlags", "readOnly"],
  ].forEach((path) => boolPath(handoff, path, true, errors));

  ensureValue(
    stringPath(handoff, ["safetyFlags", "contractKind"], errors),
    "read_only_handoff",
    "safetyFlags.contractKind",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["safetyFlags", "descriptorPolicy"], errors),
    "descriptor_ref_only",
    "safetyFlags.descriptorPolicy",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["safetyFlags", "runtimePolicy"], errors),
    "no_runtime_execution",
    "safetyFlags.runtimePolicy",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["safetyFlags", "hardwarePolicy"], errors),
    "no_hardware_access",
    "safetyFlags.hardwarePolicy",
    errors,
  );

  return {
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
  };
}

export function createDiagnosticsHandoffConsumerBoundaryStatus() {
  return {
    version: DIAGNOSTICS_HANDOFF_CONSUMER_VERSION,
    kind: "diagnostics-handoff-consumer-boundary",
    supportedSchemaVersion: DIAGNOSTICS_HANDOFF_SCHEMA_VERSION,
    dataOnly: true,
    readOnly: true,
    fixtureConsumer: true,
    validatesLocalJson: true,
    invokesLauncher: false,
    invokesPccxLab: false,
    invokesPccxLabValidator: false,
    shellExecution: false,
    providerCalls: false,
    networkCalls: false,
    runtimeCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    stableApi: false,
  };
}

export function consumeDiagnosticsHandoff(handoff = {}) {
  const errors = [];
  if (!isObject(handoff)) {
    throw new Error("diagnostics handoff must be an object");
  }

  for (const field of HANDOFF_FIELDS) {
    if (!Object.hasOwn(handoff, field)) {
      addError(errors, field, "is required");
    }
  }

  assertSafeSerializedText(handoff, errors);
  ensureValue(handoff.schemaVersion, DIAGNOSTICS_HANDOFF_SCHEMA_VERSION, "schemaVersion", errors);
  ensureValue(handoff.handoffKind, "read_only_handoff", "handoffKind", errors);
  ensureValue(
    stringPath(handoff, ["producer", "role"], errors),
    "launcher_generated_summary",
    "producer.role",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["consumer", "role"], errors),
    "pccx_lab_future_consumer",
    "consumer.role",
    errors,
  );
  ensureValue(
    stringPath(handoff, ["targetDevice", "accessState"], errors),
    "no_hardware_access",
    "targetDevice.accessState",
    errors,
  );

  const diagnosticSummary = validateDiagnostics(handoff, errors);
  const descriptorRefs = validateReferences(handoff, errors);
  validateArtifacts(handoff, errors);
  const transportKinds = validateTransport(handoff, errors);
  const safety = validateSafety(handoff, errors);
  const limitations = arrayPath(handoff, ["limitations"], errors).map((item, index) => (
    stringField(item, `limitations[${index}]`, errors)
  ));

  if (errors.length > 0) {
    throw new Error(`invalid diagnostics handoff: ${errors.join("; ")}`);
  }

  return {
    version: DIAGNOSTICS_HANDOFF_CONSUMER_VERSION,
    kind: "diagnostics-handoff-consumer",
    handoffSchemaVersion: handoff.schemaVersion,
    handoffId: handoff.handoffId,
    handoffKind: handoff.handoffKind,
    producerId: handoff.producer.id,
    consumerId: handoff.consumer.id,
    targetKind: handoff.targetKind,
    ...diagnosticSummary,
    descriptorRefs,
    transportKinds,
    safety,
    limitations,
  };
}

export function validateDiagnosticsHandoff(handoff = {}) {
  try {
    return {
      ok: true,
      summary: consumeDiagnosticsHandoff(handoff),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      summary: null,
      errors: error.message.replace(/^invalid diagnostics handoff: /, "").split("; "),
    };
  }
}

export function consumeDiagnosticsHandoffJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("diagnostics handoff JSON must parse");
  }
  return consumeDiagnosticsHandoff(parsed);
}

export function diagnosticsHandoffConsumerJson(handoff = {}) {
  return `${JSON.stringify(consumeDiagnosticsHandoff(handoff), null, 2)}\n`;
}

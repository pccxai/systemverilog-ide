// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

export const RUNTIME_READINESS_CONSUMER_VERSION =
  "pccx.ideRuntimeReadinessConsumer.v0";
export const RUNTIME_READINESS_SCHEMA_VERSION = "pccx.runtimeReadiness.v0";
export const RUNTIME_READINESS_EXPECTED_STATUS_ANSWER =
  "blocked_not_yet_evidence_backed";
const LAUNCHER_REPO_REF = ["pccxai", ["pccx-llm", "launcher"].join("-")].join("/");
export const RUNTIME_READINESS_COORDINATION_REFS = Object.freeze([
  "pccxai/systemverilog-ide#58",
  `${LAUNCHER_REPO_REF}#21`,
  `${LAUNCHER_REPO_REF}#22`,
]);

export const RUNTIME_READINESS_STATE_VALUES = Object.freeze([
  "target",
  "blocked",
  "ready_for_inputs",
  "evidence_present",
  "measured",
]);

export const MAX_RUNTIME_READINESS_BLOCKERS = 8;

const READINESS_FIELDS = Object.freeze([
  "schemaVersion",
  "readinessId",
  "fixtureVersion",
  "lastUpdatedSource",
  "statusAnswer",
  "readinessState",
  "evidenceState",
  "modelId",
  "modelFamily",
  "modelVariant",
  "targetDevice",
  "targetBoard",
  "targetState",
  "overallState",
  "descriptorState",
  "modelWeightState",
  "boardInputState",
  "bitstreamState",
  "simulationEvidenceState",
  "vivadoSynthState",
  "timingEvidenceState",
  "implementationState",
  "kv260SmokeState",
  "runtimeEvidenceState",
  "throughputEvidenceState",
  "compatibilityState",
  "stateVocabulary",
  "blockers",
  "nextInputsRequired",
  "performanceTargets",
  "evidenceRefs",
  "coordinationNotes",
  "safetyFlags",
  "limitations",
  "issueRefs",
]);

const BLOCKER_FIELDS = Object.freeze([
  "blockerId",
  "state",
  "summary",
  "requiredBefore",
]);

const PERFORMANCE_TARGET_FIELDS = Object.freeze([
  "metricId",
  "state",
  "target",
  "measured",
  "achieved",
  "summary",
]);

const REQUIRED_TRUE_SAFETY_FLAGS = Object.freeze([
  "dataOnly",
  "readOnly",
  "deterministic",
  "descriptorOnly",
]);

const REQUIRED_FALSE_SAFETY_FLAGS = Object.freeze([
  "writesArtifacts",
  "touchesHardware",
  "kv260Access",
  "runtimeExecution",
  "modelLoaded",
  "modelExecution",
  "modelWeightPathsIncluded",
  "privatePathsIncluded",
  "secretsIncluded",
  "tokensIncluded",
  "generatedBlobsIncluded",
  "hardwareDumpsIncluded",
  "networkCalls",
  "providerCalls",
  "telemetry",
  "automaticUpload",
  "writeBack",
  "executesPccxLab",
  "executesSystemverilogIde",
  "mcpServerImplemented",
  "lspImplemented",
  "marketplaceFlow",
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

function stringPath(root, path, errors, maxCharacters = 500) {
  let current = root;
  for (const part of path) {
    current = isObject(current) ? current[part] : undefined;
  }
  return stringField(current, path.join("."), errors, maxCharacters);
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

function assertSafeSerializedText(readiness, errors) {
  let text = "";
  try {
    text = JSON.stringify(readiness ?? {});
  } catch {
    addError(errors, "readiness", "must be JSON-serializable");
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
      "readiness",
      "must not include secrets, private paths, raw artifacts, or model artifact paths",
    );
  }
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      addError(errors, "readiness", "must not include unsupported runtime readiness claims");
    }
  }
}

function validateState(value, path, errors) {
  const state = stringField(value, path, errors, 80);
  ensureAllowed(state, RUNTIME_READINESS_STATE_VALUES, path, errors);
  return state;
}

function validateBlockers(readiness, errors) {
  const blockers = arrayPath(readiness, ["blockers"], errors);
  if (blockers.length === 0) {
    addError(errors, "blockers", "must contain at least one blocker");
  }
  if (blockers.length > MAX_RUNTIME_READINESS_BLOCKERS) {
    addError(errors, "blockers", `must contain at most ${MAX_RUNTIME_READINESS_BLOCKERS} item(s)`);
  }
  return blockers.slice(0, MAX_RUNTIME_READINESS_BLOCKERS).map((blocker, index) => {
    if (!isObject(blocker)) {
      addError(errors, `blockers[${index}]`, "must be an object");
      return {
        blockerId: "",
        state: "",
        requiredBefore: "",
        summary: "",
      };
    }
    for (const field of BLOCKER_FIELDS) {
      if (!Object.hasOwn(blocker, field)) {
        addError(errors, `blockers[${index}].${field}`, "is required");
      }
    }
    const state = validateState(blocker.state, `blockers[${index}].state`, errors);
    ensureValue(state, "blocked", `blockers[${index}].state`, errors);
    return {
      blockerId: stringField(blocker.blockerId, `blockers[${index}].blockerId`, errors, 160),
      state,
      requiredBefore: stringField(
        blocker.requiredBefore,
        `blockers[${index}].requiredBefore`,
        errors,
        160,
      ),
      summary: stringField(blocker.summary, `blockers[${index}].summary`, errors, 500),
    };
  });
}

function validatePerformanceTargets(readiness, errors) {
  const targets = arrayPath(readiness, ["performanceTargets"], errors);
  if (targets.length !== 1) {
    addError(errors, "performanceTargets", "must contain one target-only throughput item");
  }
  const target = targets[0];
  if (!isObject(target)) {
    addError(errors, "performanceTargets[0]", "must be an object");
    return;
  }
  for (const field of PERFORMANCE_TARGET_FIELDS) {
    if (!Object.hasOwn(target, field)) {
      addError(errors, `performanceTargets[0].${field}`, "is required");
    }
  }
  ensureValue(
    stringField(target.metricId, "performanceTargets[0].metricId", errors, 160),
    "decode_throughput",
    "performanceTargets[0].metricId",
    errors,
  );
  ensureValue(
    validateState(target.state, "performanceTargets[0].state", errors),
    "target",
    "performanceTargets[0].state",
    errors,
  );
  ensureValue(
    stringField(target.target, "performanceTargets[0].target", errors, 80),
    "20 tok/s",
    "performanceTargets[0].target",
    errors,
  );
  boolField(target.measured, false, "performanceTargets[0].measured", errors);
  boolField(target.achieved, false, "performanceTargets[0].achieved", errors);
  stringField(target.summary, "performanceTargets[0].summary", errors, 500);
}

function validateSafety(readiness, errors) {
  const safety = isObject(readiness.safetyFlags) ? readiness.safetyFlags : {};
  if (!isObject(readiness.safetyFlags)) {
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
    descriptorOnly: true,
    launcherExecution: false,
    pccxLabExecution: false,
    systemverilogIdeExecution: false,
    fpgaRepoAccess: false,
    kv260Access: false,
    runtimeExecution: false,
    modelLoaded: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
    privatePathsIncluded: false,
    secretsIncluded: false,
    tokensIncluded: false,
    generatedBlobsIncluded: false,
    hardwareDumpsIncluded: false,
    writesArtifacts: false,
    networkCalls: false,
    providerCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
    stableApiAbiClaim: false,
  };
}

export function createRuntimeReadinessConsumerBoundaryStatus() {
  return {
    version: RUNTIME_READINESS_CONSUMER_VERSION,
    kind: "runtime-readiness-consumer-boundary",
    supportedSchemaVersion: RUNTIME_READINESS_SCHEMA_VERSION,
    expectedStatusAnswer: RUNTIME_READINESS_EXPECTED_STATUS_ANSWER,
    coordinationRefs: [...RUNTIME_READINESS_COORDINATION_REFS],
    dataOnly: true,
    readOnly: true,
    fixtureConsumer: true,
    validatesLocalJson: true,
    invokesLauncher: false,
    invokesPccxLab: false,
    invokesPccxLabValidator: false,
    accessesFpgaRepo: false,
    kv260RuntimeExecution: false,
    modelExecution: false,
    modelWeightPathsIncluded: false,
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
    stableApi: false,
  };
}

export function consumeRuntimeReadiness(readiness = {}) {
  const errors = [];
  if (!isObject(readiness)) {
    throw new Error("runtime readiness fixture must be an object");
  }

  for (const field of READINESS_FIELDS) {
    if (!Object.hasOwn(readiness, field)) {
      addError(errors, field, "is required");
    }
  }

  assertSafeSerializedText(readiness, errors);

  ensureValue(readiness.schemaVersion, RUNTIME_READINESS_SCHEMA_VERSION, "schemaVersion", errors);
  ensureValue(
    readiness.readinessId,
    "runtime_readiness_gemma3n_e4b_kv260",
    "readinessId",
    errors,
  );
  ensureValue(
    readiness.statusAnswer,
    RUNTIME_READINESS_EXPECTED_STATUS_ANSWER,
    "statusAnswer",
    errors,
  );
  ensureValue(readiness.modelFamily, "gemma3n", "modelFamily", errors);
  ensureValue(readiness.modelVariant, "e4b", "modelVariant", errors);
  ensureValue(readiness.targetDevice, "kv260", "targetDevice", errors);
  ensureValue(readiness.modelWeightState, "ready_for_inputs", "modelWeightState", errors);

  const readinessState = validateState(readiness.readinessState, "readinessState", errors);
  const evidenceState = validateState(readiness.evidenceState, "evidenceState", errors);
  const timingState = validateState(readiness.timingEvidenceState, "timingEvidenceState", errors);
  const bitstreamState = validateState(readiness.bitstreamState, "bitstreamState", errors);
  const implementationState = validateState(
    readiness.implementationState,
    "implementationState",
    errors,
  );
  const kv260SmokeState = validateState(readiness.kv260SmokeState, "kv260SmokeState", errors);
  const runtimeEvidenceState = validateState(
    readiness.runtimeEvidenceState,
    "runtimeEvidenceState",
    errors,
  );
  const throughputState = validateState(
    readiness.throughputEvidenceState,
    "throughputEvidenceState",
    errors,
  );

  ensureValue(readinessState, "blocked", "readinessState", errors);
  ensureValue(evidenceState, "blocked", "evidenceState", errors);
  ensureValue(timingState, "blocked", "timingEvidenceState", errors);
  ensureValue(bitstreamState, "blocked", "bitstreamState", errors);
  ensureValue(implementationState, "blocked", "implementationState", errors);
  ensureValue(kv260SmokeState, "blocked", "kv260SmokeState", errors);
  ensureValue(runtimeEvidenceState, "blocked", "runtimeEvidenceState", errors);
  ensureValue(throughputState, "target", "throughputEvidenceState", errors);

  const blockers = validateBlockers(readiness, errors);
  validatePerformanceTargets(readiness, errors);
  const safety = validateSafety(readiness, errors);
  const readinessId = stringField(readiness.readinessId, "readinessId", errors, 160);
  const fixtureVersion = stringField(readiness.fixtureVersion, "fixtureVersion", errors, 160);
  const lastUpdatedSource = stringField(
    readiness.lastUpdatedSource,
    "lastUpdatedSource",
    errors,
    160,
  );
  const modelId = stringField(readiness.modelId, "modelId", errors, 160);
  const targetBoard = stringField(readiness.targetBoard, "targetBoard", errors, 160);

  if (errors.length > 0) {
    throw new Error(`invalid runtime readiness fixture: ${errors.join("; ")}`);
  }

  return {
    version: RUNTIME_READINESS_CONSUMER_VERSION,
    kind: "runtime-readiness-consumer",
    readinessSchemaVersion: readiness.schemaVersion,
    readinessId,
    fixtureVersion,
    lastUpdatedSource,
    statusAnswer: readiness.statusAnswer,
    readinessState,
    evidenceState,
    targetModel: {
      modelId,
      modelFamily: readiness.modelFamily,
      modelVariant: readiness.modelVariant,
    },
    targetDevice: readiness.targetDevice,
    targetBoard,
    timingState,
    bitstreamState,
    implementationState,
    kv260SmokeState,
    runtimeEvidenceState,
    throughputState,
    blockerCount: blockers.length,
    blockers,
    safety,
  };
}

export function validateRuntimeReadiness(readiness = {}) {
  try {
    return {
      ok: true,
      summary: consumeRuntimeReadiness(readiness),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      summary: null,
      errors: error.message.replace(/^invalid runtime readiness fixture: /, "").split("; "),
    };
  }
}

export function consumeRuntimeReadinessJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("invalid runtime readiness JSON: parse failed");
  }
  return consumeRuntimeReadiness(parsed);
}

export function validateRuntimeReadinessJson(text) {
  try {
    return {
      ok: true,
      summary: consumeRuntimeReadinessJson(text),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      summary: null,
      errors: [error.message],
    };
  }
}

export function runtimeReadinessConsumerJson(readiness = {}) {
  return `${JSON.stringify(consumeRuntimeReadiness(readiness), null, 2)}\n`;
}

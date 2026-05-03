// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import {
  MAX_RUNTIME_READINESS_BLOCKERS,
  RUNTIME_READINESS_CONSUMER_VERSION,
  RUNTIME_READINESS_EXPECTED_STATUS_ANSWER,
  RUNTIME_READINESS_SCHEMA_VERSION,
  createRuntimeReadinessConsumerBoundaryStatus,
} from "./runtime-readiness-consumer.mjs";

export const RUNTIME_READINESS_STATUS_SURFACE_VERSION =
  "pccx.ideRuntimeReadinessStatusSurface.v0";

export const DEFAULT_RUNTIME_READINESS_CONSUMER_SUMMARY = Object.freeze({
  version: RUNTIME_READINESS_CONSUMER_VERSION,
  kind: "runtime-readiness-consumer",
  readinessSchemaVersion: RUNTIME_READINESS_SCHEMA_VERSION,
  readinessId: "runtime_readiness_gemma3n_e4b_kv260",
  fixtureVersion: "runtime-readiness.gemma3n-e4b-kv260.2026-05-03",
  lastUpdatedSource: "pccx_evidence_boundary_2026-05-03",
  statusAnswer: RUNTIME_READINESS_EXPECTED_STATUS_ANSWER,
  readinessState: "blocked",
  evidenceState: "blocked",
  targetModel: Object.freeze({
    modelId: "gemma3n_e4b_placeholder",
    modelFamily: "gemma3n",
    modelVariant: "e4b",
  }),
  targetDevice: "kv260",
  targetBoard: "xilinx_kria_kv260",
  timingState: "blocked",
  bitstreamState: "blocked",
  implementationState: "blocked",
  kv260SmokeState: "blocked",
  runtimeEvidenceState: "blocked",
  throughputState: "target",
  blockerCount: 6,
  blockers: Object.freeze([
    Object.freeze({
      blockerId: "board_model_bitstream_runtime_environment_missing",
      state: "blocked",
      requiredBefore: "kv260_smoke_or_runtime_claim",
      summary: "KV260 board, model assets, generated bitstream, and runtime environment are not provided by this launcher fixture.",
    }),
    Object.freeze({
      blockerId: "post_synth_drc_timing_open",
      state: "blocked",
      requiredBefore: "implementation_or_bitstream_claim",
      summary: "Post-synthesis DRC and timing issues remain open in the FPGA closure state.",
    }),
    Object.freeze({
      blockerId: "implementation_incomplete",
      state: "blocked",
      requiredBefore: "bitstream_or_board_smoke_claim",
      summary: "Implementation is not complete, so hardware closure is not available.",
    }),
    Object.freeze({
      blockerId: "bitstream_not_generated",
      state: "blocked",
      requiredBefore: "kv260_board_smoke_claim",
      summary: "A generated bitstream is not proven by this launcher surface.",
    }),
    Object.freeze({
      blockerId: "gemma3n_e4b_runtime_evidence_absent",
      state: "blocked",
      requiredBefore: "runtime_or_performance_claim",
      summary: "Gemma 3N E4B has no KV260 hardware runtime evidence in this launcher fixture.",
    }),
    Object.freeze({
      blockerId: "throughput_measurement_absent",
      state: "blocked",
      requiredBefore: "performance_claim",
      summary: "Throughput measurement is unavailable.",
    }),
  ]),
  safety: Object.freeze({
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
  }),
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
      addError(errors, "summary", "must not include unsupported runtime readiness claims");
    }
  }
}

function normalizeBlockers(value, errors) {
  if (!Array.isArray(value)) {
    addError(errors, "blockers", "must be an array");
    return [];
  }
  if (value.length > MAX_RUNTIME_READINESS_BLOCKERS) {
    addError(errors, "blockers", `must contain at most ${MAX_RUNTIME_READINESS_BLOCKERS} item(s)`);
  }
  return value.slice(0, MAX_RUNTIME_READINESS_BLOCKERS).map((blocker, index) => {
    const item = isObject(blocker) ? blocker : {};
    if (!isObject(blocker)) {
      addError(errors, `blockers[${index}]`, "must be an object");
    }
    return {
      blockerId: stringField(item.blockerId, `blockers[${index}].blockerId`, errors, 160),
      state: stringField(item.state, `blockers[${index}].state`, errors, 80),
      requiredBefore: stringField(
        item.requiredBefore,
        `blockers[${index}].requiredBefore`,
        errors,
        160,
      ),
      summary: stringField(item.summary, `blockers[${index}].summary`, errors, 500),
    };
  });
}

function normalizeConsumerSummary(summary = DEFAULT_RUNTIME_READINESS_CONSUMER_SUMMARY) {
  const errors = [];
  if (!isObject(summary)) {
    throw new Error("runtime readiness summary must be an object");
  }

  assertSafeSummaryText(summary, errors);
  if (summary.version !== RUNTIME_READINESS_CONSUMER_VERSION) {
    addError(errors, "version", `must be ${RUNTIME_READINESS_CONSUMER_VERSION}`);
  }
  if (summary.kind !== "runtime-readiness-consumer") {
    addError(errors, "kind", "must be runtime-readiness-consumer");
  }
  if (summary.readinessSchemaVersion !== RUNTIME_READINESS_SCHEMA_VERSION) {
    addError(errors, "readinessSchemaVersion", `must be ${RUNTIME_READINESS_SCHEMA_VERSION}`);
  }
  if (summary.statusAnswer !== RUNTIME_READINESS_EXPECTED_STATUS_ANSWER) {
    addError(errors, "statusAnswer", `must be ${RUNTIME_READINESS_EXPECTED_STATUS_ANSWER}`);
  }

  const targetModel = isObject(summary.targetModel) ? summary.targetModel : {};
  if (!isObject(summary.targetModel)) {
    addError(errors, "targetModel", "must be an object");
  }
  const safety = isObject(summary.safety) ? summary.safety : {};
  const blockers = normalizeBlockers(summary.blockers, errors);
  const blockerCount = Number.isInteger(summary.blockerCount) && summary.blockerCount >= 0
    ? summary.blockerCount
    : 0;
  if (!Number.isInteger(summary.blockerCount) || summary.blockerCount < 0) {
    addError(errors, "blockerCount", "must be a non-negative integer");
  }
  if (blockerCount !== blockers.length) {
    addError(errors, "blockerCount", "must match blockers length");
  }

  const normalizedSafety = {
    dataOnly: boolField(safety.dataOnly, true, "safety.dataOnly", errors),
    readOnly: boolField(safety.readOnly, true, "safety.readOnly", errors),
    deterministic: boolField(safety.deterministic, true, "safety.deterministic", errors),
    descriptorOnly: boolField(safety.descriptorOnly, true, "safety.descriptorOnly", errors),
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
    systemverilogIdeExecution: boolField(
      safety.systemverilogIdeExecution,
      false,
      "safety.systemverilogIdeExecution",
      errors,
    ),
    fpgaRepoAccess: boolField(safety.fpgaRepoAccess, false, "safety.fpgaRepoAccess", errors),
    kv260RuntimeExecution: safety.kv260RuntimeExecution == null
      ? false
      : boolField(
          safety.kv260RuntimeExecution,
          false,
          "safety.kv260RuntimeExecution",
          errors,
        ),
    kv260Access: boolField(safety.kv260Access, false, "safety.kv260Access", errors),
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
    generatedBlobsIncluded: boolField(
      safety.generatedBlobsIncluded,
      false,
      "safety.generatedBlobsIncluded",
      errors,
    ),
    hardwareDumpsIncluded: boolField(
      safety.hardwareDumpsIncluded,
      false,
      "safety.hardwareDumpsIncluded",
      errors,
    ),
    writesArtifacts: boolField(safety.writesArtifacts, false, "safety.writesArtifacts", errors),
    networkCalls: boolField(safety.networkCalls, false, "safety.networkCalls", errors),
    providerCalls: boolField(safety.providerCalls, false, "safety.providerCalls", errors),
    mcpCalls: boolField(safety.mcpCalls, false, "safety.mcpCalls", errors),
    lspImplemented: boolField(safety.lspImplemented, false, "safety.lspImplemented", errors),
    marketplaceFlow: boolField(
      safety.marketplaceFlow,
      false,
      "safety.marketplaceFlow",
      errors,
    ),
    telemetry: boolField(safety.telemetry, false, "safety.telemetry", errors),
    automaticUpload: boolField(
      safety.automaticUpload,
      false,
      "safety.automaticUpload",
      errors,
    ),
    writeBack: boolField(safety.writeBack, false, "safety.writeBack", errors),
    stableApiAbiClaim: boolField(
      safety.stableApiAbiClaim,
      false,
      "safety.stableApiAbiClaim",
      errors,
    ),
  };

  const normalized = {
    version: summary.version,
    kind: summary.kind,
    readinessSchemaVersion: summary.readinessSchemaVersion,
    readinessId: stringField(summary.readinessId, "readinessId", errors, 160),
    fixtureVersion: stringField(summary.fixtureVersion, "fixtureVersion", errors, 160),
    lastUpdatedSource: stringField(summary.lastUpdatedSource, "lastUpdatedSource", errors, 160),
    statusAnswer: summary.statusAnswer,
    readinessState: stringField(summary.readinessState, "readinessState", errors, 80),
    evidenceState: stringField(summary.evidenceState, "evidenceState", errors, 80),
    targetModel: {
      modelId: stringField(targetModel.modelId, "targetModel.modelId", errors, 160),
      modelFamily: stringField(
        targetModel.modelFamily,
        "targetModel.modelFamily",
        errors,
        80,
      ),
      modelVariant: stringField(
        targetModel.modelVariant,
        "targetModel.modelVariant",
        errors,
        80,
      ),
    },
    targetDevice: stringField(summary.targetDevice, "targetDevice", errors, 80),
    targetBoard: stringField(summary.targetBoard, "targetBoard", errors, 160),
    timingState: stringField(summary.timingState, "timingState", errors, 80),
    bitstreamState: stringField(summary.bitstreamState, "bitstreamState", errors, 80),
    implementationState: stringField(
      summary.implementationState,
      "implementationState",
      errors,
      80,
    ),
    kv260SmokeState: stringField(summary.kv260SmokeState, "kv260SmokeState", errors, 80),
    runtimeEvidenceState: stringField(
      summary.runtimeEvidenceState,
      "runtimeEvidenceState",
      errors,
      80,
    ),
    throughputState: stringField(summary.throughputState, "throughputState", errors, 80),
    blockerCount,
    blockers,
    safety: normalizedSafety,
  };

  if (errors.length > 0) {
    throw new Error(`invalid runtime readiness summary: ${errors.join("; ")}`);
  }

  return normalized;
}

export function cloneDefaultRuntimeReadinessConsumerSummary() {
  return clone(DEFAULT_RUNTIME_READINESS_CONSUMER_SUMMARY);
}

export function createRuntimeReadinessStatusSurface(
  consumerSummary = DEFAULT_RUNTIME_READINESS_CONSUMER_SUMMARY,
) {
  const summary = normalizeConsumerSummary(consumerSummary);
  const boundary = createRuntimeReadinessConsumerBoundaryStatus();
  const displaySummary = [
    summary.statusAnswer,
    `${summary.blockerCount} blocker(s)`,
    "read-only",
  ].join(", ");

  return {
    version: RUNTIME_READINESS_STATUS_SURFACE_VERSION,
    kind: "runtime-readiness-status-surface",
    source: {
      kind: summary.kind,
      version: summary.version,
      adapterOutput: true,
      rawReadinessParsedByUi: false,
    },
    readiness: {
      status: "available",
      summaryAvailable: true,
      localOnly: true,
      experimental: true,
      statusAnswer: summary.statusAnswer,
      readinessState: summary.readinessState,
      evidenceState: summary.evidenceState,
    },
    fixture: {
      schemaVersion: summary.readinessSchemaVersion,
      readinessId: summary.readinessId,
      fixtureVersion: summary.fixtureVersion,
      lastUpdatedSource: summary.lastUpdatedSource,
    },
    target: {
      model: summary.targetModel,
      device: summary.targetDevice,
      board: summary.targetBoard,
    },
    states: {
      timing: summary.timingState,
      bitstream: summary.bitstreamState,
      implementation: summary.implementationState,
      kv260Smoke: summary.kv260SmokeState,
      runtimeEvidence: summary.runtimeEvidenceState,
      throughput: summary.throughputState,
    },
    blockers: {
      count: summary.blockerCount,
      items: summary.blockers,
    },
    safety: {
      ...summary.safety,
      localOnly: true,
      pccxLabValidatorInvocation: false,
      shellExecution: false,
      kv260RuntimeExecution: false,
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
      accessesFpgaRepo: boundary.accessesFpgaRepo,
      kv260RuntimeExecution: boundary.kv260RuntimeExecution,
      modelExecution: boundary.modelExecution,
      modelWeightPathsIncluded: boundary.modelWeightPathsIncluded,
      providerCalls: boundary.providerCalls,
      runtimeCalls: boundary.runtimeCalls,
      mcpCalls: boundary.mcpCalls,
      lspImplemented: boundary.lspImplemented,
      marketplaceFlow: boundary.marketplaceFlow,
      telemetry: boundary.telemetry,
      automaticUpload: boundary.automaticUpload,
      writeBack: boundary.writeBack,
    },
    display: {
      summary: displaySummary,
    },
  };
}

export function runtimeReadinessStatusSurfaceJson(
  consumerSummary = DEFAULT_RUNTIME_READINESS_CONSUMER_SUMMARY,
) {
  return `${JSON.stringify(createRuntimeReadinessStatusSurface(consumerSummary), null, 2)}\n`;
}

export function formatRuntimeReadinessStatusSurface(surface) {
  return [
    "Runtime Readiness Summary",
    `schema: ${surface.fixture.schemaVersion}`,
    `statusAnswer: ${surface.readiness.statusAnswer}`,
    `target: ${surface.target.model.modelFamily}/${surface.target.model.modelVariant} on ${surface.target.device}`,
    `readinessState: ${surface.readiness.readinessState}`,
    `evidenceState: ${surface.readiness.evidenceState}`,
    `timing: ${surface.states.timing}`,
    `bitstream: ${surface.states.bitstream}`,
    `implementation: ${surface.states.implementation}`,
    `kv260Smoke: ${surface.states.kv260Smoke}`,
    `runtimeEvidence: ${surface.states.runtimeEvidence}`,
    `throughput: ${surface.states.throughput}`,
    `blockers: ${surface.blockers.count}`,
    `readOnly: ${surface.safety.readOnly ? "yes" : "no"}`,
    `dataOnly: ${surface.safety.dataOnly ? "yes" : "no"}`,
    "execution: no launcher, no pccx-lab, no FPGA repo, no KV260 runtime, no providers",
  ].join("\n");
}

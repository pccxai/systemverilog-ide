import assert from "node:assert/strict";

import {
  DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP,
  LAUNCHER_BACKEND_KINDS,
  LAUNCHER_DEVICE_STATUSES,
  LAUNCHER_MODEL_STATUSES,
  LAUNCHER_SESSION_STATUSES,
  LAUNCHER_STATUS_CONTRACT_VERSION,
  LAUNCHER_STATUS_SCHEMA_VERSION,
  LAUNCHER_STATUSES,
  createDefaultLauncherStatusContract,
  createLauncherStatusContractStatus,
  normalizeLauncherStatusContract,
  validateLauncherStatusContract,
} from "../src/launcher-status-contract.mjs";

function assertInvalid(value, pattern) {
  const result = validateLauncherStatusContract(value);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
  assert.throws(() => normalizeLauncherStatusContract(value), pattern);
}

function status(overrides = {}) {
  return {
    version: 1,
    launcherStatus: "future",
    deviceStatus: "unknown",
    sessionStatus: "none",
    modelStatus: "unknown",
    backendKind: "future",
    capabilities: ["future bounded context consumer"],
    limitations: ["no runtime calls"],
    lastUpdatedAt: DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP,
    ...overrides,
  };
}

function testDefaultLauncherStatusIsFutureOnlyAndDeterministic() {
  const status = createDefaultLauncherStatusContract();

  assert.equal(status.version, LAUNCHER_STATUS_SCHEMA_VERSION);
  assert.equal(status.launcherStatus, "future");
  assert.equal(status.deviceStatus, "unknown");
  assert.equal(status.sessionStatus, "none");
  assert.equal(status.modelStatus, "unknown");
  assert.equal(status.backendKind, "future");
  assert.ok(status.capabilities.includes("future bounded context consumer"));
  assert.ok(status.limitations.includes("no launcher runtime calls in this prototype"));
  assert.equal(status.lastUpdatedAt, DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP);
}

function testLauncherStatusWrapperHasNoRuntimeCalls() {
  const wrapper = createLauncherStatusContractStatus();

  assert.equal(wrapper.version, LAUNCHER_STATUS_CONTRACT_VERSION);
  assert.equal(wrapper.schemaVersion, LAUNCHER_STATUS_SCHEMA_VERSION);
  assert.equal(wrapper.statusOnly, true);
  assert.equal(wrapper.fixtureOnly, true);
  assert.equal(wrapper.providerCalls, false);
  assert.equal(wrapper.runtimeCalls, false);
  assert.equal(wrapper.launcherCalls, false);
  assert.equal(wrapper.deviceCommunication, false);
  assert.equal(wrapper.modelPathsIncluded, false);
  assert.equal(wrapper.boardLogsIncluded, false);
  assert.equal(wrapper.status.launcherStatus, "future");
}

function testAllowedEnumsAreExplicit() {
  assert.deepEqual(LAUNCHER_STATUSES, ["unavailable", "available", "future", "disabled"]);
  assert.deepEqual(LAUNCHER_DEVICE_STATUSES, ["unknown", "not-connected", "connected", "future"]);
  assert.deepEqual(LAUNCHER_SESSION_STATUSES, ["none", "starting", "running", "stopped", "future"]);
  assert.deepEqual(LAUNCHER_MODEL_STATUSES, ["unknown", "not-loaded", "loaded", "future"]);
  assert.deepEqual(LAUNCHER_BACKEND_KINDS, ["local", "external", "future", "unknown"]);
}

function testCanNormalizeSafeFixtureStatus() {
  const status = normalizeLauncherStatusContract({
    version: 1,
    launcherStatus: "disabled",
    deviceStatus: "future",
    sessionStatus: "future",
    modelStatus: "future",
    backendKind: "future",
    capabilities: ["bounded status fixture"],
    limitations: ["no runtime calls"],
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(status.launcherStatus, "disabled");
  assert.equal(status.lastUpdatedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(status.capabilities, ["bounded status fixture"]);
}

function testRejectsUnsafeStringsAndClaims() {
  assertInvalid(
    status({
      capabilities: ["/home/dev/models/local.gguf"],
    }),
    /model artifacts/,
  );
  assertInvalid(
    status({
      limitations: ["TOKEN=hidden"],
    }),
    /secrets/,
  );
  assertInvalid(
    status({
      capabilities: ["KV260 model runs"],
    }),
    /performance claims/,
  );
  assertInvalid(
    {
      ...status(),
      modelPath: "weights/local.bin",
    },
    /modelPath: is not allowed/,
  );
}

function testRejectsInvalidEnumsAndTimestamp() {
  assertInvalid(
    status({ launcherStatus: "ready" }),
    /launcherStatus: must be one of/,
  );
  assertInvalid(
    status({ lastUpdatedAt: "not-a-date" }),
    /lastUpdatedAt: must be an ISO timestamp string/,
  );
}

testDefaultLauncherStatusIsFutureOnlyAndDeterministic();
testLauncherStatusWrapperHasNoRuntimeCalls();
testAllowedEnumsAreExplicit();
testCanNormalizeSafeFixtureStatus();
testRejectsUnsafeStringsAndClaims();
testRejectsInvalidEnumsAndTimestamp();

console.log("vscode launcher status contract tests ok");

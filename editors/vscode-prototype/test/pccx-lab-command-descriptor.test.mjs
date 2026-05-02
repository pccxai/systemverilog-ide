import assert from "node:assert/strict";

import {
  PCCX_LAB_COMMAND_CATEGORIES,
  PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION,
  PCCX_LAB_COMMAND_DESCRIPTOR_VERSION,
  PCCX_LAB_COMMAND_EXECUTION_STATES,
  PCCX_LAB_WORKING_DIRECTORY_POLICIES,
  createPccxLabCommandDescriptorStatus,
  listPccxLabCommandDescriptors,
  normalizePccxLabCommandDescriptor,
  validatePccxLabCommandDescriptor,
} from "../src/pccx-lab-command-descriptor.mjs";

function descriptor(overrides = {}) {
  return {
    version: PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION,
    descriptorId: "labStatus",
    label: "pccx-lab backend status",
    category: "status",
    executionState: "future",
    args: [],
    workingDirectoryPolicy: "repo-root",
    outputPolicy: {
      maxLines: 120,
      redactSecrets: true,
      dropPrivatePaths: true,
    },
    requiresExplicitApproval: true,
    ...overrides,
  };
}

function assertInvalid(value, pattern) {
  const result = validatePccxLabCommandDescriptor(value);

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
  assert.throws(() => normalizePccxLabCommandDescriptor(value), pattern);
}

function testDescriptorNormalizesSafeDataOnlyShape() {
  const normalized = normalizePccxLabCommandDescriptor(descriptor());

  assert.equal(normalized.version, 1);
  assert.equal(normalized.descriptorId, "labStatus");
  assert.equal(normalized.label, "pccx-lab backend status");
  assert.equal(normalized.category, "status");
  assert.equal(normalized.executionState, "future");
  assert.deepEqual(normalized.args, []);
  assert.equal(normalized.workingDirectoryPolicy, "repo-root");
  assert.deepEqual(normalized.outputPolicy, {
    maxLines: 120,
    redactSecrets: true,
    dropPrivatePaths: true,
  });
  assert.equal(normalized.requiresExplicitApproval, true);
}

function testStatusListsDefaultFutureDescriptorWithoutExecution() {
  const status = createPccxLabCommandDescriptorStatus();
  const descriptors = listPccxLabCommandDescriptors();

  assert.equal(status.version, PCCX_LAB_COMMAND_DESCRIPTOR_VERSION);
  assert.equal(status.schemaVersion, PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION);
  assert.equal(status.descriptorOnly, true);
  assert.equal(status.executes, false);
  assert.equal(status.backendCommandExecuted, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.launcherCalls, false);
  assert.equal(status.mcpCalls, false);
  assert.deepEqual(status.descriptors, descriptors);
  assert.equal(descriptors[0].descriptorId, "labStatus");
  assert.equal(descriptors[0].executionState, "future");
}

function testAllowedEnumsAreExplicit() {
  assert.deepEqual(PCCX_LAB_COMMAND_CATEGORIES, [
    "status",
    "diagnostics",
    "trace",
    "verification",
  ]);
  assert.deepEqual(PCCX_LAB_COMMAND_EXECUTION_STATES, [
    "future",
    "disabled",
    "allowlisted",
  ]);
  assert.deepEqual(PCCX_LAB_WORKING_DIRECTORY_POLICIES, [
    "repo-root",
    "workspace-root",
    "configured",
  ]);
}

function testRejectsRawShellCommandAndUnsafeText() {
  assertInvalid(
    descriptor({ args: ["bash scripts/private.sh"] }),
    /args\[0\]: must not include secrets, private paths, or shell command text/,
  );
  assertInvalid(
    descriptor({ label: "/home/dev/private" }),
    /label: must not include secrets, private paths, or shell command text/,
  );
  assertInvalid(
    descriptor({ descriptorId: "token=hidden" }),
    /descriptorId: must not include secrets, private paths, or shell command text/,
  );
}

function testRejectsExecutionOrOutputPolicyEscapes() {
  assertInvalid(
    {
      ...descriptor(),
      command: "pccx-lab status",
    },
    /command: is not allowed/,
  );
  assertInvalid(
    descriptor({ requiresExplicitApproval: false }),
    /requiresExplicitApproval: must be true/,
  );
  assertInvalid(
    descriptor({
      outputPolicy: {
        maxLines: 1000,
        redactSecrets: true,
        dropPrivatePaths: true,
      },
    }),
    /outputPolicy\.maxLines: must be between 1 and 500/,
  );
  assertInvalid(
    descriptor({
      outputPolicy: {
        maxLines: 120,
        redactSecrets: false,
        dropPrivatePaths: true,
      },
    }),
    /outputPolicy\.redactSecrets: must be true/,
  );
}

testDescriptorNormalizesSafeDataOnlyShape();
testStatusListsDefaultFutureDescriptorWithoutExecution();
testAllowedEnumsAreExplicit();
testRejectsRawShellCommandAndUnsafeText();
testRejectsExecutionOrOutputPolicyEscapes();

console.log("vscode pccx-lab command descriptor tests ok");

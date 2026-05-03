import assert from "node:assert/strict";

import {
  LOCAL_WORKFLOW_STATUS_VERSION,
  createLocalWorkflowStatus,
  formatLocalWorkflowStatus,
} from "../src/local-workflow-status.mjs";
import {
  createValidationResultCache,
} from "../src/validation-result-cache.mjs";

function testLocalWorkflowStatusUsesDeterministicLocalDataOnly() {
  const cache = createValidationResultCache({ maxSize: 5 });
  cache.add({
    proposalId: "vscodeAdapterSmoke",
    commandLabel: "VS Code adapter smoke",
    status: "passed",
    exitCode: 0,
    durationMs: 12,
    stdoutSummary: { lines: ["ok"], lineCount: 1, truncated: false },
    stderrSummary: { lines: [], lineCount: 0, truncated: false },
    safety: { allowlisted: true, shell: false, fixedArgs: true },
  });

  const status = createLocalWorkflowStatus(
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      validationRunner: { enabled: true, mode: "allowlisted" },
    },
    {
      validationResultCache: cache,
      contextSummary: {
        diagnosticCount: 2,
        snippetCount: 1,
        declarationCount: 3,
        pccxLabOutputCount: 0,
      },
      validationHistoryCount: 1,
      launcherStatusCount: 1,
      labStatusCount: 1,
    },
  );

  assert.equal(status.version, LOCAL_WORKFLOW_STATUS_VERSION);
  assert.equal(status.kind, "local-workflow-status");
  assert.equal(status.extensionMode, "liveWorkspace");
  assert.equal(status.liveWorkspace.enabled, true);
  assert.deepEqual(status.validationRunner, { enabled: true, mode: "allowlisted" });
  assert.equal(status.recentValidation.count, 1);
  assert.equal(status.recentValidation.maxSize, 5);
  assert.equal(status.recentValidation.latestStatus, "passed");
  assert.equal(status.recentValidation.latestProposalId, "vscodeAdapterSmoke");
  assert.equal(status.pccxLabBoundary.state, "future");
  assert.equal(status.pccxLabBoundary.descriptorOnly, true);
  assert.equal(status.pccxLabBoundary.executes, false);
  assert.equal(status.launcherBoundary.state, "future");
  assert.equal(status.launcherBoundary.fixtureOnly, true);
  assert.equal(status.launcherBoundary.runtimeCalls, false);
  assert.equal(status.diagnosticsHandoffBoundary.supportedSchemaVersion, "pccx.diagnosticsHandoff.v0");
  assert.equal(status.diagnosticsHandoffBoundary.fixtureConsumer, true);
  assert.equal(status.diagnosticsHandoffBoundary.readOnly, true);
  assert.equal(status.diagnosticsHandoffBoundary.invokesLauncher, false);
  assert.equal(status.diagnosticsHandoffBoundary.invokesPccxLab, false);
  assert.equal(status.diagnosticsHandoffBoundary.lspImplemented, false);
  assert.equal(status.diagnosticsHandoffBoundary.surfaceStatus, "available");
  assert.equal(status.diagnosticsHandoffBoundary.summaryAvailable, true);
  assert.equal(status.diagnosticsHandoffBoundary.diagnosticCount, 5);
  assert.equal(status.contextBundle.itemCount, 9);
  assert.equal(status.safety.providerCalls, false);
  assert.equal(status.safety.launcherCalls, false);
  assert.equal(status.safety.pccxLabExecution, false);
}

function testLocalWorkflowStatusDefaultsAreDisabledAndSafe() {
  const status = createLocalWorkflowStatus({}, {});
  const text = formatLocalWorkflowStatus(status);

  assert.equal(status.extensionMode, "checkedExample");
  assert.equal(status.liveWorkspace.enabled, false);
  assert.deepEqual(status.validationRunner, { enabled: false, mode: "disabled" });
  assert.equal(status.recentValidation.count, 0);
  assert.equal(status.pccxLabBoundary.executes, false);
  assert.equal(status.launcherBoundary.launcherCalls, false);
  assert.equal(status.diagnosticsHandoffBoundary.invokesLauncher, false);
  assert.equal(status.diagnosticsHandoffBoundary.invokesPccxLab, false);
  assert.equal(status.diagnosticsHandoffBoundary.surfaceStatus, "available");
  assert.equal(status.diagnosticsHandoffBoundary.summaryAvailable, true);
  assert.match(text, /Local Workflow Status/);
  assert.match(text, /validationRunner: disabled/);
  assert.match(text, /diagnosticsHandoffBoundary: pccx\.diagnosticsHandoff\.v0 readOnly=yes/);
  assert.match(text, /diagnosticsHandoffSummary: available diagnostics=5/);
  assert.match(text, /no pccx-lab execution/);
  assert.doesNotMatch(JSON.stringify(status), /\/home\/|TOKEN=|model\.gguf/);
}

testLocalWorkflowStatusUsesDeterministicLocalDataOnly();
testLocalWorkflowStatusDefaultsAreDisabledAndSafe();

console.log("vscode local workflow status tests ok");

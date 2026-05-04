// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import assert from "node:assert/strict";

import {
  WORKFLOW_BOUNDARY_VERSION,
  WORKFLOW_BOUNDARY_STATUSES,
  WORKFLOW_PROPOSAL_KINDS,
  DISALLOWED_WORKFLOW_ACTIONS,
  createWorkflowBoundaryStatus,
  createWorkflowContextRequest,
  createCommandProposal,
} from "../src/workflow-boundary.mjs";

function testDisabledByDefault() {
  const status = createWorkflowBoundaryStatus();

  assert.equal(status.version, WORKFLOW_BOUNDARY_VERSION);
  assert.equal(status.status, WORKFLOW_BOUNDARY_STATUSES.DISABLED);
  assert.equal(status.backend, "none");
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.providerCallsImplemented, false);
  assert.equal(status.runtimeCallsImplemented, false);
  assert.equal(status.mcpServerImplemented, false);
  assert.equal(status.proposalOnly, true);
  assert.deepEqual(
    status.allowedActions.map((action) => action.kind),
    WORKFLOW_PROPOSAL_KINDS,
  );
  assert.deepEqual(status.disallowedActions, DISALLOWED_WORKFLOW_ACTIONS);
}

function testEnabledButNoBackendIsNotConfigured() {
  const status = createWorkflowBoundaryStatus({
    workflowBoundary: {
      enabled: true,
      backend: "none",
    },
  });

  assert.equal(status.status, WORKFLOW_BOUNDARY_STATUSES.NOT_CONFIGURED);
  assert.equal(status.backend, "none");
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
}

function testLauncherBackendRemainsProposalBoundary() {
  const request = createWorkflowContextRequest(
    {
      workflowBoundary: {
        enabled: true,
        backend: "pccx-llm-launcher",
      },
    },
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/top.sv",
      userIntent: "explain diagnostics",
      activeDiagnostics: [
        { file: "/repo/rtl/top.sv", severity: "Error", message: "missing endmodule" },
      ],
    },
    { workspaceRoot: "/repo" },
  );

  assert.equal(request.status, WORKFLOW_BOUNDARY_STATUSES.PROPOSAL_BOUNDARY);
  assert.equal(request.backend, "pccx-llm-launcher");
  assert.equal(request.providerCalls, false);
  assert.equal(request.runtimeCalls, false);
  assert.deepEqual(
    request.allowedActions.map((action) => action.kind),
    WORKFLOW_PROPOSAL_KINDS,
  );
  assert.ok(request.allowedActions.every((action) => action.execution === "proposalOnly"));
  assert.deepEqual(request.disallowedActions, DISALLOWED_WORKFLOW_ACTIONS);
  assert.ok(request.disallowedActions.includes("writeFile"));
  assert.ok(request.disallowedActions.includes("commit"));
  assert.ok(request.disallowedActions.includes("accessSecrets"));
  assert.equal(request.kind, "workflow-context-bundle");
  assert.equal(request.contextSummary.selectedFile.path, "rtl/top.sv");
  assert.equal(request.contextSummary.diagnosticCount, 1);
}

function testCommandProposalsAreProposalOnly() {
  assert.deepEqual(
    createCommandProposal("proposeValidationCommand", { flow: "problems from-check" }),
    {
      kind: "proposeValidationCommand",
      execution: "proposalOnly",
      payload: { flow: "problems from-check" },
    },
  );
  assert.throws(
    () => createCommandProposal("writeFile"),
    /unsupported workflow boundary proposal kind/,
  );
}

testDisabledByDefault();
testEnabledButNoBackendIsNotConfigured();
testLauncherBackendRemainsProposalBoundary();
testCommandProposalsAreProposalOnly();

console.log("vscode workflow boundary tests ok");

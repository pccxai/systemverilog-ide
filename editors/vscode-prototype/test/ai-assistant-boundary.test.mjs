import assert from "node:assert/strict";

import {
  AI_ASSISTANT_BOUNDARY_VERSION,
  AI_ASSISTANT_STATUSES,
  AI_PROPOSAL_KINDS,
  DISALLOWED_AI_ACTIONS,
  createAssistantBoundaryStatus,
  createAssistantRequest,
  createCommandProposal,
} from "../src/ai-assistant-boundary.mjs";

function testDisabledByDefault() {
  const status = createAssistantBoundaryStatus();

  assert.deepEqual(status, {
    version: AI_ASSISTANT_BOUNDARY_VERSION,
    status: AI_ASSISTANT_STATUSES.DISABLED,
    backend: "none",
    providerCalls: false,
    runtimeCalls: false,
  });
}

function testEnabledButNoBackendIsNotConfigured() {
  const status = createAssistantBoundaryStatus({
    aiAssistant: {
      enabled: true,
      backend: "none",
    },
  });

  assert.equal(status.status, AI_ASSISTANT_STATUSES.NOT_CONFIGURED);
  assert.equal(status.backend, "none");
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
}

function testLauncherBackendRemainsProposalBoundary() {
  const request = createAssistantRequest(
    {
      aiAssistant: {
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

  assert.equal(request.status, AI_ASSISTANT_STATUSES.PROPOSAL_BOUNDARY);
  assert.equal(request.backend, "pccx-llm-launcher");
  assert.equal(request.providerCalls, false);
  assert.equal(request.runtimeCalls, false);
  assert.deepEqual(
    request.allowedActions.map((action) => action.kind),
    AI_PROPOSAL_KINDS,
  );
  assert.ok(request.allowedActions.every((action) => action.execution === "proposalOnly"));
  assert.deepEqual(request.disallowedActions, DISALLOWED_AI_ACTIONS);
  assert.ok(request.disallowedActions.includes("directFileWrite"));
  assert.ok(request.disallowedActions.includes("arbitraryShellCommand"));
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
    () => createCommandProposal("directFileWrite"),
    /unsupported AI assistant proposal kind/,
  );
}

testDisabledByDefault();
testEnabledButNoBackendIsNotConfigured();
testLauncherBackendRemainsProposalBoundary();
testCommandProposalsAreProposalOnly();

console.log("vscode AI assistant boundary tests ok");

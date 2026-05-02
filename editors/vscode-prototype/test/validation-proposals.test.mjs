import assert from "node:assert/strict";

import {
  VALIDATION_PROPOSAL_CATEGORIES,
  VALIDATION_PROPOSAL_VERSION,
  createValidationCommandProposal,
  findValidationCommandProposalById,
  listValidationCommandProposals,
} from "../src/validation-proposals.mjs";
import {
  PCCX_LAB_BACKEND_STATUS_VERSION,
  createPccxLabBackendStatus,
} from "../src/pccx-lab-status.mjs";

const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\(|>|<)/;

function testValidationProposalIsDataOnly() {
  const proposal = createValidationCommandProposal({
    userCommand: "git push origin main && rm -rf /",
  });

  assert.equal(proposal.version, VALIDATION_PROPOSAL_VERSION);
  assert.equal(proposal.kind, "validation-command-proposal");
  assert.equal(proposal.execution, "proposalOnly");
  assert.equal(proposal.proposalOnly, true);
  assert.equal(proposal.executes, false);
  assert.equal(proposal.requiresUserApproval, true);
  assert.equal(proposal.providerCalls, false);
  assert.equal(proposal.runtimeCalls, false);
  assert.deepEqual(
    proposal.proposals.map((item) => item.category),
    VALIDATION_PROPOSAL_CATEGORIES,
  );
  assert.deepEqual(
    proposal.proposals.map((item) => item.id),
    [
      "vscodeAdapterSmoke",
      "editorBridgeSmoke",
      "exampleDriftCheck",
      "pytestBaseline",
      "extensionHostSmokeOptIn",
      "futurePccxLabDiagnostics",
      "futureXsimLogAnalysis",
    ],
  );
  assert.ok(proposal.proposals.every((item) => item.requiresUserApproval === true));
  assert.ok(proposal.proposals.every((item) => item.executes === false));
  assert.ok(proposal.disallowedActions.includes("commit"));
  assert.ok(proposal.disallowedActions.includes("release"));
  assert.doesNotMatch(JSON.stringify(proposal), /git push|rm -rf/);
}

function testValidationCommandsAreAllowlistedArgumentArrays() {
  const proposal = createValidationCommandProposal();
  const commandProposals = proposal.proposals.filter((item) => item.command);
  const flattened = commandProposals.flatMap((item) => item.command.argv);

  assert.ok(commandProposals.length > 0);
  assert.ok(commandProposals.every((item) => item.command.cwd === "repo-root"));
  assert.ok(commandProposals.every((item) => Array.isArray(item.command.argv)));
  assert.ok(commandProposals.every((item) => item.command.argv.every((arg) => typeof arg === "string")));
  assert.ok(commandProposals.some((item) => (
    item.command.env.PCCX_RUN_EXTENSION_HOST_SMOKE === "1"
  )));
  assert.equal(
    commandProposals.find((item) => item.id === "extensionHostSmokeOptIn").runnerPolicy,
    "proposalOnly",
  );
  assert.doesNotMatch(flattened.join("\n"), SHELL_CONTROL_PATTERN);
  assert.doesNotMatch(flattened.join("\n"), /\b(?:git|gh)\s+(?:push|commit|merge|release|tag)\b/i);
}

function testValidationProposalsCanBeResolvedByStableId() {
  const proposals = listValidationCommandProposals();
  const adapter = findValidationCommandProposalById("vscodeAdapterSmoke");

  assert.ok(proposals.some((item) => item.id === "vscodeAdapterSmoke"));
  assert.equal(adapter.id, "vscodeAdapterSmoke");
  assert.equal(adapter.command.argv[0], "bash");
  assert.equal(adapter.command.argv[1], "scripts/vscode-adapter-smoke.sh");
  assert.equal(findValidationCommandProposalById("bash scripts/vscode-adapter-smoke.sh"), null);
}

function testPccxLabStatusIsStatusOnly() {
  const status = createPccxLabBackendStatus({
    pccxLab: { command: "custom-pccx-lab" },
  });

  assert.equal(status.version, PCCX_LAB_BACKEND_STATUS_VERSION);
  assert.equal(status.kind, "pccx-lab-backend-status");
  assert.equal(status.configuredCommand, "custom-pccx-lab");
  assert.equal(status.execution, "statusOnly");
  assert.equal(status.executes, false);
  assert.equal(status.providerCalls, false);
  assert.equal(status.runtimeCalls, false);
  assert.equal(status.backendCommandExecuted, false);
  assert.ok(status.futureControlledOperations.includes("diagnostics"));
  assert.ok(status.futureControlledOperations.includes("xsim-log analysis"));
  assert.ok(status.futureControlledOperations.includes("validation summary"));
  assert.ok(status.futureSafetyRequirements.includes("fixed args"));
  assert.ok(status.futureSafetyRequirements.includes("bounded output"));
}

testValidationProposalIsDataOnly();
testValidationCommandsAreAllowlistedArgumentArrays();
testValidationProposalsCanBeResolvedByStableId();
testPccxLabStatusIsStatusOnly();

console.log("vscode validation proposal and pccx-lab status tests ok");

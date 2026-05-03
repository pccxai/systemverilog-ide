import assert from "node:assert/strict";

import {
  VALIDATION_PROPOSAL_DIAGNOSTICS_HANDOFF_CONTEXT_VERSION,
  VALIDATION_PROPOSAL_CATEGORIES,
  VALIDATION_PROPOSAL_PREFLIGHT_VERSION,
  VALIDATION_PROPOSAL_VERSION,
  createValidationDiagnosticsHandoffContext,
  createValidationCommandProposal,
  findValidationCommandProposalById,
  listValidationCommandProposals,
} from "../src/validation-proposals.mjs";
import {
  PCCX_LAB_BACKEND_STATUS_VERSION,
  createPccxLabBackendStatus,
} from "../src/pccx-lab-status.mjs";
import {
  buildContextBundle,
} from "../src/context-bundle.mjs";
import {
  cloneDefaultDiagnosticsHandoffConsumerSummary,
  createDiagnosticsHandoffStatusSurface,
} from "../src/diagnostics-handoff-status-surface.mjs";

const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\(|>|<)/;
const UNSUPPORTED_READINESS_PATTERN = new RegExp([
  ["production", "-ready"],
  ["marketplace", "-ready"],
  ["stable", " API"],
  ["stable", " ABI"],
  ["MCP", " ready"],
  ["AI provider", " ready"],
  ["KV260 inference", " works"],
  ["provider", " ready"],
  ["runtime", " ready"],
  ["LSP", " ready"],
].map((parts) => parts.join("")).join("|"), "i");

function assertBoundedDiagnosticsHandoffContext(context) {
  assert.equal(context.version, VALIDATION_PROPOSAL_DIAGNOSTICS_HANDOFF_CONTEXT_VERSION);
  assert.equal(context.source, "contextBundle.diagnosticsHandoff");
  assert.ok(["available", "unavailable", "invalid"].includes(context.status));
  assert.ok(context.preflightNotes.length <= 4);
  assert.ok(context.issueNotes.length <= 3);
  assert.ok(context.preflightNotes.every((note) => note.length <= 240));
  assert.ok(context.issueNotes.every((note) => note.length <= 240));
  assert.equal(context.safety.dataOnly, true);
  assert.equal(context.safety.readOnly, true);
  assert.equal(context.safety.proposalOnly, true);
  assert.equal(context.safety.launcherExecution, false);
  assert.equal(context.safety.pccxLabExecution, false);
  assert.equal(context.safety.pccxLabValidatorInvocation, false);
  assert.equal(context.safety.shellExecution, false);
  assert.equal(context.safety.providerCalls, false);
  assert.equal(context.safety.runtimeCalls, false);
  assert.equal(context.safety.mcpCalls, false);
  assert.equal(context.safety.lspImplemented, false);
  assert.equal(context.safety.marketplaceFlow, false);
  assert.equal(context.safety.telemetry, false);
  assert.equal(context.safety.automaticUpload, false);
  assert.equal(context.safety.writeBack, false);
}

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
  assert.equal(proposal.diagnosticsHandoffContext.status, "unavailable");
  assertBoundedDiagnosticsHandoffContext(proposal.diagnosticsHandoffContext);
  assert.equal(proposal.safety.launcherExecution, false);
  assert.equal(proposal.safety.pccxLabExecution, false);
  assert.equal(proposal.safety.pccxLabValidatorInvocation, false);
  assert.equal(proposal.safety.shellExecution, false);
  assert.equal(proposal.safety.providerCalls, false);
  assert.equal(proposal.safety.runtimeCalls, false);
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
  assert.ok(proposal.proposals.every((item) => item.status.proposalOnly === true));
  assert.ok(proposal.proposals.every((item) => (
    item.status.diagnosticsHandoff === "unavailable"
  )));
  assert.ok(proposal.proposals.every((item) => (
    item.preflight.version === VALIDATION_PROPOSAL_PREFLIGHT_VERSION
  )));
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

function testDiagnosticsHandoffAvailableContextImprovesProposalPreflight() {
  const contextBundle = buildContextBundle({
    diagnosticsHandoffSummary: cloneDefaultDiagnosticsHandoffConsumerSummary(),
  });
  const first = createValidationCommandProposal({ contextBundle });
  const second = createValidationCommandProposal({ contextBundle });
  const context = first.diagnosticsHandoffContext;
  const serialized = JSON.stringify(first);

  assert.deepEqual(first, second);
  assertBoundedDiagnosticsHandoffContext(context);
  assert.equal(context.status, "available");
  assert.equal(context.sourceStatus, "available");
  assert.equal(context.summaryAvailable, true);
  assert.equal(context.schemaVersion, "pccx.diagnosticsHandoff.v0");
  assert.equal(context.diagnostics.count, 5);
  assert.equal(context.diagnostics.bySeverity.blocked, 2);
  assert.match(context.summary, /5 diagnostic item\(s\), 2 blocked, 1 warning, 0 error/);
  assert.ok(context.preflightNotes.some((note) => /local context bundle/.test(note)));
  assert.ok(context.issueNotes.some((note) => /2 blocked/.test(note)));
  assert.ok(first.proposals.every((proposal) => (
    proposal.status.diagnosticsHandoff === "available" &&
    proposal.preflight.diagnosticsHandoff.status === "available" &&
    proposal.preflight.diagnosticsHandoff.summary === context.summary &&
    proposal.reasonContext.diagnosticsHandoff === context.summary
  )));
  assert.doesNotMatch(serialized, UNSUPPORTED_READINESS_PATTERN);
  assert.doesNotMatch(serialized, /pccx-lab diagnostics-handoff validate/i);
  assert.doesNotMatch(serialized, /pccx-llm-launcher\s+(?:run|status|launch|diagnostics)/i);
  assert.doesNotMatch(serialized, /launcher_diagnostics_handoff_gemma3n_e4b_kv260_placeholder/);
}

function testDiagnosticsHandoffUnavailableContextIsExplicit() {
  const contextBundle = buildContextBundle({});
  const proposal = createValidationCommandProposal({ contextBundle });
  const context = proposal.diagnosticsHandoffContext;

  assertBoundedDiagnosticsHandoffContext(context);
  assert.equal(context.status, "unavailable");
  assert.equal(context.sourceStatus, "notAvailable");
  assert.equal(context.summaryAvailable, false);
  assert.match(context.summary, /unavailable/);
  assert.ok(context.preflightNotes.some((note) => /No diagnostics handoff summary/.test(note)));
  assert.ok(proposal.proposals.every((item) => (
    item.preflight.diagnosticsHandoff.status === "unavailable"
  )));
}

function testDiagnosticsHandoffInvalidContextIsExplicitAndSafe() {
  const unsafeSurface = createDiagnosticsHandoffStatusSurface(
    cloneDefaultDiagnosticsHandoffConsumerSummary(),
  );
  unsafeSurface.safety.pccxLabExecution = true;
  unsafeSurface.limitations = ["/home/user/private.log"];
  const contextBundle = buildContextBundle(
    { diagnosticsHandoffStatus: unsafeSurface },
    { limits: { maxTextCharacters: 80 } },
  );
  const proposal = createValidationCommandProposal({ contextBundle });
  const context = proposal.diagnosticsHandoffContext;
  const serialized = JSON.stringify(proposal);

  assertBoundedDiagnosticsHandoffContext(context);
  assert.equal(context.status, "invalid");
  assert.equal(context.summaryAvailable, false);
  assert.match(context.summary, /invalid or unsafe/);
  assert.ok(context.issueNotes.some((note) => /data-only/.test(note)));
  assert.ok(proposal.proposals.every((item) => (
    item.status.diagnosticsHandoff === "invalid" &&
    item.preflight.diagnosticsHandoff.status === "invalid"
  )));
  assert.doesNotMatch(serialized, /\/home\/user/);
  assert.equal(proposal.safety.pccxLabExecution, false);
}

function testRawHandoffJsonIsNotParsedByValidationProposalCode() {
  const proposal = createValidationCommandProposal({
    diagnosticsHandoff: {
      schemaVersion: "pccx.diagnosticsHandoff.v0",
      handoffId: "raw_handoff_should_not_flow",
      diagnostics: [{ severity: "blocked" }],
    },
  });

  assert.equal(proposal.diagnosticsHandoffContext.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(proposal), /raw_handoff_should_not_flow/);
}

function testValidationProposalsCanBeResolvedByStableId() {
  const proposals = listValidationCommandProposals();
  const adapter = findValidationCommandProposalById("vscodeAdapterSmoke");

  assert.ok(proposals.some((item) => item.id === "vscodeAdapterSmoke"));
  assert.equal(adapter.id, "vscodeAdapterSmoke");
  assert.equal(adapter.command.argv[0], "bash");
  assert.equal(adapter.command.argv[1], "scripts/vscode-adapter-smoke.sh");
  assert.equal(adapter.preflight.diagnosticsHandoff.status, "unavailable");
  assert.equal(findValidationCommandProposalById("bash scripts/vscode-adapter-smoke.sh"), null);
}

function testValidationDiagnosticsHandoffContextRejectsNonBundleShape() {
  const context = createValidationDiagnosticsHandoffContext({
    diagnosticsHandoffContext: {
      kind: "diagnostics-handoff-status-surface",
      readiness: { status: "available" },
    },
  });

  assert.equal(context.status, "unavailable");
  assert.ok(context.issueNotes.some((note) => /normalized context bundle/.test(note)));
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
testDiagnosticsHandoffAvailableContextImprovesProposalPreflight();
testDiagnosticsHandoffUnavailableContextIsExplicit();
testDiagnosticsHandoffInvalidContextIsExplicitAndSafe();
testRawHandoffJsonIsNotParsedByValidationProposalCode();
testValidationProposalsCanBeResolvedByStableId();
testValidationDiagnosticsHandoffContextRejectsNonBundleShape();
testPccxLabStatusIsStatusOnly();

console.log("vscode validation proposal and pccx-lab status tests ok");

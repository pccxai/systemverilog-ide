import assert from "node:assert/strict";

import {
  VALIDATION_PROPOSAL_PREFLIGHT_AUDIT_VERSION,
  createValidationProposalPreflightAudit,
  formatValidationProposalPreflightAudit,
} from "../src/validation-proposal-preflight-audit.mjs";
import {
  findValidationCommandProposalById,
} from "../src/validation-proposals.mjs";
import {
  buildContextBundle,
} from "../src/context-bundle.mjs";
import {
  cloneDefaultDiagnosticsHandoffConsumerSummary,
  createDiagnosticsHandoffStatusSurface,
} from "../src/diagnostics-handoff-status-surface.mjs";

function checkById(audit, id) {
  return audit.checks.find((check) => check.id === id);
}

function cloneProposal(id = "vscodeAdapterSmoke") {
  return JSON.parse(JSON.stringify(findValidationCommandProposalById(id)));
}

function assertAuditShape(audit) {
  assert.equal(audit.version, VALIDATION_PROPOSAL_PREFLIGHT_AUDIT_VERSION);
  assert.equal(audit.kind, "validation-proposal-preflight-audit");
  assert.equal(audit.execution, "auditOnly");
  assert.equal(audit.proposalOnly, true);
  assert.equal(audit.executes, false);
  assert.equal(audit.auditScope, "validation-proposal-to-approved-runner");
  assert.ok(audit.checks.length <= audit.bounds.maxCheckCount);
  assert.ok(audit.checks.every((check) => check.message.length <= audit.bounds.maxCheckMessageCharacters));
  assert.equal(audit.allowlist.broadened, false);
  assert.deepEqual(audit.allowlist.runnerProposalIds, [
    "vscodeAdapterSmoke",
    "editorBridgeSmoke",
    "exampleDriftCheck",
    "pytestBaseline",
  ]);
  assert.equal(audit.safety.auditOnly, true);
  assert.equal(audit.safety.dataOnly, true);
  assert.equal(audit.safety.readOnly, true);
  assert.equal(audit.safety.automaticExecution, false);
  assert.equal(audit.safety.allowlistBroadened, false);
  assert.equal(audit.safety.shellExecution, false);
  assert.equal(audit.safety.launcherExecution, false);
  assert.equal(audit.safety.pccxLabExecution, false);
  assert.equal(audit.safety.pccxLabValidatorInvocation, false);
  assert.equal(audit.safety.providerCalls, false);
  assert.equal(audit.safety.runtimeCalls, false);
  assert.equal(audit.safety.mcpCalls, false);
  assert.equal(audit.safety.lspImplemented, false);
  assert.equal(audit.safety.marketplaceFlow, false);
  assert.equal(audit.safety.telemetry, false);
  assert.equal(audit.safety.automaticUpload, false);
  assert.equal(audit.safety.writeBack, false);
}

function assertFailedCheck(audit, id) {
  assert.equal(audit.status, "failed");
  assert.equal(audit.eligibleForApprovedRunner, false);
  assert.equal(checkById(audit, id)?.status, "fail");
  assert.match(audit.blockedReason, new RegExp(id));
}

function testAllowedProposalAuditPasses() {
  const first = createValidationProposalPreflightAudit("vscodeAdapterSmoke");
  const second = createValidationProposalPreflightAudit({ proposalId: "vscodeAdapterSmoke" });
  const text = formatValidationProposalPreflightAudit(first);

  assertAuditShape(first);
  assert.deepEqual(first, second);
  assert.equal(first.proposalId, "vscodeAdapterSmoke");
  assert.equal(first.status, "passed");
  assert.equal(first.eligibleForApprovedRunner, true);
  assert.equal(first.blockedReason, "");
  assert.ok(first.checks.every((check) => check.status === "pass"));
  assert.equal(first.diagnosticsHandoff.status, "unavailable");
  assert.equal(first.diagnosticsHandoff.contextOnly, true);
  assert.equal(first.diagnosticsHandoff.executionInput, false);
  assert.match(text, /Validation Proposal Preflight Audit/);
  assert.match(text, /eligibleForApprovedRunner: yes/);
  assert.match(text, /execution: no command executed/);
  assert.doesNotMatch(text, /\/home\/|TOKEN=/);
}

function testUnknownProposalIdAuditFails() {
  const audit = createValidationProposalPreflightAudit("missingProposal");

  assertAuditShape(audit);
  assertFailedCheck(audit, "proposal-id-exists");
  assertFailedCheck(audit, "command-allowlist");
}

function testMalformedProposalAuditFails() {
  const audit = createValidationProposalPreflightAudit({
    id: "vscodeAdapterSmoke",
    command: "bash scripts/vscode-adapter-smoke.sh",
  });

  assertAuditShape(audit);
  assertFailedCheck(audit, "proposal-shape");
  assertFailedCheck(audit, "command-allowlist");
  assertFailedCheck(audit, "no-raw-shell");
}

function testDiagnosticsHandoffContextsRemainContextOnly() {
  const availableBundle = buildContextBundle({
    diagnosticsHandoffSummary: cloneDefaultDiagnosticsHandoffConsumerSummary(),
  });
  const unavailableBundle = buildContextBundle({});
  const unsafeSurface = createDiagnosticsHandoffStatusSurface(
    cloneDefaultDiagnosticsHandoffConsumerSummary(),
  );
  unsafeSurface.safety.pccxLabExecution = true;
  const invalidBundle = buildContextBundle({
    diagnosticsHandoffStatus: unsafeSurface,
  });
  const available = createValidationProposalPreflightAudit({
    proposalId: "vscodeAdapterSmoke",
    contextBundle: availableBundle,
  });
  const unavailable = createValidationProposalPreflightAudit({
    proposalId: "vscodeAdapterSmoke",
    contextBundle: unavailableBundle,
  });
  const invalid = createValidationProposalPreflightAudit({
    proposalId: "vscodeAdapterSmoke",
    contextBundle: invalidBundle,
  });

  for (const audit of [available, unavailable, invalid]) {
    assertAuditShape(audit);
    assert.equal(audit.status, "passed");
    assert.equal(checkById(audit, "diagnostics-handoff-context-only").status, "pass");
    assert.equal(audit.diagnosticsHandoff.contextOnly, true);
    assert.equal(audit.diagnosticsHandoff.executionInput, false);
    assert.equal(audit.findings.diagnosticsHandoffExecutionInput, false);
  }
  assert.equal(available.diagnosticsHandoff.status, "available");
  assert.equal(available.diagnosticsHandoff.summaryAvailable, true);
  assert.equal(unavailable.diagnosticsHandoff.status, "unavailable");
  assert.equal(unavailable.diagnosticsHandoff.summaryAvailable, false);
  assert.equal(invalid.diagnosticsHandoff.status, "invalid");
  assert.equal(invalid.diagnosticsHandoff.summaryAvailable, false);
}

function testLauncherExecutionIsBlocked() {
  const proposal = cloneProposal();
  proposal.command.argv = ["pccx-llm-launcher", "run"];

  const audit = createValidationProposalPreflightAudit({ proposal });

  assertAuditShape(audit);
  assertFailedCheck(audit, "command-allowlist");
  assertFailedCheck(audit, "no-launcher-command");
  assert.equal(audit.findings.launcherCommand, true);
}

function testPccxLabExecutionIsBlocked() {
  const proposal = cloneProposal();
  proposal.command.argv = ["pccx-lab", "diagnostics"];

  const audit = createValidationProposalPreflightAudit({ proposal });

  assertAuditShape(audit);
  assertFailedCheck(audit, "command-allowlist");
  assertFailedCheck(audit, "no-pccx-lab-command");
  assert.equal(audit.findings.pccxLabCommand, true);
}

function testPccxLabValidatorInvocationIsBlocked() {
  const proposal = cloneProposal();
  proposal.command.argv = ["pccx-lab", "diagnostics-handoff", "validate"];

  const audit = createValidationProposalPreflightAudit({ proposal });

  assertAuditShape(audit);
  assertFailedCheck(audit, "command-allowlist");
  assertFailedCheck(audit, "no-pccx-lab-command");
  assertFailedCheck(audit, "no-pccx-lab-validator");
  assert.equal(audit.findings.pccxLabValidatorInvocation, true);
}

function testShellExecutionPathIsBlocked() {
  const audit = createValidationProposalPreflightAudit({
    proposalId: "vscodeAdapterSmoke",
    command: "bash scripts/vscode-adapter-smoke.sh; rm -rf /",
  });

  assertAuditShape(audit);
  assertFailedCheck(audit, "no-raw-shell");
  assert.equal(audit.findings.rawShellString, true);
  assert.doesNotMatch(JSON.stringify(audit), /rm -rf/);
}

function testExecutionClaimWordingIsBlocked() {
  const proposal = cloneProposal();
  proposal.reason = "MCP runtime executes validation and KV260 provider integration works.";

  const audit = createValidationProposalPreflightAudit({ proposal });

  assertAuditShape(audit);
  assertFailedCheck(audit, "no-execution-claim-wording");
  assert.equal(audit.findings.executionClaimWording, true);
}

function testDiagnosticsHandoffExecutionInputIsBlocked() {
  const proposal = cloneProposal();
  proposal.command.env = {
    PCCX_DIAGNOSTICS_HANDOFF: "pccx.diagnosticsHandoff.v0",
  };

  const audit = createValidationProposalPreflightAudit({ proposal });

  assertAuditShape(audit);
  assertFailedCheck(audit, "command-allowlist");
  assertFailedCheck(audit, "diagnostics-handoff-context-only");
  assert.equal(audit.findings.diagnosticsHandoffExecutionInput, true);
}

testAllowedProposalAuditPasses();
testUnknownProposalIdAuditFails();
testMalformedProposalAuditFails();
testDiagnosticsHandoffContextsRemainContextOnly();
testLauncherExecutionIsBlocked();
testPccxLabExecutionIsBlocked();
testPccxLabValidatorInvocationIsBlocked();
testShellExecutionPathIsBlocked();
testExecutionClaimWordingIsBlocked();
testDiagnosticsHandoffExecutionInputIsBlocked();

console.log("vscode validation proposal preflight audit tests ok");

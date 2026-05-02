import assert from "node:assert/strict";

import {
  APPROVED_VALIDATION_RESULT_VERSION,
  resolveApprovedValidationProposalId,
  runApprovedValidationProposal,
} from "../src/approved-validation-runner.mjs";

const ENABLED_CONFIG = {
  validationRunner: {
    enabled: true,
    mode: "allowlisted",
    defaultWorkingDirectory: "repo-root",
    maxOutputLines: 2,
    timeoutMs: 5000,
  },
};

function fakeClock() {
  let value = Date.parse("2026-01-01T00:00:00.000Z");
  return {
    now() {
      value += 25;
      return value;
    },
  };
}

function execFileStub(callback) {
  const calls = [];
  return {
    calls,
    execFile(executable, args, options, done) {
      calls.push({ executable, args, options });
      callback(executable, args, options, done);
    },
  };
}

function testProposalIdResolutionAcceptsIdsOnly() {
  assert.equal(resolveApprovedValidationProposalId(null), null);
  assert.equal(resolveApprovedValidationProposalId("vscodeAdapterSmoke"), "vscodeAdapterSmoke");
  assert.equal(
    resolveApprovedValidationProposalId({ proposalId: "editorBridgeSmoke" }),
    "editorBridgeSmoke",
  );
  assert.equal(resolveApprovedValidationProposalId({ command: "bash scripts/a.sh" }), null);
}

async function testMissingProposalIdBlocksEvenWhenEnabled() {
  const stub = execFileStub(() => {
    throw new Error("missing proposal ID must not execute");
  });

  const result = await runApprovedValidationProposal(undefined, ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: stub.execFile,
    clock: fakeClock(),
  });

  assert.equal(result.status, "blocked");
  assert.match(result.blockedReason, /proposal ID only/);
  assert.equal(stub.calls.length, 0);
}

async function testDisabledByDefaultBlocksWithoutExecution() {
  const stub = execFileStub(() => {
    throw new Error("disabled runner must not execute");
  });

  const result = await runApprovedValidationProposal("vscodeAdapterSmoke", {}, {
    repoRoot: "/repo",
    execFile: stub.execFile,
    clock: fakeClock(),
  });

  assert.equal(result.version, APPROVED_VALIDATION_RESULT_VERSION);
  assert.equal(result.kind, "approved-validation-result");
  assert.equal(result.proposalId, "vscodeAdapterSmoke");
  assert.equal(result.commandLabel, "VS Code adapter smoke");
  assert.equal(result.status, "blocked");
  assert.match(result.blockedReason, /runner is disabled/);
  assert.equal(result.ok, false);
  assert.equal(result.safety.allowlisted, true);
  assert.equal(result.safety.shell, false);
  assert.equal(result.safety.userProvidedCommand, false);
  assert.equal(stub.calls.length, 0);
}

async function testUnknownAndRawCommandInputBlocks() {
  const stub = execFileStub(() => {
    throw new Error("unknown proposal must not execute");
  });

  const unknown = await runApprovedValidationProposal("missingProposalId", ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: stub.execFile,
    clock: fakeClock(),
  });
  const rawString = await runApprovedValidationProposal("git push origin main", ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: stub.execFile,
    clock: fakeClock(),
  });
  const rawObject = await runApprovedValidationProposal(
    { command: "bash scripts/vscode-adapter-smoke.sh" },
    ENABLED_CONFIG,
    {
      repoRoot: "/repo",
      execFile: stub.execFile,
      clock: fakeClock(),
    },
  );

  assert.equal(unknown.status, "blocked");
  assert.match(unknown.blockedReason, /unknown validation proposal ID/);
  assert.equal(rawString.status, "blocked");
  assert.match(rawString.blockedReason, /proposal ID only/);
  assert.doesNotMatch(JSON.stringify(rawString), /origin main/);
  assert.equal(rawObject.status, "blocked");
  assert.match(rawObject.blockedReason, /proposal ID only/);
  assert.equal(stub.calls.length, 0);
}

async function testAllowlistedExecutionUsesExecFileArgumentArray() {
  const stub = execFileStub((_executable, _args, _options, done) => {
    done(null, "adapter ok\nAPI_KEY=hidden\nthird line\n", "");
  });

  const result = await runApprovedValidationProposal("vscodeAdapterSmoke", ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: stub.execFile,
    env: { PATH: "/bin" },
    clock: fakeClock(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "passed");
  assert.equal(result.command, "bash");
  assert.deepEqual(result.args, ["scripts/vscode-adapter-smoke.sh"]);
  assert.equal(result.cwdKind, "repo-root");
  assert.equal(result.cwdLabel, "repo-root");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.stdoutSummary.lines, ["adapter ok", "[redacted]"]);
  assert.equal(result.stdoutSummary.truncated, true);
  assert.equal(result.resultSummary.proposalId, "vscodeAdapterSmoke");
  assert.equal(result.resultSummary.safety.fixedArgs, true);
  assert.equal(result.safety.allowlisted, true);
  assert.equal(result.safety.providerCalls, false);
  assert.equal(result.safety.launcherCalls, false);
  assert.equal(result.safety.mcpServerCalls, false);
  assert.equal(stub.calls.length, 1);
  assert.equal(stub.calls[0].executable, "bash");
  assert.deepEqual(stub.calls[0].args, ["scripts/vscode-adapter-smoke.sh"]);
  assert.equal(stub.calls[0].options.cwd, "/repo");
  assert.equal(stub.calls[0].options.shell, false);
  assert.equal(stub.calls[0].options.timeout, 5000);
}

async function testFailureTimeoutAndProposalOnlyBlocks() {
  const failingStub = execFileStub((_executable, _args, _options, done) => {
    const error = new Error("failed");
    error.code = 7;
    done(error, "", "failure: bad\n");
  });
  const timeoutStub = execFileStub((_executable, _args, _options, done) => {
    const error = new Error("timed out");
    error.killed = true;
    done(error, "", "");
  });

  const failed = await runApprovedValidationProposal("editorBridgeSmoke", ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: failingStub.execFile,
    clock: fakeClock(),
  });
  const timedOut = await runApprovedValidationProposal("pytestBaseline", ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: timeoutStub.execFile,
    clock: fakeClock(),
  });
  const blocked = await runApprovedValidationProposal("extensionHostSmokeOptIn", ENABLED_CONFIG, {
    repoRoot: "/repo",
    execFile: timeoutStub.execFile,
    clock: fakeClock(),
  });

  assert.equal(failed.status, "failed");
  assert.equal(failed.exitCode, 7);
  assert.deepEqual(failed.stderrSummary.lines, ["failure: bad"]);
  assert.equal(timedOut.status, "timedOut");
  assert.equal(timedOut.exitCode, null);
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.blockedReason, /Extension Host smoke remains opt-in/);
  assert.equal(timeoutStub.calls.length, 1);
}

testProposalIdResolutionAcceptsIdsOnly();
await testMissingProposalIdBlocksEvenWhenEnabled();
await testDisabledByDefaultBlocksWithoutExecution();
await testUnknownAndRawCommandInputBlocks();
await testAllowlistedExecutionUsesExecFileArgumentArray();
await testFailureTimeoutAndProposalOnlyBlocks();

console.log("vscode approved validation runner tests ok");

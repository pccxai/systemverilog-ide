import assert from "node:assert/strict";

import {
  VALIDATION_RESULT_SUMMARY_VERSION,
  createValidationResultSummary,
  summarizeOutputText,
} from "../src/validation-result-summary.mjs";

function testSummariesAreBoundedAndRedacted() {
  const summary = summarizeOutputText(
    [
      "API_KEY=abc123",
      "/home/dev/repo/rtl/top.sv:1: error: bad",
      "line 3",
      "line 4",
    ].join("\n"),
    { maxOutputLines: 2, maxLineCharacters: 80 },
  );

  assert.deepEqual(summary.lines, [
    "[redacted]",
    "[home]/repo/rtl/top.sv:1: error: bad",
  ]);
  assert.equal(summary.lineCount, 4);
  assert.equal(summary.truncated, true);
}

function testValidationResultSummaryShape() {
  const result = createValidationResultSummary(
    {
      proposalId: "vscodeAdapterSmoke",
      commandLabel: "VS Code adapter smoke",
      status: "failed",
      exitCode: 1,
      durationMs: 42,
      command: "bash",
      args: ["scripts/vscode-adapter-smoke.sh"],
      cwdKind: "repo-root",
      cwdLabel: "repo-root",
      stdout: "ok\n",
      stderr: "test failed\nTOKEN=hidden\n",
      safety: {
        allowlisted: true,
        shell: false,
        fixedArgs: true,
        userProvidedCommand: false,
        writesFiles: false,
        providerCalls: false,
        launcherCalls: false,
        mcpServerCalls: false,
      },
    },
    { maxOutputLines: 2 },
  );

  assert.equal(result.version, VALIDATION_RESULT_SUMMARY_VERSION);
  assert.equal(result.proposalId, "vscodeAdapterSmoke");
  assert.equal(result.commandLabel, "VS Code adapter smoke");
  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.stderrSummary.lines, ["test failed", "[redacted]"]);
  assert.deepEqual(result.failureHints, ["test failed"]);
  assert.equal(result.safety.allowlisted, true);
  assert.equal(result.safety.shell, false);
  assert.equal(result.safety.userProvidedCommand, false);
}

testSummariesAreBoundedAndRedacted();
testValidationResultSummaryShape();

console.log("vscode validation result summary tests ok");

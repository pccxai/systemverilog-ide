import assert from "node:assert/strict";

import {
  VALIDATION_RESULT_CACHE_ENTRY_VERSION,
  createValidationResultCache,
  createValidationResultCacheEntry,
} from "../src/validation-result-cache.mjs";

function summary(proposalId, options = {}) {
  return {
    version: "pccx.validationResultSummary.v0",
    proposalId,
    commandLabel: options.commandLabel ?? `Validation ${proposalId}`,
    status: options.status ?? "passed",
    summary: options.summary ?? `Validation ${proposalId} passed`,
    exitCode: options.exitCode ?? 0,
    durationMs: options.durationMs ?? 25,
    startedAt: options.startedAt ?? "2026-01-01T00:00:00.000Z",
    finishedAt: options.finishedAt ?? "2026-01-01T00:00:00.025Z",
    command: "bash",
    args: ["scripts/vscode-adapter-smoke.sh"],
    cwdKind: options.cwdKind ?? "repo-root",
    stdoutSummary: options.stdoutSummary ?? {
      lines: ["ok"],
      lineCount: 1,
      truncated: false,
    },
    stderrSummary: options.stderrSummary ?? {
      lines: [],
      lineCount: 0,
      truncated: false,
    },
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
  };
}

function testCacheKeepsNewestFirstWithinMaxSize() {
  const cache = createValidationResultCache({ maxSize: 3 });

  cache.add(summary("one"));
  cache.add(summary("two"));
  cache.add(summary("three"));
  cache.add(summary("four"));

  assert.deepEqual(
    cache.list().map((entry) => entry.proposalId),
    ["four", "three", "two"],
  );
  assert.equal(cache.latest().proposalId, "four");
  assert.equal(cache.size(), 3);
}

function testCacheEntriesAreSummaryOnlyRedactedAndBounded() {
  const entry = createValidationResultCacheEntry(
    summary("vscodeAdapterSmoke", {
      stdoutSummary: {
        lines: [
          "adapter ok",
          "TOKEN=hidden",
          "/home/dev/repo/rtl/top.sv:1: note",
          "tail",
        ],
        lineCount: 4,
        truncated: false,
      },
      stderrSummary: {
        lines: ["/Users/dev/project/error.sv:2: error"],
        lineCount: 1,
        truncated: false,
      },
    }),
    { maxOutputLines: 2 },
  );
  const serialized = JSON.stringify(entry);

  assert.equal(entry.version, VALIDATION_RESULT_CACHE_ENTRY_VERSION);
  assert.equal(entry.proposalId, "vscodeAdapterSmoke");
  assert.equal(entry.label, "Validation vscodeAdapterSmoke");
  assert.equal(entry.workingDirectoryKind, "repo-root");
  assert.equal(entry.commandKind, "allowlisted-validation-proposal");
  assert.deepEqual(entry.stdoutSummary.lines, ["adapter ok", "[redacted]"]);
  assert.deepEqual(entry.stderrSummary.lines, ["[home]/project/error.sv:2: error"]);
  assert.equal(entry.stdoutSummary.truncated, true);
  assert.equal(entry.truncated, true);
  assert.equal(entry.redactionApplied, true);
  assert.equal(Object.hasOwn(entry, "command"), false);
  assert.equal(Object.hasOwn(entry, "args"), false);
  assert.doesNotMatch(serialized, /TOKEN=hidden/);
  assert.doesNotMatch(serialized, /\/home\/dev/);
  assert.doesNotMatch(serialized, /\/Users\/dev/);
  assert.doesNotMatch(serialized, /scripts\/vscode-adapter-smoke\.sh/);
}

function testCacheClearReturnsCountAndEmptiesEntries() {
  const cache = createValidationResultCache({ maxSize: 2 });

  cache.add(summary("one"));
  cache.add(summary("two"));

  assert.equal(cache.clear(), 2);
  assert.deepEqual(cache.list(), []);
  assert.equal(cache.latest(), null);
  assert.equal(cache.size(), 0);
}

testCacheKeepsNewestFirstWithinMaxSize();
testCacheEntriesAreSummaryOnlyRedactedAndBounded();
testCacheClearReturnsCountAndEmptiesEntries();

console.log("vscode validation result cache tests ok");

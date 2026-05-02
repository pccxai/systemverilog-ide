import assert from "node:assert/strict";

import {
  CONTEXT_BUNDLE_AUDIT_VERSION,
  createContextBundleAudit,
  formatContextBundleAudit,
} from "../src/context-bundle-audit.mjs";
import {
  buildContextBundle,
} from "../src/context-bundle.mjs";

function testAuditCountsBoundedContextShape() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/top.sv",
      selectedSymbolContext: {
        version: "pccx.selectedSymbolContext.v0",
        path: "/repo/rtl/top.sv",
        symbolText: "top",
      },
      activeDiagnostics: [
        { file: "/repo/rtl/top.sv", message: "TOKEN=hidden" },
      ],
      files: [
        { path: "/repo/rtl/top.sv", text: "module top;\nendmodule\n" },
      ],
      recentValidationHistory: [
        {
          proposalId: "vscodeAdapterSmoke",
          status: "failed",
          stdoutSummary: { lines: ["ok"], lineCount: 1, truncated: false },
          stderrSummary: { lines: ["failure"], lineCount: 1, truncated: false },
        },
      ],
      pccxLabOutputs: [
        { label: "fixture", summaryLines: ["TOKEN=hidden"] },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: { maxSnippetLines: 1 },
    },
  );
  const audit = createContextBundleAudit(bundle);
  const text = formatContextBundleAudit(audit);

  assert.equal(audit.version, CONTEXT_BUNDLE_AUDIT_VERSION);
  assert.equal(audit.contextBundleVersion, "pccx.contextBundle.v0");
  assert.ok(audit.approximateCharacterCount > 0);
  assert.equal(audit.diagnosticCount, 1);
  assert.equal(audit.selectedSymbolSnippetCount, 1);
  assert.equal(audit.snippetCount, 1);
  assert.equal(audit.validationSummaryCount, 1);
  assert.equal(audit.launcherStatusEntryCount, 0);
  assert.equal(audit.labStatusEntryCount, 1);
  assert.equal(audit.redactionApplied, true);
  assert.equal(audit.truncationApplied, true);
  assert.ok(audit.excludedCategories.includes("node_modules"));
  assert.ok(audit.excludedCategories.includes("node_modules/**"));
  assert.equal(audit.safety.fullLogsExcluded, true);
  assert.equal(audit.safety.providerCalls, false);
  assert.match(text, /Context Bundle Audit/);
  assert.match(text, /validationSummaries: 1/);
  assert.doesNotMatch(JSON.stringify(audit), /TOKEN=hidden|\/repo/);
}

function testEmptyAuditIsDeterministicAndSafe() {
  const audit = createContextBundleAudit({});

  assert.equal(audit.diagnosticCount, 0);
  assert.equal(audit.snippetCount, 0);
  assert.equal(audit.validationSummaryCount, 0);
  assert.equal(audit.redactionApplied, false);
  assert.equal(audit.truncationApplied, false);
  assert.deepEqual(audit.excludedCategories, []);
  assert.equal(audit.safety.networkCalls, false);
  assert.equal(audit.safety.mcpCalls, false);
}

testAuditCountsBoundedContextShape();
testEmptyAuditIsDeterministicAndSafe();

console.log("vscode context bundle audit tests ok");

import assert from "node:assert/strict";

import {
  CONTEXT_BUNDLE_VERSION,
  buildContextBundle,
  summarizeContextBundle,
} from "../src/context-bundle.mjs";

const SECRET_KEY_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;

function assertNoSecretLikeKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoSecretLikeKeys(item);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(key, SECRET_KEY_PATTERN);
    assertNoSecretLikeKeys(child);
  }
}

function fixtureInput() {
  return {
    workspaceRoot: "/repo",
    selectedFilePath: "/repo/rtl/top.sv",
    selectedRange: {
      start: { line: 10, character: 2 },
      end: { line: 12, character: 8 },
    },
    selectedSymbol: {
      name: "top",
      kind: "module",
      path: "/repo/rtl/top.sv",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 3 },
      },
    },
    selectedSymbolContext: {
      version: "pccx.selectedSymbolContext.v0",
      path: "/repo/rtl/top.sv",
      language: "systemverilog",
      symbolText: "top",
      lexicalKind: "module",
      range: {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 3 },
      },
      cursor: { line: 10, character: 1 },
      currentLine: {
        number: 11,
        text: "module top;",
        truncated: false,
      },
      selectionSummary: {
        lineCount: 1,
        characterCount: 3,
        previewLines: ["top"],
        truncated: false,
      },
      enclosingDeclaration: {
        name: "top",
        kind: "module",
        path: "/repo/rtl/top.sv",
        line: 11,
        column: 1,
        range: {
          start: { line: 10, character: 0 },
          end: { line: 10, character: 3 },
        },
      },
      relatedNavigation: [
        { name: "top", kind: "module", file: "/repo/rtl/top.sv", line: 11, column: 1 },
      ],
      nearbyDiagnostics: [
        { file: "/repo/rtl/top.sv", message: "near selected symbol" },
      ],
      analysis: {
        kind: "lexical",
        semanticResolution: false,
      },
    },
    activeDiagnostics: [
      {
        file: "/repo/rtl/z.sv",
        severity: "Warning",
        message: "late declaration",
        range: {
          start: { line: 4, character: 1 },
          end: { line: 4, character: 5 },
        },
      },
      {
        file: "/repo/rtl/a.sv",
        severity: "Error",
        message: "missing endmodule",
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 6 },
        },
      },
    ],
    symbolContext: {
      declarations: [
        { name: "z_mod", kind: "module", file: "/repo/rtl/z.sv", line: 5, column: 1 },
        { name: "a_mod", kind: "module", file: "/repo/rtl/a.sv", line: 1, column: 1 },
      ],
    },
    files: [
      {
        path: "/repo/rtl/z.sv",
        text: "module z_mod;\nendmodule\n",
      },
      {
        path: "/repo/rtl/a.sv",
        text: "module a_mod;\nAPI_KEY=abc123\nendmodule\n",
      },
      {
        path: "/repo/node_modules/pkg/ignored.sv",
        text: "module ignored;\nendmodule\n",
      },
      {
        path: "/repo/.vscode-test/cache/ignored.sv",
        text: "module cache_ignored;\nendmodule\n",
      },
      {
        path: "/repo/rtl/binary.sv",
        text: "module bad;\0endmodule\n",
      },
      {
        path: "/repo/.codex/private-worker/notes.md",
        text: "private worker instruction\n",
      },
      {
        path: "/repo/AGENTS.md",
        text: "private worker instruction\n",
      },
      {
        path: "/repo/package-lock.json",
        text: "{\"packages\":{}}\n",
      },
    ],
    configuration: {
      mode: "checkedExample",
      liveWorkspace: { enabled: false },
      aiAssistant: { enabled: false, backend: "none" },
      pccxLab: { commandBoundary: "pccx_ide_cli" },
      validationRunner: {
        enabled: false,
        mode: "disabled",
        defaultWorkingDirectory: "repo-root",
        maxOutputLines: 120,
        timeoutMs: 30000,
      },
    },
    recentCommandStatus: {
      commandId: "pccxSystemVerilog.publishCheckedExampleDiagnostics",
      ok: true,
      actionKind: "diagnostics",
      summary: "1 diagnostic(s)",
      facade: { command: "diagnostics", mode: "example" },
      diagnosticCount: 1,
      navigationItemCount: 0,
    },
    recentValidation: {
      version: "pccx.validationResultSummary.v0",
      proposalId: "vscodeAdapterSmoke",
      commandLabel: "VS Code adapter smoke",
      status: "failed",
      summary: "VS Code adapter smoke failed (exit 1)",
      exitCode: 1,
      durationMs: 55,
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:00.055Z",
      command: "bash",
      args: ["scripts/vscode-adapter-smoke.sh"],
      cwdKind: "repo-root",
      cwdLabel: "repo-root",
      stdoutSummary: {
        lines: ["adapter ok", "API_KEY=abc123", "extra"],
        lineCount: 3,
        truncated: true,
      },
      stderrSummary: {
        lines: ["failure: missing endmodule"],
        lineCount: 1,
        truncated: false,
      },
      failureHints: ["failure: missing endmodule"],
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
    pccxLabOutputs: [
      {
        flow: "problems from-check",
        exitCode: 1,
        summaryLines: ["token=hidden", "missing endmodule"],
      },
    ],
    userIntent: "explain active diagnostics",
  };
}

function testStableBoundedShape() {
  const bundle = buildContextBundle(fixtureInput(), {
    workspaceRoot: "/repo",
    limits: {
      maxFiles: 2,
      maxDiagnostics: 1,
      maxSnippetLines: 2,
      maxLogSummaryLines: 1,
    },
  });

  assert.equal(bundle.version, CONTEXT_BUNDLE_VERSION);
  assert.equal(bundle.source, "pccx-systemverilog-ide");
  assert.equal(bundle.configuration.mode, "checkedExample");
  assert.equal(bundle.configuration.aiAssistant.backend, "none");
  assert.deepEqual(bundle.selectedFile, { path: "rtl/top.sv" });
  assert.deepEqual(Object.keys(bundle.symbols.selected), ["name", "kind", "path", "range"]);
  assert.equal(bundle.symbols.selected.name, "top");
  assert.equal(bundle.symbols.selected.kind, "module");
  assert.equal(bundle.symbols.selected.path, "rtl/top.sv");
  assert.equal(bundle.symbols.selectedContext.symbolText, "top");
  assert.equal(bundle.symbols.selectedContext.lexicalKind, "module");
  assert.equal(bundle.symbols.selectedContext.analysis.semanticResolution, false);
  assert.equal(bundle.symbols.selectedContext.relatedNavigation.length, 1);
  assert.equal(bundle.symbols.selectedContext.nearbyDiagnostics.length, 1);
  assert.equal(bundle.diagnostics.length, 1);
  assert.equal(bundle.diagnostics[0].path, "rtl/a.sv");
  assert.equal(bundle.snippets.length, 2);
  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/a.sv", "rtl/z.sv"]);
  assert.ok(bundle.snippets.every((snippet) => snippet.lines.length <= 2));
  assert.equal(bundle.validation.recent.status, "failed");
  assert.equal(bundle.validation.recent.proposalId, "vscodeAdapterSmoke");
  assert.equal(bundle.validation.recent.commandLabel, "VS Code adapter smoke");
  assert.equal(bundle.validation.recent.stdoutSummary.lines.length, 1);
  assert.deepEqual(bundle.validation.recent.stdoutSummary.lines, ["adapter ok"]);
  assert.deepEqual(bundle.validation.recent.stderrSummary.lines, ["failure: missing endmodule"]);
  assert.equal(bundle.validation.recent.safety.allowlisted, true);
  assert.equal(bundle.validation.recent.safety.shell, false);
  assert.equal(bundle.recentCommand.commandId, "pccxSystemVerilog.publishCheckedExampleDiagnostics");
  assert.equal(bundle.recentCommand.facade.mode, "example");
  assert.equal(bundle.pccxLab.outputs.length, 1);
  assert.deepEqual(bundle.pccxLab.outputs[0].lines, ["[redacted]"]);
  assert.ok(bundle.excludedPathPatterns.includes("agent-instruction-files"));
  assert.equal(bundle.redaction.assignmentPolicy, "secret-like-lines-redacted");
  assert.deepEqual(summarizeContextBundle(bundle), {
    version: CONTEXT_BUNDLE_VERSION,
    selectedFile: { path: "rtl/top.sv" },
    selectedSymbol: {
      name: "top",
      kind: "module",
      path: "rtl/top.sv",
    },
    diagnosticCount: 1,
    snippetCount: 2,
    declarationCount: 2,
    pccxLabOutputCount: 1,
    validation: {
      proposalId: "vscodeAdapterSmoke",
      status: "failed",
      commandLabel: "VS Code adapter smoke",
    },
  });
}

function testDeterministicOrdering() {
  const input = fixtureInput();
  const reversed = {
    ...input,
    activeDiagnostics: [...input.activeDiagnostics].reverse(),
    files: [...input.files].reverse(),
    symbolContext: {
      declarations: [...input.symbolContext.declarations].reverse(),
    },
  };

  assert.deepEqual(
    buildContextBundle(input, { workspaceRoot: "/repo" }),
    buildContextBundle(reversed, { workspaceRoot: "/repo" }),
  );
}

function testSelectedFileSnippetAndDiagnosticsArePrioritized() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/z_selected.sv",
      selectedRange: {
        start: { line: 7, character: 0 },
        end: { line: 9, character: 0 },
      },
      files: [
        { path: "/repo/rtl/a_first.sv", text: "module a_first;\nendmodule\n" },
        { path: "/repo/rtl/z_selected.sv", text: "module z_selected;\nendmodule\n" },
      ],
      activeDiagnostics: [
        {
          file: "/repo/rtl/a_first.sv",
          message: "unrelated",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
        },
        {
          file: "/repo/rtl/z_selected.sv",
          message: "selected range diagnostic",
          range: {
            start: { line: 8, character: 0 },
            end: { line: 8, character: 1 },
          },
        },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: {
        maxFiles: 1,
        maxDiagnostics: 1,
      },
    },
  );

  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/z_selected.sv"]);
  assert.deepEqual(bundle.diagnostics.map((diagnostic) => diagnostic.path), ["rtl/z_selected.sv"]);
  assert.equal(bundle.diagnostics[0].message, "selected range diagnostic");
}

function testInvalidSelectedSymbolAndRangesAreControlled() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/top.sv",
      selectedRange: {
        start: { line: 5, character: 10 },
        end: { line: 4, character: 1 },
      },
      selectedSymbol: {
        name: "ignored",
        kind: "module",
        path: "/repo/node_modules/pkg/ignored.sv",
      },
    },
    { workspaceRoot: "/repo" },
  );

  assert.deepEqual(bundle.selectedRange, {
    start: { line: 5, character: 10 },
    end: { line: 5, character: 10 },
  });
  assert.equal(bundle.symbols.selected, null);
}

function testLongSingleLineSnippetReportsTruncation() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      selectedFilePath: "/repo/rtl/top.sv",
      files: [
        { path: "/repo/rtl/top.sv", text: "module top; " + "x".repeat(200) },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: {
        maxTextCharacters: 24,
        maxSnippetLines: 10,
      },
    },
  );

  assert.equal(bundle.snippets.length, 1);
  assert.equal(bundle.snippets[0].truncated, true);
  assert.ok(bundle.snippets[0].lines[0].length <= 24);
}

function testNoHugeFileOrRestrictedPathInclusion() {
  const hugeText = Array.from({ length: 100 }, (_, index) => `line ${index}`).join("\n");
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      files: [
        { path: "/repo/rtl/huge.sv", text: hugeText },
        { path: "/repo/node_modules/pkg/ignored.sv", text: hugeText },
        { path: "/repo/.vscode-test/ignored.sv", text: hugeText },
        { path: "/repo/AGENTS.md", text: hugeText },
        { path: "/repo/package-lock.json", text: hugeText },
        { path: "/repo/.git/config", text: hugeText },
        { path: "/repo/.codex/notes.md", text: hugeText },
        { path: "/repo/private-worker/notes.md", text: hugeText },
        { path: "/repo/worker-instruction/notes.md", text: hugeText },
        { path: "/repo/subagent-instruction/notes.md", text: hugeText },
        { path: "/repo/rtl/api-token.sv", text: hugeText },
      ],
      activeDiagnostics: [
        { file: "/repo/node_modules/pkg/ignored.sv", message: "ignored" },
        { file: "/repo/.vscode-test/ignored.sv", message: "ignored" },
        { file: "/repo/rtl/client_secret.sv", message: "ignored" },
      ],
    },
    {
      workspaceRoot: "/repo",
      limits: { maxSnippetLines: 5 },
    },
  );

  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/huge.sv"]);
  assert.equal(bundle.snippets[0].lines.length, 5);
  assert.equal(bundle.snippets[0].truncated, true);
  assert.deepEqual(bundle.diagnostics, []);
}

function testNoSecretValuesOrSecretLikeKeys() {
  const bundle = buildContextBundle(fixtureInput(), { workspaceRoot: "/repo" });
  const serialized = JSON.stringify(bundle);

  assertNoSecretLikeKeys(bundle);
  assert.doesNotMatch(serialized, /abc123/);
  assert.doesNotMatch(serialized, /API_KEY=/);
  assert.doesNotMatch(serialized, /token=hidden/);
  assert.doesNotMatch(serialized, /API_KEY=abc123/);
  assert.doesNotMatch(serialized, /AGENTS\.md/);
  assert.doesNotMatch(serialized, /package-lock\.json/);
}

function testNoAbsoluteHomePathLeakage() {
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/home/dev/work/repo",
      selectedFilePath: "/home/dev/work/repo/rtl/top.sv",
      files: [
        { path: "/home/dev/work/repo/rtl/top.sv", text: "module top;\nendmodule\n" },
        { path: "/home/dev/.ssh/config", text: "Host example\n" },
      ],
      activeDiagnostics: [
        { file: "/home/dev/work/repo/rtl/top.sv", message: "inside" },
        { file: "/home/dev/outside.sv", message: "outside" },
      ],
    },
    { workspaceRoot: "/home/dev/work/repo" },
  );
  const serialized = JSON.stringify(bundle);

  assert.deepEqual(bundle.selectedFile, { path: "rtl/top.sv" });
  assert.equal(bundle.snippets.length, 1);
  assert.equal(bundle.diagnostics.length, 1);
  assert.doesNotMatch(serialized, /\/home\/dev/);
  assert.doesNotMatch(serialized, /\.ssh/);
}

function testNoActiveEditorContextShape() {
  const bundle = buildContextBundle({}, {});

  assert.equal(bundle.selectedFile, null);
  assert.equal(bundle.selectedRange, null);
  assert.deepEqual(bundle.diagnostics, []);
  assert.deepEqual(bundle.snippets, []);
  assert.equal(bundle.recentCommand, null);
  assert.equal(bundle.configuration.mode, "unknown");
}

testStableBoundedShape();
testDeterministicOrdering();
testSelectedFileSnippetAndDiagnosticsArePrioritized();
testInvalidSelectedSymbolAndRangesAreControlled();
testLongSingleLineSnippetReportsTruncation();
testNoHugeFileOrRestrictedPathInclusion();
testNoSecretValuesOrSecretLikeKeys();
testNoAbsoluteHomePathLeakage();
testNoActiveEditorContextShape();

console.log("vscode context bundle tests ok");

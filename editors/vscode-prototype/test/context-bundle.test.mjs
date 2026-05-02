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
    ],
    recentValidation: {
      status: "failed",
      summary: "1 diagnostic",
      exitCode: 1,
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
  assert.deepEqual(bundle.selectedFile, { path: "rtl/top.sv" });
  assert.equal(bundle.diagnostics.length, 1);
  assert.equal(bundle.diagnostics[0].path, "rtl/a.sv");
  assert.equal(bundle.snippets.length, 2);
  assert.deepEqual(bundle.snippets.map((snippet) => snippet.path), ["rtl/a.sv", "rtl/z.sv"]);
  assert.ok(bundle.snippets.every((snippet) => snippet.lines.length <= 2));
  assert.equal(bundle.validation.recent.status, "failed");
  assert.equal(bundle.pccxLab.outputs.length, 1);
  assert.deepEqual(bundle.pccxLab.outputs[0].lines, ["[redacted]"]);
  assert.deepEqual(summarizeContextBundle(bundle), {
    version: CONTEXT_BUNDLE_VERSION,
    selectedFile: { path: "rtl/top.sv" },
    diagnosticCount: 1,
    snippetCount: 2,
    declarationCount: 2,
    pccxLabOutputCount: 1,
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

function testNoHugeFileOrRestrictedPathInclusion() {
  const hugeText = Array.from({ length: 100 }, (_, index) => `line ${index}`).join("\n");
  const bundle = buildContextBundle(
    {
      workspaceRoot: "/repo",
      files: [
        { path: "/repo/rtl/huge.sv", text: hugeText },
        { path: "/repo/node_modules/pkg/ignored.sv", text: hugeText },
        { path: "/repo/.vscode-test/ignored.sv", text: hugeText },
      ],
      activeDiagnostics: [
        { file: "/repo/node_modules/pkg/ignored.sv", message: "ignored" },
        { file: "/repo/.vscode-test/ignored.sv", message: "ignored" },
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
}

testStableBoundedShape();
testDeterministicOrdering();
testNoHugeFileOrRestrictedPathInclusion();
testNoSecretValuesOrSecretLikeKeys();

console.log("vscode context bundle tests ok");

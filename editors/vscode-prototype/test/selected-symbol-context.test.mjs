import assert from "node:assert/strict";

import {
  SELECTED_SYMBOL_CONTEXT_VERSION,
  buildSelectedSymbolContext,
} from "../src/selected-symbol-context.mjs";

function testLexicalModuleSymbolContext() {
  const context = buildSelectedSymbolContext({
    workspaceRoot: "/repo",
    path: "/repo/rtl/top.sv",
    language: "systemverilog",
    selectionRange: {
      start: { line: 0, character: 7 },
      end: { line: 0, character: 15 },
    },
    cursorPosition: { line: 0, character: 10 },
    selectionText: "live_top",
    lines: [
      { line: 0, text: "module live_top;" },
      { line: 1, text: "endmodule" },
    ],
    diagnostics: [
      {
        file: "/repo/rtl/top.sv",
        message: "near selection",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 },
        },
      },
    ],
    navigationItems: [
      { file: "/repo/rtl/top.sv", name: "live_top", kind: "module", line: 1, column: 8 },
      { file: "/repo/rtl/other.sv", name: "other", kind: "module", line: 1, column: 8 },
    ],
  }, { workspaceRoot: "/repo" });

  assert.equal(context.version, SELECTED_SYMBOL_CONTEXT_VERSION);
  assert.equal(context.path, "rtl/top.sv");
  assert.equal(context.symbolText, "live_top");
  assert.equal(context.lexicalKind, "module");
  assert.equal(context.range.start.line, 0);
  assert.equal(context.range.start.character, 7);
  assert.equal(context.currentLine.number, 1);
  assert.equal(context.currentLine.text, "module live_top;");
  assert.equal(context.enclosingDeclaration.kind, "module");
  assert.equal(context.enclosingDeclaration.name, "live_top");
  assert.equal(context.relatedNavigation.length, 1);
  assert.equal(context.relatedNavigation[0].path, "rtl/top.sv");
  assert.equal(context.nearbyDiagnostics.length, 1);
  assert.equal(context.analysis.kind, "lexical");
  assert.equal(context.analysis.semanticResolution, false);
}

function testCursorTokenFallbackAndBounds() {
  const context = buildSelectedSymbolContext({
    workspaceRoot: "/repo",
    path: "/repo/rtl/pkg.sv",
    selectionRange: {
      start: { line: 1, character: 12 },
      end: { line: 1, character: 12 },
    },
    cursorPosition: { line: 1, character: 14 },
    lines: [
      { line: 0, text: "package pkg_defs;" },
      { line: 1, text: "  parameter WIDTH = 8;" },
      { line: 2, text: "endpackage" },
    ],
  }, {
    workspaceRoot: "/repo",
    limits: {
      maxLineCharacters: 12,
    },
  });

  assert.equal(context.symbolText, "WIDTH");
  assert.equal(context.lexicalKind, "parameter");
  assert.equal(context.currentLine.text.length <= 12, true);
  assert.equal(context.currentLine.truncated, true);
  assert.equal(context.selectionSummary, null);
}

function testRestrictedPathsAndSecretLinesAreControlled() {
  assert.equal(
    buildSelectedSymbolContext({
      workspaceRoot: "/repo",
      path: "/repo/AGENTS.md",
      lines: ["module ignored;"],
    }, { workspaceRoot: "/repo" }),
    null,
  );
  const context = buildSelectedSymbolContext({
    workspaceRoot: "/repo",
    path: "/repo/rtl/top.sv",
    cursorPosition: { line: 0, character: 10 },
    lines: [
      { line: 0, text: "localparam API_KEY = 1;" },
    ],
    selectionText: "API_KEY = 1",
    selectionRange: {
      start: { line: 0, character: 11 },
      end: { line: 0, character: 22 },
    },
  }, { workspaceRoot: "/repo" });
  const serialized = JSON.stringify(context);

  assert.equal(context.symbolText, "[redacted]");
  assert.equal(context.currentLine.text, "[redacted]");
  assert.deepEqual(context.selectionSummary.previewLines, ["[redacted]"]);
  assert.doesNotMatch(serialized, /API_KEY/);
  assert.doesNotMatch(serialized, /\/repo/);
}

testLexicalModuleSymbolContext();
testCursorTokenFallbackAndBounds();
testRestrictedPathsAndSecretLinesAreControlled();

console.log("vscode selected-symbol context tests ok");

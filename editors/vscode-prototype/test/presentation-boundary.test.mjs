import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertThemeNeutralPresentation,
  THEME_TOKEN_CONTRACT,
} from "../src/presentation-boundary.mjs";
import {
  createDiagnosticsPresentation,
  createNavigationPresentation,
} from "../src/presenter.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PRESENTATION_FILES = [
  "editors/vscode-prototype/src/presentation-boundary.mjs",
  "editors/vscode-prototype/src/presenter.mjs",
  "editors/vscode-prototype/src/command-handlers.mjs",
];
const HARDCODED_COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;

function diagnosticsAction(diagnostics) {
  return {
    kind: "diagnostics",
    diagnostics,
    summary: `${diagnostics.length} diagnostic(s)`,
  };
}

function navigationAction(items) {
  return {
    kind: "navigation",
    items,
    summary: `${items.length} navigation item(s)`,
  };
}

function testThemeTokenContractScope() {
  assert.equal(THEME_TOKEN_CONTRACT.currentPolicy, "host-theme-first");
  assert.deepEqual(THEME_TOKEN_CONTRACT.tokenSources, [
    "host-theme-token",
    "user-override-token",
  ]);
  assert.deepEqual(THEME_TOKEN_CONTRACT.futurePresentationPresets, [
    "VS Code",
    "Xcode",
    "JetBrains",
  ]);
  assert.equal(THEME_TOKEN_CONTRACT.completedCustomThemeSystem, false);
}

function testDiagnosticsPresentationIsThemeNeutral() {
  const presentation = createDiagnosticsPresentation(diagnosticsAction([
    {
      file: "fixtures/missing_endmodule.sv",
      message: "`module` declared but no matching `endmodule` found",
      severity: "Error",
      source: "check",
    },
  ]));

  assert.equal(assertThemeNeutralPresentation(presentation), presentation);
}

function testNavigationPresentationIsThemeNeutral() {
  const presentation = createNavigationPresentation(navigationAction([
    {
      name: "simple_mod",
      kind: "module",
      file: "fixtures/modules/simple_module.sv",
      line: 1,
      column: 1,
    },
  ]));

  assert.equal(assertThemeNeutralPresentation(presentation), presentation);
}

function testStyleFieldsRejected() {
  assert.throws(
    () => assertThemeNeutralPresentation({
      kind: "diagnostics-presentation",
      files: [{ file: "a.sv", diagnostics: [{ message: "bad", color: "red" }] }],
      summary: "1 diagnostic(s)",
    }),
    /theme-neutral presentation record must not define/,
  );
}

async function testPresentationFilesDoNotHardcodeColorLiterals() {
  for (const relativePath of PRESENTATION_FILES) {
    const source = await readFile(resolve(ROOT, relativePath), "utf8");
    assert.doesNotMatch(source, HARDCODED_COLOR_LITERAL, relativePath);
  }
}

testThemeTokenContractScope();
testDiagnosticsPresentationIsThemeNeutral();
testNavigationPresentationIsThemeNeutral();
testStyleFieldsRejected();
await testPresentationFilesDoNotHardcodeColorLiterals();

console.log("vscode presentation boundary tests ok");

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  declarationToNavigationItem,
  declarationsPayloadToNavigationItems,
  locatePayloadToNavigationItems,
  problemsPayloadToDiagnostics,
  readJsonPayload,
  severityToVsCode,
} from "../src/adapter.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXAMPLES = resolve(ROOT, "docs/examples/editor-bridge");

async function example(name) {
  return readJsonPayload(resolve(EXAMPLES, name));
}

async function testDiagnosticsFromProblems() {
  const payload = await example("problems-check-missing-endmodule.example.json");
  const diagnostics = problemsPayloadToDiagnostics(payload);

  assert.equal(diagnostics.length, 1);
  assert.deepEqual(diagnostics[0], {
    file: "fixtures/missing_endmodule.sv",
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    },
    severity: "Error",
    message: "`module` declared but no matching `endmodule` found",
    source: "check",
    code: "PCCX-SCAFFOLD-003",
  });
}

async function testDiagnosticsFromXsimLog() {
  const payload = await example("problems-xsim-mixed.example.json");
  const diagnostics = problemsPayloadToDiagnostics(payload);

  assert.equal(diagnostics.length, 5);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.severity),
    ["Error", "Information", "Warning", "Error", "Warning"],
  );

  const fileDiagnostic = diagnostics.find((diagnostic) => diagnostic.file === "src/warn.sv");
  assert.ok(fileDiagnostic);
  assert.equal(fileDiagnostic.range.start.line, 6);
  assert.equal(fileDiagnostic.range.start.character, 4);
  assert.equal(fileDiagnostic.code, undefined);

  const noLocationDiagnostic = diagnostics[0];
  assert.equal(noLocationDiagnostic.file, "fixtures/xsim/mixed.log");
  assert.equal(noLocationDiagnostic.range.start.line, 0);
  assert.equal(noLocationDiagnostic.range.start.character, 0);
}

async function testDeclarationNavigation() {
  const payload = await example("declarations.example.json");
  const items = declarationsPayloadToNavigationItems(payload);

  assert.ok(items.length > 0);
  assert.ok(items.some((item) => item.kind === "module" && item.name === "simple_mod"));
  assert.ok(items.some((item) => item.kind === "package" && item.name === "pkg_defs"));
  assert.ok(items.some((item) => item.kind === "interface" && item.name === "bus_if"));

  const pkg = items.find((item) => item.kind === "package" && item.name === "pkg_defs");
  assert.ok(pkg);
  assert.equal(pkg.file, "fixtures/modules/package_defs.sv");
  assert.equal(pkg.line, 1);
  assert.equal(pkg.column, 1);
  assert.equal(pkg.zero_based_line, 0);
  assert.equal(pkg.zero_based_column, 0);
}

async function testLocateNavigation() {
  for (const [filename, expectedKind, expectedName] of [
    ["locate-module.example.json", "module", "simple_mod"],
    ["locate-package.example.json", "package", "pkg_defs"],
    ["locate-interface.example.json", "interface", "bus_if"],
  ]) {
    const items = locatePayloadToNavigationItems(await example(filename));
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, expectedKind);
    assert.equal(items[0].name, expectedName);
    assert.equal(items[0].line, 1);
    assert.equal(items[0].zero_based_line, 0);
  }
}

function testFallbacks() {
  assert.equal(severityToVsCode("notice"), "Information");
  assert.deepEqual(
    declarationToNavigationItem({ name: "loose", kind: "module", file: "loose.sv" }),
    {
      name: "loose",
      kind: "module",
      file: "loose.sv",
      line: null,
      column: null,
      zero_based_line: 0,
      zero_based_column: 0,
    },
  );
}

await testDiagnosticsFromProblems();
await testDiagnosticsFromXsimLog();
await testDeclarationNavigation();
await testLocateNavigation();
testFallbacks();

console.log("vscode adapter prototype tests ok");

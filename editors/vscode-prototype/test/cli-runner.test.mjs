import assert from "node:assert/strict";

import { withParsedJson } from "../src/cli-runner.mjs";
import {
  getDeclarations,
  getProblemsFromCheck,
  getProblemsFromXsimLog,
  locateDeclaration,
} from "../src/live-adapter.mjs";

async function testLiveProblemsFromCheckOk() {
  const result = await getProblemsFromCheck("fixtures/ok_module.sv");
  assert.equal(result.ok, true, result.stderr || result.error);
  assert.equal(result.exitCode, 0);
  assert.equal(result.json.kind, "editor-problems");
  assert.deepEqual(result.diagnostics, []);
}

async function testLiveProblemsFromCheckMissingEndmodule() {
  const result = await getProblemsFromCheck("fixtures/missing_endmodule.sv");
  assert.equal(result.ok, true, result.stderr || result.error);
  assert.equal(result.exitCode, 0);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].severity, "Error");
  assert.equal(result.diagnostics[0].range.start.line, 0);
  assert.equal(result.diagnostics[0].range.start.character, 0);
}

async function testLiveXsimMixedLog() {
  const result = await getProblemsFromXsimLog("fixtures/xsim/mixed.log");
  assert.equal(result.ok, true, result.stderr || result.error);
  assert.equal(result.json.source_kind, "xsim-log");
  assert.equal(result.diagnostics.length, 5);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "VRFC 10-1234"));
}

async function testLiveDeclarations() {
  const result = await getDeclarations("fixtures/modules");
  assert.equal(result.ok, true, result.stderr || result.error);
  assert.equal(result.json.kind, "declarations");

  const seen = new Set(result.navigationItems.map((item) => `${item.kind}:${item.name}`));
  assert.ok(seen.has("module:simple_mod"));
  assert.ok(seen.has("package:pkg_defs"));
  assert.ok(seen.has("interface:bus_if"));
}

async function testLiveLocatePackageAndInterface() {
  const pkg = await locateDeclaration("fixtures/modules", "pkg_defs", "package");
  assert.equal(pkg.ok, true, pkg.stderr || pkg.error);
  assert.equal(pkg.navigationItems.length, 1);
  assert.equal(pkg.navigationItems[0].kind, "package");
  assert.equal(pkg.navigationItems[0].zero_based_line, 0);

  const intf = await locateDeclaration("fixtures/modules", "bus_if", "interface");
  assert.equal(intf.ok, true, intf.stderr || intf.error);
  assert.equal(intf.navigationItems.length, 1);
  assert.equal(intf.navigationItems[0].kind, "interface");
  assert.equal(intf.navigationItems[0].zero_based_column, 0);
}

async function testMissingPathReturnsStructuredFailure() {
  const result = await getProblemsFromCheck("fixtures/does_not_exist.sv");
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /does not exist/);
  assert.deepEqual(result.diagnostics, []);
}

async function testJsonParseFailureReturnsStructuredFailure() {
  const result = withParsedJson({
    ok: true,
    exitCode: 0,
    stdout: "not json\n",
    stderr: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 0);
  assert.match(result.error, /failed to parse JSON stdout/);
}

await testLiveProblemsFromCheckOk();
await testLiveProblemsFromCheckMissingEndmodule();
await testLiveXsimMixedLog();
await testLiveDeclarations();
await testLiveLocatePackageAndInterface();
await testMissingPathReturnsStructuredFailure();
await testJsonParseFailureReturnsStructuredFailure();

console.log("vscode live cli runner tests ok");

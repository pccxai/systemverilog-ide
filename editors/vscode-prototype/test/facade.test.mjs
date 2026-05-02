import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const FACADE = resolve(ROOT, "editors/vscode-prototype/bin/pccx-vscode-prototype.mjs");

function runFacade(args) {
  return new Promise((resolveResult) => {
    execFile(
      "node",
      [FACADE, ...args],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolveResult({
          exitCode: error && typeof error.code === "number" ? error.code : 0,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        });
      },
    );
  });
}

async function runSuccess(args) {
  const result = await runFacade(args);
  assert.equal(result.exitCode, 0, result.stderr);
  return JSON.parse(result.stdout);
}

async function testDiagnosticsExampleMode() {
  const output = await runSuccess([
    "diagnostics",
    "--mode",
    "example",
    "--source",
    "check-missing-endmodule",
  ]);

  assert.equal(output.tool, "pccx-vscode-prototype");
  assert.equal(output.kind, "vscode-diagnostics");
  assert.equal(output.mode, "example");
  assert.equal(output.diagnostics.length, 1);
  assert.equal(output.diagnostics[0].severity, "Error");
}

async function testDiagnosticsLiveFromCheck() {
  const output = await runSuccess([
    "diagnostics",
    "--mode",
    "live",
    "--from-check",
    "fixtures/missing_endmodule.sv",
  ]);

  assert.equal(output.kind, "vscode-diagnostics");
  assert.equal(output.mode, "live");
  assert.equal(output.diagnostics.length, 1);
  assert.equal(output.diagnostics[0].range.start.line, 0);
}

async function testDiagnosticsLiveFromXsimLog() {
  const output = await runSuccess([
    "diagnostics",
    "--mode",
    "live",
    "--from-xsim-log",
    "fixtures/xsim/mixed.log",
  ]);

  assert.equal(output.kind, "vscode-diagnostics");
  assert.equal(output.mode, "live");
  assert.ok(output.diagnostics.some((diagnostic) => diagnostic.code === "VRFC 10-1234"));
}

async function testNavigationExampleMode() {
  const output = await runSuccess([
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);

  assert.equal(output.kind, "vscode-navigation");
  assert.equal(output.mode, "example");
  assert.ok(output.items.some((item) => item.kind === "package" && item.name === "pkg_defs"));
}

async function testNavigationLiveDeclarations() {
  const output = await runSuccess([
    "navigation",
    "--mode",
    "live",
    "--declarations",
    "fixtures/modules",
  ]);

  assert.equal(output.kind, "vscode-navigation");
  assert.equal(output.mode, "live");
  assert.ok(output.items.some((item) => item.kind === "module" && item.name === "simple_mod"));
  assert.ok(output.items.some((item) => item.kind === "interface" && item.name === "bus_if"));
}

async function testNavigationLiveLocatePackage() {
  const output = await runSuccess([
    "navigation",
    "--mode",
    "live",
    "--locate",
    "fixtures/modules",
    "pkg_defs",
    "--kind",
    "package",
  ]);

  assert.equal(output.kind, "vscode-navigation");
  assert.equal(output.mode, "live");
  assert.equal(output.items.length, 1);
  assert.equal(output.items[0].kind, "package");
  assert.equal(output.items[0].name, "pkg_defs");
}

async function testInvalidModeFails() {
  const result = await runFacade([
    "diagnostics",
    "--mode",
    "automatic",
    "--source",
    "check-ok",
  ]);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /explicit --mode example or --mode live/);
}

async function testMissingRequiredArgsFail() {
  const result = await runFacade([
    "navigation",
    "--mode",
    "live",
    "--locate",
    "fixtures/modules",
  ]);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /--locate requires a path and name/);
}

async function testNoArbitraryCommandOption() {
  const result = await runFacade([
    "diagnostics",
    "--mode",
    "live",
    "--command",
    "python -c 'print(1)'",
  ]);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /unknown option: --command/);
}

async function testWrongFlowOptionFails() {
  const result = await runFacade([
    "navigation",
    "--mode",
    "live",
    "--declarations",
    "fixtures/modules",
    "--kind",
    "package",
  ]);
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /--kind is only valid with --locate/);
}

await testDiagnosticsExampleMode();
await testDiagnosticsLiveFromCheck();
await testDiagnosticsLiveFromXsimLog();
await testNavigationExampleMode();
await testNavigationLiveDeclarations();
await testNavigationLiveLocatePackage();
await testInvalidModeFails();
await testMissingRequiredArgsFail();
await testNoArbitraryCommandOption();
await testWrongFlowOptionFails();

console.log("vscode prototype facade tests ok");

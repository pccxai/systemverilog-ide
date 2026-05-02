const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const vscode = require("vscode");

const extensionRoot = process.env.PCCX_EXTENSION_ROOT;
const expectedCommandIds = (process.env.PCCX_EXPECTED_COMMAND_IDS || "")
  .split(",")
  .filter(Boolean);

function readManifest() {
  return JSON.parse(readFileSync(path.join(extensionRoot, "package.json"), "utf8"));
}

function localDevelopmentExtensions() {
  const expectedPath = path.resolve(extensionRoot);
  return vscode.extensions.all.filter(
    (extension) => path.resolve(extension.extensionPath) === expectedPath,
  );
}

async function importExtensionEntrypoint() {
  const entrypoint = path.join(extensionRoot, "src/extension.mjs");
  return import(pathToFileURL(entrypoint).href);
}

async function run() {
  assert.ok(extensionRoot, "PCCX_EXTENSION_ROOT must be set");
  assert.ok(process.env.PCCX_REPO_ROOT, "PCCX_REPO_ROOT must be set");
  assert.deepEqual(expectedCommandIds, [
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
    "pccxSystemVerilog.showCheckedExampleNavigation",
    "pccxSystemVerilog.showDiagnosticsExample",
    "pccxSystemVerilog.showNavigationExample",
    "pccxSystemVerilog.runDiagnosticsLive",
    "pccxSystemVerilog.runNavigationLive",
  ]);

  const manifest = readManifest();
  assert.equal(manifest.private, true);
  assert.equal(manifest.publisher, undefined);
  assert.equal(manifest.devDependencies?.["@vscode/test-electron"], "2.5.2");

  const developmentExtensions = localDevelopmentExtensions();
  assert.ok(
    developmentExtensions.length >= 1,
    "local extensionDevelopmentPath was not loaded by the Extension Host",
  );
  const developmentExtension = developmentExtensions[0];
  const activation = await developmentExtension.activate();
  assert.equal(developmentExtension.isActive, true);
  assert.deepEqual(activation.registered, expectedCommandIds);

  const commands = await vscode.commands.getCommands(true);
  for (const commandId of expectedCommandIds) {
    assert.ok(commands.includes(commandId), `${commandId} is not registered`);
  }

  const result = await vscode.commands.executeCommand(
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
  );
  assert.equal(result.ok, true);
  assert.equal(result.commandId, "pccxSystemVerilog.publishCheckedExampleDiagnostics");
  assert.equal(result.action.kind, "diagnostics");
  assert.ok(result.action.diagnostics.length > 0);

  const expectedDiagnostic = result.action.diagnostics[0];
  const expectedUri = vscode.Uri.file(path.resolve(
    process.env.PCCX_REPO_ROOT,
    expectedDiagnostic.file,
  ));
  const publishedDiagnostics = vscode.languages.getDiagnostics(expectedUri);
  assert.ok(
    publishedDiagnostics.length > 0,
    `no diagnostics were published for ${expectedUri.toString()}`,
  );
  const publishedDiagnostic = publishedDiagnostics.find(
    (diagnostic) => diagnostic.message === expectedDiagnostic.message,
  );
  assert.ok(publishedDiagnostic, "published diagnostic message was not found");
  assert.equal(publishedDiagnostic.source, expectedDiagnostic.source);
  assert.equal(publishedDiagnostic.severity, vscode.DiagnosticSeverity.Error);
  assert.equal(publishedDiagnostic.range.start.line, expectedDiagnostic.range.start.line);
  assert.equal(
    publishedDiagnostic.range.start.character,
    expectedDiagnostic.range.start.character,
  );
  assert.equal(publishedDiagnostic.range.end.line, expectedDiagnostic.range.end.line);
  assert.equal(
    publishedDiagnostic.range.end.character,
    expectedDiagnostic.range.end.character,
  );

  const navigationResult = await vscode.commands.executeCommand(
    "pccxSystemVerilog.showCheckedExampleNavigation",
  );
  assert.equal(navigationResult.ok, true);
  assert.equal(navigationResult.commandId, "pccxSystemVerilog.showCheckedExampleNavigation");
  assert.deepEqual(navigationResult.plan.facadeArgs, [
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);
  assert.equal(navigationResult.action.kind, "navigation");
  assert.ok(navigationResult.action.items.length > 0);
  assert.ok(Array.isArray(navigationResult.locations));
  assert.ok(navigationResult.locations.length > 0);

  const firstLocation = navigationResult.locations[0];
  assert.ok(firstLocation.uri instanceof vscode.Uri);
  assert.ok(firstLocation.range instanceof vscode.Range);
  assert.ok(firstLocation.location instanceof vscode.Location);
  assert.ok(firstLocation.uri.fsPath.endsWith(firstLocation.file));
  assert.ok(firstLocation.range.start.line >= 0);
  assert.ok(firstLocation.range.start.character >= 0);
  assert.equal(firstLocation.range.end.line, firstLocation.range.start.line);
  assert.equal(firstLocation.range.end.character, firstLocation.range.start.character + 1);
  assert.equal(typeof firstLocation.symbol, "string");
  assert.ok(firstLocation.symbol.length > 0);
  assert.equal(typeof firstLocation.targetKind, "string");
  assert.ok(firstLocation.targetKind.length > 0);
  assert.equal(firstLocation.source, "pccx-vscode-prototype");
  assert.equal(firstLocation.location.uri.toString(), firstLocation.uri.toString());
  assert.equal(firstLocation.location.range.start.line, firstLocation.range.start.line);

  const extensionModule = await importExtensionEntrypoint();
  assert.equal(typeof extensionModule.deactivate, "function");
  extensionModule.deactivate();
}

module.exports = { run };

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
  assert.deepEqual(expectedCommandIds, [
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
    "pccxSystemVerilog.showDiagnosticsExample",
  );
  assert.equal(result.ok, true);
  assert.equal(result.commandId, "pccxSystemVerilog.showDiagnosticsExample");
  assert.equal(result.action.kind, "diagnostics");
  assert.ok(result.action.diagnostics.length > 0);

  const extensionModule = await importExtensionEntrypoint();
  assert.equal(typeof extensionModule.deactivate, "function");
  extensionModule.deactivate();
}

module.exports = { run };

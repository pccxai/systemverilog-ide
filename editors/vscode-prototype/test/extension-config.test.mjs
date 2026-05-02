import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DECLARATION_KINDS,
  MODES,
  buildFacadeArgsForCommand,
  defaultConfig,
  normalizeConfig,
} from "../src/config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PACKAGE_JSON = resolve(ROOT, "editors/vscode-prototype/package.json");

const REQUIRED_SETTINGS = new Map([
  ["pccxSystemVerilog.mode", { default: "example" }],
  ["pccxSystemVerilog.pythonPath", { default: "python3" }],
  ["pccxSystemVerilog.defaultSource", { default: "fixtures/missing_endmodule.sv" }],
  ["pccxSystemVerilog.defaultLog", { default: "fixtures/xsim/mixed.log" }],
  ["pccxSystemVerilog.defaultModule", { default: "simple_mod" }],
  ["pccxSystemVerilog.defaultDeclarationKind", { default: "module" }],
]);

async function readPackageJson() {
  return JSON.parse(await readFile(PACKAGE_JSON, "utf8"));
}

async function testPackageConfigurationSchema() {
  const manifest = await readPackageJson();
  const configuration = manifest.contributes?.configuration;
  assert.ok(configuration);
  assert.equal(configuration.title, "PCCX SystemVerilog IDE Prototype");

  for (const [setting, expected] of REQUIRED_SETTINGS) {
    const property = configuration.properties?.[setting];
    assert.ok(property, `${setting} missing`);
    assert.equal(property.type, "string");
    assert.equal(property.default, expected.default);
    assert.match(property.description, /experimental local prototype/i);
    assert.match(property.description, /not a stable API/i);
  }

  assert.deepEqual(configuration.properties["pccxSystemVerilog.mode"].enum, MODES);
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.defaultDeclarationKind"].enum,
    DECLARATION_KINDS,
  );
}

function testDefaultConfig() {
  assert.deepEqual(defaultConfig(), {
    mode: "example",
    pythonPath: "python3",
    defaultSource: "fixtures/missing_endmodule.sv",
    defaultLog: "fixtures/xsim/mixed.log",
    defaultModule: "simple_mod",
    defaultDeclarationKind: "module",
  });
}

function testNormalizeConfigRejectsInvalidSettings() {
  assert.throws(
    () => normalizeConfig({ mode: "automatic" }),
    /pccxSystemVerilog\.mode must be one of: example, live/,
  );
  assert.throws(
    () => normalizeConfig({ defaultDeclarationKind: "class" }),
    /pccxSystemVerilog\.defaultDeclarationKind must be one of: module, package, interface, any/,
  );
  assert.throws(
    () => normalizeConfig({ pythonPath: "" }),
    /pccxSystemVerilog\.pythonPath must be a non-empty string/,
  );
  assert.throws(
    () => normalizeConfig({ defaultSource: "fixtures/ok_module.sv; rm -rf /" }),
    /pccxSystemVerilog\.defaultSource must not contain shell control syntax/,
  );
}

function testFacadeArgsForKnownCommands() {
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.showDiagnosticsExample"),
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.showNavigationExample"),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive"),
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive"),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  );
}

function testFacadeArgsUseNormalizedLiveConfig() {
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive", {
      mode: "live",
      defaultSource: "rtl/top.sv",
      defaultLog: "logs/xsim.log",
      pythonPath: "python-custom",
    }),
    ["diagnostics", "--mode", "live", "--from-check", "rtl/top.sv"],
  );

  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive", {
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "any",
    }),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "pkg_defs", "--kind", "any"],
  );
}

function testUnknownCommandAndShellShape() {
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runArbitraryCommand"),
    /unknown PCCX SystemVerilog command/,
  );

  for (const commandId of [
    "pccxSystemVerilog.showDiagnosticsExample",
    "pccxSystemVerilog.showNavigationExample",
    "pccxSystemVerilog.runDiagnosticsLive",
    "pccxSystemVerilog.runNavigationLive",
  ]) {
    const args = buildFacadeArgsForCommand(commandId);
    assert.ok(Array.isArray(args));
    assert.ok(args.every((arg) => typeof arg === "string"));
    assert.doesNotMatch(args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
  }
}

await testPackageConfigurationSchema();
testDefaultConfig();
testNormalizeConfigRejectsInvalidSettings();
testFacadeArgsForKnownCommands();
testFacadeArgsUseNormalizedLiveConfig();
testUnknownCommandAndShellShape();

console.log("vscode extension config tests ok");

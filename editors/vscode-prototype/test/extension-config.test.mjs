import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AI_ASSISTANT_BACKENDS,
  DECLARATION_KINDS,
  MODES,
  buildFacadeArgsForCommand,
  defaultConfig,
  normalizeConfig,
} from "../src/config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const PACKAGE_JSON = resolve(ROOT, "editors/vscode-prototype/package.json");

const REQUIRED_SETTINGS = new Map([
  ["pccxSystemVerilog.mode", { type: "string", default: "checkedExample" }],
  ["pccxSystemVerilog.liveWorkspace.enabled", { type: "boolean", default: false }],
  ["pccxSystemVerilog.pccxLab.command", { type: "string", default: "pccx_ide_cli" }],
  ["pccxSystemVerilog.aiAssistant.enabled", { type: "boolean", default: false }],
  ["pccxSystemVerilog.aiAssistant.backend", { type: "string", default: "none" }],
  ["pccxSystemVerilog.pythonPath", { type: "string", default: "python3" }],
  ["pccxSystemVerilog.defaultSource", { type: "string", default: "fixtures/missing_endmodule.sv" }],
  ["pccxSystemVerilog.defaultLog", { type: "string", default: "fixtures/xsim/mixed.log" }],
  ["pccxSystemVerilog.defaultModule", { type: "string", default: "simple_mod" }],
  ["pccxSystemVerilog.defaultDeclarationKind", { type: "string", default: "module" }],
]);

const LIVE_WORKSPACE_CONFIG = {
  mode: "liveWorkspace",
  liveWorkspace: { enabled: true },
};

async function readPackageJson() {
  return JSON.parse(await readFile(PACKAGE_JSON, "utf8"));
}

async function testPackageConfigurationSchema() {
  const manifest = await readPackageJson();
  const configuration = manifest.contributes?.configuration;
  assert.ok(configuration);
  assert.equal(configuration.title, "PCCX SystemVerilog IDE Prototype");
  assert.deepEqual(
    Object.keys(configuration.properties ?? {}).sort(),
    Array.from(REQUIRED_SETTINGS.keys()).sort(),
  );

  for (const [setting, expected] of REQUIRED_SETTINGS) {
    assert.ok(setting.startsWith("pccxSystemVerilog."), `${setting} is not prototype-scoped`);
    const property = configuration.properties?.[setting];
    assert.ok(property, `${setting} missing`);
    assert.equal(property.type, expected.type);
    assert.equal(property.default, expected.default);
    assert.match(property.description, /experimental local prototype/i);
    assert.match(property.description, /not a stable API/i);
  }

  assert.deepEqual(configuration.properties["pccxSystemVerilog.mode"].enum, MODES);
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.aiAssistant.backend"].enum,
    AI_ASSISTANT_BACKENDS,
  );
  assert.deepEqual(
    configuration.properties["pccxSystemVerilog.defaultDeclarationKind"].enum,
    DECLARATION_KINDS,
  );
}

function testDefaultConfig() {
  assert.deepEqual(defaultConfig(), {
    mode: "checkedExample",
    liveWorkspace: {
      enabled: false,
    },
    pccxLab: {
      command: "pccx_ide_cli",
    },
    aiAssistant: {
      enabled: false,
      backend: "none",
    },
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
    /pccxSystemVerilog\.mode must be one of: checkedExample, liveWorkspace/,
  );
  assert.throws(
    () => normalizeConfig({ liveWorkspace: { enabled: "yes" } }),
    /pccxSystemVerilog\.liveWorkspace\.enabled must be a boolean/,
  );
  assert.throws(
    () => normalizeConfig({ pccxLab: { command: "pccx_ide_cli --format json" } }),
    /pccxSystemVerilog\.pccxLab\.command must be a command name or path without arguments/,
  );
  assert.throws(
    () => normalizeConfig({ aiAssistant: { backend: "openai" } }),
    /pccxSystemVerilog\.aiAssistant\.backend must be one of: none, pccx-llm-launcher, mcp/,
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
    buildFacadeArgsForCommand("pccxSystemVerilog.showCheckedExampleNavigation"),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.showNavigationExample"),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
      LIVE_WORKSPACE_CONFIG,
    ),
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.showLiveWorkspaceNavigation",
      LIVE_WORKSPACE_CONFIG,
    ),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive", LIVE_WORKSPACE_CONFIG),
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  );
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive", LIVE_WORKSPACE_CONFIG),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  );
}

function testFacadeArgsUseNormalizedLiveConfig() {
  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive", {
      mode: "liveWorkspace",
      "liveWorkspace.enabled": true,
      defaultSource: "rtl/top.sv",
      defaultLog: "logs/xsim.log",
      pythonPath: "python-custom",
    }),
    ["diagnostics", "--mode", "live", "--from-check", "rtl/top.sv"],
  );

  assert.deepEqual(
    buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive", {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "any",
    }),
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "pkg_defs", "--kind", "any"],
  );
}

function testLiveWorkspaceRequiresExplicitOptIn() {
  for (const commandId of [
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
    "pccxSystemVerilog.runDiagnosticsLive",
    "pccxSystemVerilog.runNavigationLive",
  ]) {
    assert.throws(
      () => buildFacadeArgsForCommand(commandId),
      /live workspace commands require pccxSystemVerilog\.mode=liveWorkspace/,
    );
    assert.throws(
      () => buildFacadeArgsForCommand(commandId, { liveWorkspace: { enabled: true } }),
      /live workspace commands require pccxSystemVerilog\.mode=liveWorkspace/,
    );
    assert.throws(
      () => buildFacadeArgsForCommand(commandId, { mode: "liveWorkspace" }),
      /live workspace commands require pccxSystemVerilog\.mode=liveWorkspace/,
    );
  }
}

function testUnknownCommandAndShellShape() {
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runArbitraryCommand"),
    /unknown PCCX SystemVerilog command/,
  );

  for (const commandId of [
    "pccxSystemVerilog.showDiagnosticsExample",
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
    "pccxSystemVerilog.showCheckedExampleNavigation",
    "pccxSystemVerilog.showNavigationExample",
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
    "pccxSystemVerilog.runDiagnosticsLive",
    "pccxSystemVerilog.runNavigationLive",
  ]) {
    const args = commandId.includes("Live")
      ? buildFacadeArgsForCommand(commandId, LIVE_WORKSPACE_CONFIG)
      : buildFacadeArgsForCommand(commandId);
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
testLiveWorkspaceRequiresExplicitOptIn();
testUnknownCommandAndShellShape();

console.log("vscode extension config tests ok");

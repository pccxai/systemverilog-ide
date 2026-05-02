import assert from "node:assert/strict";

import {
  COMMAND_IDS,
  activate,
  buildFacadeArgsForCommand,
  buildFacadeInvocationForCommand,
  createCommandHandler,
  deactivate,
  readExtensionConfig,
  resolveCommandRequest,
} from "../src/extension.mjs";

const EXPECTED_ARGS = new Map([
  [
    "pccxSystemVerilog.showDiagnosticsExample",
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  ],
  [
    "pccxSystemVerilog.showNavigationExample",
    ["navigation", "--mode", "example", "--source", "declarations"],
  ],
  [
    "pccxSystemVerilog.runDiagnosticsLive",
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  ],
  [
    "pccxSystemVerilog.runNavigationLive",
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
  ],
]);

function configFor(commandId) {
  if (commandId === "pccxSystemVerilog.runDiagnosticsLive") {
    return { defaultSource: "fixtures/missing_endmodule.sv" };
  }
  if (commandId === "pccxSystemVerilog.runNavigationLive") {
    return { defaultModule: "simple_mod", defaultDeclarationKind: "module" };
  }
  return {};
}

function testKnownFacadeArgs() {
  for (const commandId of COMMAND_IDS) {
    assert.deepEqual(
      buildFacadeArgsForCommand(commandId, configFor(commandId)),
      EXPECTED_ARGS.get(commandId),
    );
  }
}

function testUnknownCommandsRejected() {
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runArbitraryCommand"),
    /unknown PCCX SystemVerilog command/,
  );
}

function testFacadeInvocationIsArgumentArray() {
  const invocation = buildFacadeInvocationForCommand(
    "pccxSystemVerilog.runDiagnosticsLive",
    { defaultSource: "fixtures/missing_endmodule.sv", pythonPath: "python3" },
    { nodeExecutable: "node", facadePath: "editors/vscode-prototype/bin/pccx-vscode-prototype.mjs" },
  );

  assert.equal(invocation.executable, "node");
  assert.equal(invocation.shell, false);
  assert.deepEqual(invocation.env, { PCCX_IDE_PYTHON: "python3" });
  assert.ok(Array.isArray(invocation.args));
  assert.deepEqual(invocation.args.slice(1), EXPECTED_ARGS.get("pccxSystemVerilog.runDiagnosticsLive"));
  assert.doesNotMatch(invocation.args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
}

function testResolveCommandRequestUsesVsCodeSettings() {
  const settings = new Map([
    ["mode", "live"],
    ["pythonPath", "python-custom"],
    ["defaultSource", "configured.sv"],
    ["defaultLog", "configured.log"],
    ["defaultModule", "pkg_defs"],
    ["defaultDeclarationKind", "package"],
  ]);
  const vscodeApi = {
    workspace: {
      getConfiguration(section) {
        assert.equal(section, "pccxSystemVerilog");
        return {
          get(key) {
            return settings.get(key);
          },
        };
      },
    },
  };

  assert.deepEqual(readExtensionConfig(vscodeApi), {
    mode: "live",
    pythonPath: "python-custom",
    defaultSource: "configured.sv",
    defaultLog: "configured.log",
    defaultModule: "pkg_defs",
    defaultDeclarationKind: "package",
  });
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", undefined, vscodeApi),
    {
      mode: "live",
      pythonPath: "python-custom",
      defaultSource: "configured.sv",
      defaultLog: "configured.log",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
    },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runNavigationLive", undefined, vscodeApi),
    {
      mode: "live",
      pythonPath: "python-custom",
      defaultSource: "configured.sv",
      defaultLog: "configured.log",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
    },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", { fsPath: "explicit.sv" }, vscodeApi),
    {
      mode: "live",
      pythonPath: "python-custom",
      defaultSource: "explicit.sv",
      defaultLog: "configured.log",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
    },
  );
}

async function testEntrypointExportsAndActivation() {
  assert.equal(typeof activate, "function");
  assert.equal(typeof deactivate, "function");

  const registered = new Map();
  const subscriptions = [];
  const outputLines = [];
  const vscodeApi = {
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return {
          appendLine(line) {
            outputLines.push(line);
          },
          show() {},
          dispose() {},
        };
      },
      showInformationMessage() {},
      showErrorMessage() {},
    },
  };

  const activation = await activate(
    { subscriptions },
    vscodeApi,
    {
      async runFacade() {
        return {
          ok: true,
          json: { kind: "vscode-diagnostics", diagnostics: [] },
        };
      },
    },
  );

  assert.deepEqual(activation.registered, COMMAND_IDS);
  assert.equal(registered.size, COMMAND_IDS.length);
  assert.equal(subscriptions.length, COMMAND_IDS.length + 1);

  const result = await registered.get("pccxSystemVerilog.showDiagnosticsExample")();
  assert.equal(result.ok, true);
  assert.ok(outputLines.some((line) => line.includes("pccxSystemVerilog.showDiagnosticsExample")));
}

async function testNoVsCodeRuntimeIsANoop() {
  const activation = await activate({ subscriptions: [] }, { commands: null });
  assert.deepEqual(activation.registered, []);
}

async function testCommandHandlerCanBeUsedWithoutRealVsCode() {
  const handler = createCommandHandler(
    "pccxSystemVerilog.showNavigationExample",
    null,
    {
      async runFacade() {
        return {
          ok: true,
          json: { kind: "vscode-navigation", items: [] },
        };
      },
    },
  );

  const result = await handler();
  assert.equal(result.ok, true);
}

testKnownFacadeArgs();
testUnknownCommandsRejected();
testFacadeInvocationIsArgumentArray();
testResolveCommandRequestUsesVsCodeSettings();
await testEntrypointExportsAndActivation();
await testNoVsCodeRuntimeIsANoop();
await testCommandHandlerCanBeUsedWithoutRealVsCode();

console.log("vscode extension entrypoint tests ok");

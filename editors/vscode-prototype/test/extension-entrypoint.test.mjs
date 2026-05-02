import assert from "node:assert/strict";

import {
  COMMAND_IDS,
  activate,
  buildFacadeArgsForCommand,
  buildFacadeInvocationForCommand,
  createCommandHandler,
  deactivate,
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
    ["navigation", "--mode", "live", "--declarations", "fixtures/modules"],
  ],
]);

function optionsFor(commandId) {
  if (commandId === "pccxSystemVerilog.runDiagnosticsLive") {
    return { targetFile: "fixtures/missing_endmodule.sv" };
  }
  if (commandId === "pccxSystemVerilog.runNavigationLive") {
    return { targetPath: "fixtures/modules" };
  }
  return {};
}

function testKnownFacadeArgs() {
  for (const commandId of COMMAND_IDS) {
    assert.deepEqual(
      buildFacadeArgsForCommand(commandId, optionsFor(commandId)),
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

function testLiveCommandsRequireExplicitPaths() {
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runDiagnosticsLive"),
    /targetFile is required/,
  );
  assert.throws(
    () => buildFacadeArgsForCommand("pccxSystemVerilog.runNavigationLive"),
    /targetPath is required/,
  );
}

function testFacadeInvocationIsArgumentArray() {
  const invocation = buildFacadeInvocationForCommand(
    "pccxSystemVerilog.runDiagnosticsLive",
    { targetFile: "fixtures/missing_endmodule.sv" },
    { nodeExecutable: "node", facadePath: "editors/vscode-prototype/bin/pccx-vscode-prototype.mjs" },
  );

  assert.equal(invocation.executable, "node");
  assert.equal(invocation.shell, false);
  assert.ok(Array.isArray(invocation.args));
  assert.deepEqual(invocation.args.slice(1), EXPECTED_ARGS.get("pccxSystemVerilog.runDiagnosticsLive"));
  assert.doesNotMatch(invocation.args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
}

function testResolveCommandRequestUsesVsCodeState() {
  const vscodeApi = {
    window: {
      activeTextEditor: {
        document: { uri: { fsPath: "active.sv" } },
      },
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "workspace-root" } }],
    },
  };

  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", undefined, vscodeApi),
    { targetFile: "active.sv" },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runNavigationLive", undefined, vscodeApi),
    { targetPath: "workspace-root" },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", { fsPath: "explicit.sv" }, vscodeApi),
    { targetFile: "explicit.sv" },
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
      async runFacadeForCommand(commandId) {
        return {
          ok: true,
          exitCode: 0,
          stdout: JSON.stringify({ kind: "vscode-diagnostics", diagnostics: [] }),
          stderr: "",
          json: { kind: "vscode-diagnostics", diagnostics: [] },
          commandId,
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
      async runFacadeForCommand(commandId) {
        return {
          ok: true,
          exitCode: 0,
          stdout: JSON.stringify({ kind: "vscode-navigation", items: [] }),
          stderr: "",
          json: { kind: "vscode-navigation", items: [] },
          commandId,
        };
      },
    },
  );

  const result = await handler();
  assert.equal(result.ok, true);
}

testKnownFacadeArgs();
testUnknownCommandsRejected();
testLiveCommandsRequireExplicitPaths();
testFacadeInvocationIsArgumentArray();
testResolveCommandRequestUsesVsCodeState();
await testEntrypointExportsAndActivation();
await testNoVsCodeRuntimeIsANoop();
await testCommandHandlerCanBeUsedWithoutRealVsCode();

console.log("vscode extension entrypoint tests ok");

import assert from "node:assert/strict";

import {
  AI_CONTEXT_BUNDLE_COMMAND,
  AI_ASSISTANT_STATUS_COMMAND,
  COMMAND_IDS,
  CHECKED_EXAMPLE_NAVIGATION_COMMAND,
  FACADE_COMMAND_IDS,
  activate,
  buildFacadeArgsForCommand,
  buildFacadeInvocationForCommand,
  createNavigationLocationRecords,
  createPresenterDeps,
  createCommandHandler,
  deactivate,
  readExtensionConfig,
  resolveCommandRequest,
} from "../src/extension.mjs";
import {
  CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID,
  CHECKED_EXAMPLE_DEFINITION_SELECTOR,
  checkedExampleDefinitionProvider,
} from "../src/definition-provider.mjs";

const EXPECTED_ARGS = new Map([
  [
    "pccxSystemVerilog.publishCheckedExampleDiagnostics",
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  ],
  [
    "pccxSystemVerilog.showDiagnosticsExample",
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  ],
  [
    "pccxSystemVerilog.showCheckedExampleNavigation",
    ["navigation", "--mode", "example", "--source", "declarations"],
  ],
  [
    "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
    ["diagnostics", "--mode", "live", "--from-check", "fixtures/missing_endmodule.sv"],
  ],
  [
    "pccxSystemVerilog.showLiveWorkspaceNavigation",
    ["navigation", "--mode", "live", "--locate", "fixtures/modules", "simple_mod", "--kind", "module"],
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
  if (commandId === "pccxSystemVerilog.publishLiveWorkspaceDiagnostics" ||
      commandId === "pccxSystemVerilog.runDiagnosticsLive") {
    return {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultSource: "fixtures/missing_endmodule.sv",
    };
  }
  if (commandId === "pccxSystemVerilog.showLiveWorkspaceNavigation" ||
      commandId === "pccxSystemVerilog.runNavigationLive") {
    return {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultModule: "simple_mod",
      defaultDeclarationKind: "module",
    };
  }
  return {};
}

function testKnownFacadeArgs() {
  for (const commandId of FACADE_COMMAND_IDS) {
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

function testCheckedExampleDiagnosticsCommandStaysExampleMode() {
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.publishCheckedExampleDiagnostics",
      {
        mode: "liveWorkspace",
        liveWorkspace: { enabled: true },
        defaultSource: "configured.sv",
        pythonPath: "python-custom",
      },
    ),
    ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"],
  );
}

function testCheckedExampleNavigationCommandStaysExampleMode() {
  assert.deepEqual(
    buildFacadeArgsForCommand(
      "pccxSystemVerilog.showCheckedExampleNavigation",
      {
        mode: "liveWorkspace",
        liveWorkspace: { enabled: true },
        defaultModule: "pkg_defs",
        pythonPath: "python-custom",
      },
    ),
    ["navigation", "--mode", "example", "--source", "declarations"],
  );
}

function testFacadeInvocationIsArgumentArray() {
  const invocation = buildFacadeInvocationForCommand(
    "pccxSystemVerilog.runDiagnosticsLive",
    {
      mode: "liveWorkspace",
      liveWorkspace: { enabled: true },
      defaultSource: "fixtures/missing_endmodule.sv",
      pythonPath: "python3",
    },
    { nodeExecutable: "node", facadePath: "editors/vscode-prototype/bin/pccx-vscode-prototype.mjs" },
  );

  assert.equal(invocation.executable, "node");
  assert.equal(invocation.shell, false);
  assert.deepEqual(invocation.env, { PCCX_IDE_PYTHON: "python3" });
  assert.ok(Array.isArray(invocation.args));
  assert.deepEqual(invocation.args.slice(1), EXPECTED_ARGS.get("pccxSystemVerilog.runDiagnosticsLive"));
  assert.doesNotMatch(invocation.args.join("\n"), /(?:&&|\|\||;|`|\$\()/);
}

function testPresenterDepsResolveRelativeDiagnosticFiles() {
  const created = [];
  const deps = createPresenterDeps(
    {
      Uri: {
        file(file) {
          created.push(file);
          return { fsPath: file };
        },
      },
    },
    { diagnosticFileRoot: "/repo/root" },
  );

  assert.deepEqual(deps.createUri("fixtures/missing_endmodule.sv"), {
    fsPath: "/repo/root/fixtures/missing_endmodule.sv",
  });
  assert.deepEqual(deps.createUri("/tmp/file.sv"), { fsPath: "/tmp/file.sv" });
  assert.deepEqual(created, [
    "/repo/root/fixtures/missing_endmodule.sv",
    "/tmp/file.sv",
  ]);
}

function testNavigationLocationMapping() {
  const records = createNavigationLocationRecords(
    [
      {
        name: "pkg_defs",
        kind: "package",
        file: "fixtures/modules/package_defs.sv",
        line: 1,
        column: 1,
        zero_based_line: 0,
        zero_based_column: 0,
      },
    ],
    {
      fileRoot: "/repo/root",
      createUri(file) {
        return { fsPath: file };
      },
      createRange(startLine, startCharacter, endLine, endCharacter) {
        return {
          start: { line: startLine, character: startCharacter },
          end: { line: endLine, character: endCharacter },
        };
      },
      createLocation(uri, range) {
        return { uri, range };
      },
    },
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].uri.fsPath, "/repo/root/fixtures/modules/package_defs.sv");
  assert.equal(records[0].range.start.line, 0);
  assert.equal(records[0].range.start.character, 0);
  assert.equal(records[0].range.end.character, 1);
  assert.equal(records[0].targetKind, "package");
  assert.equal(records[0].symbol, "pkg_defs");
  assert.equal(records[0].source, "pccx-vscode-prototype");
}

function testResolveCommandRequestUsesVsCodeSettings() {
  const settings = new Map([
    ["mode", "liveWorkspace"],
    ["liveWorkspace.enabled", true],
    ["pccxLab.command", "pccx_ide_cli"],
    ["aiAssistant.enabled", false],
    ["aiAssistant.backend", "none"],
    ["pythonPath", "python-custom"],
    ["defaultSource", "configured.sv"],
    ["defaultLog", "configured.log"],
    ["defaultNavigationRoot", "configured/modules"],
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
    mode: "liveWorkspace",
    liveWorkspace: {
      enabled: true,
    },
    pccxLab: {
      command: "pccx_ide_cli",
    },
    aiAssistant: {
      enabled: false,
      backend: "none",
    },
    pythonPath: "python-custom",
    defaultSource: "configured.sv",
    defaultLog: "configured.log",
    defaultNavigationRoot: "configured/modules",
    defaultModule: "pkg_defs",
    defaultDeclarationKind: "package",
  });
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", undefined, vscodeApi),
    {
      mode: "liveWorkspace",
      liveWorkspace: {
        enabled: true,
      },
      pccxLab: {
        command: "pccx_ide_cli",
      },
      aiAssistant: {
        enabled: false,
        backend: "none",
      },
      pythonPath: "python-custom",
      defaultSource: "configured.sv",
      defaultLog: "configured.log",
      defaultNavigationRoot: "configured/modules",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
    },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runNavigationLive", undefined, vscodeApi),
    {
      mode: "liveWorkspace",
      liveWorkspace: {
        enabled: true,
      },
      pccxLab: {
        command: "pccx_ide_cli",
      },
      aiAssistant: {
        enabled: false,
        backend: "none",
      },
      pythonPath: "python-custom",
      defaultSource: "configured.sv",
      defaultLog: "configured.log",
      defaultNavigationRoot: "configured/modules",
      defaultModule: "pkg_defs",
      defaultDeclarationKind: "package",
    },
  );
  assert.deepEqual(
    resolveCommandRequest("pccxSystemVerilog.runDiagnosticsLive", { fsPath: "explicit.sv" }, vscodeApi),
    {
      mode: "liveWorkspace",
      liveWorkspace: {
        enabled: true,
      },
      pccxLab: {
        command: "pccx_ide_cli",
      },
      aiAssistant: {
        enabled: false,
        backend: "none",
      },
      pythonPath: "python-custom",
      defaultSource: "explicit.sv",
      defaultLog: "configured.log",
      defaultNavigationRoot: "configured/modules",
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
  assert.equal(activation.definitionProviders.length, 1);
  assert.equal(activation.definitionProviders[0].id, CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID);
  assert.equal(activation.definitionProviders[0].registered, false);
  assert.equal(registered.size, COMMAND_IDS.length);
  assert.equal(subscriptions.length, COMMAND_IDS.length + 1);

  const result = await registered.get("pccxSystemVerilog.showDiagnosticsExample")();
  assert.equal(result.ok, true);
  assert.ok(outputLines.some((line) => line.includes("pccxSystemVerilog.showDiagnosticsExample")));
}

async function testCheckedExampleNavigationCommandReturnsLocations() {
  const registered = new Map();
  const quickPickCalls = [];
  const vscodeApi = {
    Uri: {
      file(file) {
        return { fsPath: file };
      },
    },
    Range: class Range {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    Location: class Location {
      constructor(uri, range) {
        this.uri = uri;
        this.range = range;
      }
    },
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      showInformationMessage() {},
      showErrorMessage() {},
      showQuickPick(...args) {
        quickPickCalls.push(args);
      },
    },
  };

  await activate(
    { subscriptions: [] },
    vscodeApi,
    {
      async runFacade(args) {
        assert.deepEqual(args, ["navigation", "--mode", "example", "--source", "declarations"]);
        return {
          ok: true,
          json: {
            kind: "vscode-navigation",
            items: [
              {
                name: "simple_mod",
                kind: "module",
                file: "fixtures/modules/simple_module.sv",
                line: 1,
                column: 1,
                zero_based_line: 0,
                zero_based_column: 0,
              },
            ],
          },
        };
      },
    },
  );

  const result = await registered.get("pccxSystemVerilog.showCheckedExampleNavigation")();
  assert.equal(result.ok, true);
  assert.equal(result.commandId, "pccxSystemVerilog.showCheckedExampleNavigation");
  assert.equal(result.action.kind, "navigation");
  assert.equal(result.locations.length, 1);
  assert.match(result.locations[0].uri.fsPath, /fixtures\/modules\/simple_module\.sv$/);
  assert.equal(result.locations[0].range.start.line, 0);
  assert.equal(result.locations[0].targetKind, "module");
  assert.equal(result.locations[0].symbol, "simple_mod");
  assert.equal(result.locations[0].source, "pccx-vscode-prototype");
  assert.deepEqual(result.locations[0].location.uri, result.locations[0].uri);
  assert.equal(quickPickCalls.length, 0);
}

async function testCheckedExampleDefinitionProviderReturnsLocations() {
  const location = { uri: { fsPath: "/repo/root/pkg.sv" }, range: { start: { line: 0 } } };
  const provider = checkedExampleDefinitionProvider({
    async runCheckedExampleNavigationLocations() {
      return {
        ok: true,
        locations: [
          { location },
          { uri: { fsPath: "/repo/root/simple.sv" }, range: { start: { line: 1 } } },
        ],
      };
    },
  });

  const definitions = await provider.provideDefinition({}, {}, {});

  assert.equal(definitions.length, 2);
  assert.equal(definitions[0], location);
  assert.deepEqual(definitions[1], {
    uri: { fsPath: "/repo/root/simple.sv" },
    range: { start: { line: 1 } },
  });
}

async function testActivationRegistersCheckedExampleDefinitionProvider() {
  const registered = new Map();
  const subscriptions = [];
  const definitionRegistrations = [];
  const facadeCalls = [];
  const vscodeApi = {
    Uri: {
      file(file) {
        return { fsPath: file };
      },
    },
    Range: class Range {
      constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = { line: startLine, character: startCharacter };
        this.end = { line: endLine, character: endCharacter };
      }
    },
    Location: class Location {
      constructor(uri, range) {
        this.uri = uri;
        this.range = range;
      }
    },
    commands: {
      registerCommand(commandId, handler) {
        registered.set(commandId, handler);
        return { dispose() {} };
      },
    },
    languages: {
      registerDefinitionProvider(selector, provider) {
        definitionRegistrations.push({ selector, provider });
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      showInformationMessage() {},
      showErrorMessage() {},
    },
  };

  const activation = await activate(
    { subscriptions },
    vscodeApi,
    {
      async runFacade(args, env, plan) {
        facadeCalls.push({ args, env, plan });
        return {
          ok: true,
          json: {
            kind: "vscode-navigation",
            items: [
              {
                name: "pkg_defs",
                kind: "package",
                file: "fixtures/modules/package_defs.sv",
                line: 1,
                column: 1,
                zero_based_line: 0,
                zero_based_column: 0,
              },
            ],
          },
        };
      },
    },
  );

  assert.deepEqual(activation.registered, COMMAND_IDS);
  assert.deepEqual(activation.definitionProviders, [
    {
      id: CHECKED_EXAMPLE_DEFINITION_PROVIDER_ID,
      selector: CHECKED_EXAMPLE_DEFINITION_SELECTOR,
      registered: true,
    },
  ]);
  assert.equal(definitionRegistrations.length, 1);
  assert.equal(definitionRegistrations[0].selector, CHECKED_EXAMPLE_DEFINITION_SELECTOR);
  assert.ok(
    CHECKED_EXAMPLE_DEFINITION_SELECTOR.some((selector) => selector.language === "systemverilog"),
  );
  assert.ok(
    CHECKED_EXAMPLE_DEFINITION_SELECTOR.some((selector) => selector.pattern === "**/*.sv"),
  );
  assert.equal(subscriptions.length, COMMAND_IDS.length + 2);

  const definitions = await definitionRegistrations[0].provider.provideDefinition(
    { uri: { fsPath: "/workspace/smoke.sv" } },
    { line: 0, character: 7 },
    {},
  );

  assert.equal(facadeCalls.length, 1);
  assert.equal(facadeCalls[0].plan.commandId, CHECKED_EXAMPLE_NAVIGATION_COMMAND);
  assert.deepEqual(facadeCalls[0].args, [
    "navigation",
    "--mode",
    "example",
    "--source",
    "declarations",
  ]);
  assert.deepEqual(facadeCalls[0].env, {});
  assert.equal(definitions.length, 1);
  assert.match(definitions[0].uri.fsPath, /fixtures\/modules\/package_defs\.sv$/);
  assert.equal(definitions[0].range.start.line, 0);
  assert.equal(definitions[0].range.start.character, 0);
  assert.equal(definitions[0].range.end.character, 1);
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

async function testAIStatusCommandReturnsDisabledBackendNone() {
  const handler = createCommandHandler(AI_ASSISTANT_STATUS_COMMAND, null, {});

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, AI_ASSISTANT_STATUS_COMMAND);
  assert.equal(result.status.status, "disabled");
  assert.equal(result.status.backend, "none");
  assert.equal(result.status.providerCalls, false);
  assert.equal(result.status.runtimeCalls, false);
  assert.equal(result.status.providerCallsImplemented, false);
  assert.equal(result.status.runtimeCallsImplemented, false);
  assert.equal(result.status.mcpServerImplemented, false);
  assert.deepEqual(
    result.status.allowedActions.map((action) => action.kind),
    [
      "explainDiagnostics",
      "proposePatch",
      "proposeValidationCommand",
      "summarizeLog",
      "askForMoreContext",
      "openRelatedSymbol",
    ],
  );
  assert.ok(result.status.allowedActions.every((action) => action.execution === "proposalOnly"));
  assert.ok(result.status.disallowedActions.includes("writeFile"));
  assert.ok(result.status.disallowedActions.includes("release"));
  assert.ok(result.status.disallowedActions.includes("accessSecrets"));
}

async function testAIContextBundleCommandUsesActiveEditorSelectionAndDiagnostics() {
  const document = {
    uri: { fsPath: "/repo/rtl/top.sv" },
    languageId: "systemverilog",
    getText(range) {
      assert.equal(range.start.line, 0);
      return "module top;\nendmodule\n";
    },
  };
  const selection = {
    start: { line: 0, character: 0 },
    end: { line: 1, character: 9 },
  };
  const vscodeApi = {
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3,
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo" } }],
      getWorkspaceFolder() {
        return { uri: { fsPath: "/repo" } };
      },
    },
    window: {
      activeTextEditor: {
        document,
        selection,
      },
    },
    languages: {
      getDiagnostics(uri) {
        assert.equal(uri.fsPath, "/repo/rtl/top.sv");
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 6 },
            },
            severity: 0,
            message: "missing endmodule",
            source: "pccx_ide_cli",
            code: "PCCX-SCAFFOLD-003",
          },
        ];
      },
    },
  };
  const runtime = {
    recentNavigationItems: [
      {
        name: "top",
        kind: "module",
        file: "/repo/rtl/top.sv",
        line: 1,
        column: 1,
      },
    ],
    recentCommandStatus: {
      commandId: "pccxSystemVerilog.publishCheckedExampleDiagnostics",
      ok: true,
      actionKind: "diagnostics",
      summary: "1 diagnostic(s)",
      facade: { command: "diagnostics", mode: "example" },
      diagnosticCount: 1,
      navigationItemCount: 0,
    },
  };
  const handler = createCommandHandler(AI_CONTEXT_BUNDLE_COMMAND, vscodeApi, runtime);

  const result = await handler();

  assert.equal(result.ok, true);
  assert.equal(result.commandId, AI_CONTEXT_BUNDLE_COMMAND);
  assert.equal(result.kind, "ai-context-bundle");
  assert.equal(result.status, "disabled");
  assert.equal(result.backend, "none");
  assert.equal(result.providerCalls, false);
  assert.equal(result.runtimeCalls, false);
  assert.deepEqual(result.contextBundle.selectedFile, { path: "rtl/top.sv" });
  assert.equal(result.contextBundle.selectedRange.start.line, 0);
  assert.equal(result.contextBundle.configuration.mode, "checkedExample");
  assert.equal(result.contextBundle.configuration.aiAssistant.enabled, false);
  assert.equal(result.contextBundle.diagnostics.length, 1);
  assert.equal(result.contextBundle.diagnostics[0].path, "rtl/top.sv");
  assert.equal(result.contextBundle.snippets.length, 1);
  assert.equal(result.contextBundle.snippets[0].path, "rtl/top.sv");
  assert.equal(result.contextBundle.symbols.declarations.length, 1);
  assert.equal(result.contextBundle.symbols.declarations[0].path, "rtl/top.sv");
  assert.equal(result.contextBundle.recentCommand.commandId, "pccxSystemVerilog.publishCheckedExampleDiagnostics");
  assert.doesNotMatch(JSON.stringify(result.contextBundle), /\/repo/);
}

testKnownFacadeArgs();
testUnknownCommandsRejected();
testCheckedExampleDiagnosticsCommandStaysExampleMode();
testCheckedExampleNavigationCommandStaysExampleMode();
testFacadeInvocationIsArgumentArray();
testPresenterDepsResolveRelativeDiagnosticFiles();
testNavigationLocationMapping();
testResolveCommandRequestUsesVsCodeSettings();
await testEntrypointExportsAndActivation();
await testCheckedExampleNavigationCommandReturnsLocations();
await testCheckedExampleDefinitionProviderReturnsLocations();
await testActivationRegistersCheckedExampleDefinitionProvider();
await testNoVsCodeRuntimeIsANoop();
await testCommandHandlerCanBeUsedWithoutRealVsCode();
await testAIStatusCommandReturnsDisabledBackendNone();
await testAIContextBundleCommandUsesActiveEditorSelectionAndDiagnostics();

console.log("vscode extension entrypoint tests ok");

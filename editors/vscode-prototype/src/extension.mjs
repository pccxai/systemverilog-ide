import { execFile } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMAND_IDS,
  CONFIG_KEYS,
  CONFIG_SECTION,
  buildFacadeArgsForCommand,
  defaultConfig,
  isLiveFacadeArgs,
  normalizeConfig,
} from "./config.mjs";
import {
  createCommandExecutionPlan,
  runPrototypeCommand,
} from "./command-handlers.mjs";
import {
  presentAction,
} from "./presenter.mjs";
import {
  createNavigationLocationRecords,
} from "./navigation-locations.mjs";
import {
  registerCheckedExampleDefinitionProvider,
} from "./definition-provider.mjs";

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIAGNOSTIC_FILE_ROOT = resolve(EXTENSION_ROOT, "../..");
const DEFAULT_NAVIGATION_FILE_ROOT = DEFAULT_DIAGNOSTIC_FILE_ROOT;
const DEFAULT_FACADE_PATH = resolve(EXTENSION_ROOT, "bin/pccx-vscode-prototype.mjs");
const OUTPUT_CHANNEL_NAME = "PCCX SystemVerilog IDE Prototype";
export const CHECKED_EXAMPLE_NAVIGATION_COMMAND =
  "pccxSystemVerilog.showCheckedExampleNavigation";

export {
  COMMAND_IDS,
  buildFacadeArgsForCommand,
  createNavigationLocationRecords,
  createCommandExecutionPlan,
  defaultConfig,
  normalizeConfig,
  presentAction,
  runPrototypeCommand,
};

function pathFromCommandInput(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input?.fsPath) {
    return input.fsPath;
  }
  if (input?.uri?.fsPath) {
    return input.uri.fsPath;
  }
  return null;
}

export function buildFacadeInvocationForCommand(commandId, options = {}, runtime = {}) {
  const config = normalizeConfig(options);
  const facadeArgs = buildFacadeArgsForCommand(commandId, config);
  const invocation = {
    executable: runtime.nodeExecutable ?? process.execPath,
    args: [
      runtime.facadePath ?? DEFAULT_FACADE_PATH,
      ...facadeArgs,
    ],
    shell: false,
  };

  if (isLiveFacadeArgs(facadeArgs)) {
    invocation.env = { PCCX_IDE_PYTHON: config.pythonPath };
  }

  return invocation;
}

function mergedEnv(invocation, runtime) {
  if (!invocation.env && !runtime.env) {
    return process.env;
  }
  return {
    ...process.env,
    ...(invocation.env ?? {}),
    ...(runtime.env ?? {}),
  };
}

function captureExecFile(executable, args, options = {}) {
  const execFileFn = options.execFile ?? execFile;
  return new Promise((resolveResult) => {
    execFileFn(
      executable,
      args,
      {
        cwd: options.cwd ?? EXTENSION_ROOT,
        encoding: "utf8",
        env: options.env ?? process.env,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const exitCode = error ? (typeof error.code === "number" ? error.code : null) : 0;
        resolveResult({
          ok: exitCode === 0 && !error,
          exitCode,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          error: error && typeof error.code !== "number" ? error.message : undefined,
        });
      },
    );
  });
}

export async function runFacadeInvocation(invocation, runtime = {}) {
  const result = await captureExecFile(invocation.executable, invocation.args, {
    ...runtime,
    env: mergedEnv(invocation, runtime),
  });
  if (result.ok && result.stdout.trim()) {
    try {
      result.json = JSON.parse(result.stdout);
    } catch (error) {
      result.ok = false;
      result.error = `failed to parse facade JSON stdout: ${error.message}`;
    }
  }
  return result;
}

export function readExtensionConfig(vscodeApi) {
  return normalizeConfig(readRawExtensionConfig(vscodeApi));
}

function readRawExtensionConfig(vscodeApi) {
  const settings = vscodeApi?.workspace?.getConfiguration?.(CONFIG_SECTION);
  if (!settings?.get) {
    return defaultConfig();
  }

  return Object.fromEntries(
    CONFIG_KEYS.map((key) => [key, settings.get(key)]),
  );
}

export function resolveCommandRequest(commandId, input, vscodeApi, rawConfig = readExtensionConfig(vscodeApi)) {
  const config = normalizeConfig(rawConfig);
  const explicitPath = pathFromCommandInput(input);
  const commandConfig = commandId === "pccxSystemVerilog.runDiagnosticsLive" && explicitPath
    ? normalizeConfig({ ...config, defaultSource: explicitPath })
    : config;

  buildFacadeArgsForCommand(commandId, commandConfig);
  return commandConfig;
}

export async function runFacadeForCommand(commandId, options = {}, runtime = {}) {
  const invocation = buildFacadeInvocationForCommand(commandId, options, runtime);
  return runFacadeInvocation(invocation, runtime);
}

export async function runCheckedExampleNavigationLocations(rawConfig = {}, deps = {}) {
  const result = await runPrototypeCommand(CHECKED_EXAMPLE_NAVIGATION_COMMAND, rawConfig, {
    runFacade: deps.runFacade,
  });
  if (result.ok) {
    result.locations = createNavigationLocationRecords(result.action?.items, deps);
  }
  return result;
}

function appendCommandOutput(outputChannel, commandId, result) {
  if (!outputChannel?.appendLine) {
    return;
  }

  outputChannel.appendLine(`[${commandId}]`);
  if (result.action?.summary) {
    outputChannel.appendLine(result.action.summary);
  }
  if (result.action) {
    outputChannel.appendLine(JSON.stringify(result.action, null, 2));
  }
  if (result.error) {
    outputChannel.appendLine(result.error);
  }
  outputChannel.show?.(true);
}

function facadeRunnerFromRuntime(runtime = {}) {
  return async (facadeArgs, env = {}) => {
    const invocation = {
      executable: runtime.nodeExecutable ?? process.execPath,
      args: [
        runtime.facadePath ?? DEFAULT_FACADE_PATH,
        ...facadeArgs,
      ],
      shell: false,
      env,
    };
    return runFacadeInvocation(invocation, runtime);
  };
}

function diagnosticFileForUri(file, root = DEFAULT_DIAGNOSTIC_FILE_ROOT) {
  const filePath = file == null ? "" : String(file);
  if (filePath.length === 0 || isAbsolute(filePath)) {
    return filePath;
  }
  return resolve(root, filePath);
}

export function createPresenterDeps(vscodeApi, runtime = {}) {
  const diagnosticSeverity = {
    Error: vscodeApi?.DiagnosticSeverity?.Error ?? "Error",
    Warning: vscodeApi?.DiagnosticSeverity?.Warning ?? "Warning",
    Information: vscodeApi?.DiagnosticSeverity?.Information ?? "Information",
  };

  return {
    createUri(file) {
      const filePath = diagnosticFileForUri(file, runtime.diagnosticFileRoot);
      return vscodeApi?.Uri?.file ? vscodeApi.Uri.file(filePath) : { fsPath: filePath };
    },
    createRange(startLine, startCharacter, endLine, endCharacter) {
      return typeof vscodeApi?.Range === "function"
        ? new vscodeApi.Range(startLine, startCharacter, endLine, endCharacter)
        : {
            start: { line: startLine, character: startCharacter },
            end: { line: endLine, character: endCharacter },
          };
    },
    createDiagnostic(range, message, severity) {
      return typeof vscodeApi?.Diagnostic === "function"
        ? new vscodeApi.Diagnostic(range, message, severity)
        : { range, message, severity };
    },
    createLocation(uri, range) {
      return typeof vscodeApi?.Location === "function"
        ? new vscodeApi.Location(uri, range)
        : { uri, range };
    },
    diagnosticSeverity,
    diagnosticsCollection: runtime.diagnosticsCollection,
    showInformationMessage: vscodeApi?.window?.showInformationMessage?.bind(vscodeApi.window),
    showWarningMessage: (
      vscodeApi?.window?.showWarningMessage ?? vscodeApi?.window?.showErrorMessage
    )?.bind(vscodeApi.window),
    showQuickPick: vscodeApi?.window?.showQuickPick?.bind(vscodeApi.window),
  };
}

export function createCommandHandler(commandId, vscodeApi, runtime = {}) {
  createCommandExecutionPlan(commandId, defaultConfig());
  return async (input) => {
    const returnsNavigationLocations = commandId === CHECKED_EXAMPLE_NAVIGATION_COMMAND;
    const rawConfig = readRawExtensionConfig(vscodeApi);
    const explicitPath = pathFromCommandInput(input);
    const request = commandId === "pccxSystemVerilog.runDiagnosticsLive" && explicitPath
      ? { ...rawConfig, defaultSource: explicitPath }
      : rawConfig;
    const presenterDeps = {
      ...createPresenterDeps(vscodeApi, runtime),
      ...(runtime.presenterDeps ?? {}),
    };
    const deps = {
      runFacade: runtime.runFacade ?? facadeRunnerFromRuntime(runtime),
      updateDiagnostics: (_diagnostics, action) => presentAction(action, presenterDeps),
      showNavigationItems: returnsNavigationLocations
        ? undefined
        : (_items, action) => presentAction(action, presenterDeps),
    };
    const result = returnsNavigationLocations
      ? await runCheckedExampleNavigationLocations(request, {
        ...presenterDeps,
        runFacade: deps.runFacade,
        fileRoot: runtime.navigationFileRoot ?? DEFAULT_NAVIGATION_FILE_ROOT,
      })
      : await runPrototypeCommand(commandId, request, deps);
    if (!result.ok) {
      presenterDeps.showWarningMessage?.(result.error, result);
    }
    appendCommandOutput(runtime.outputChannel, commandId, result);
    return result;
  };
}

async function loadVscodeApi() {
  try {
    return await import("vscode");
  } catch {
    return null;
  }
}

export async function activate(context, injectedVscodeApi = null, runtime = {}) {
  const vscodeApi = injectedVscodeApi ?? await loadVscodeApi();
  if (!vscodeApi?.commands?.registerCommand) {
    return { registered: [] };
  }

  const outputChannel = vscodeApi.window?.createOutputChannel?.(OUTPUT_CHANNEL_NAME);
  const diagnosticsCollection = runtime.diagnosticsCollection
    ?? vscodeApi.languages?.createDiagnosticCollection?.(OUTPUT_CHANNEL_NAME);
  const commandRuntime = { ...runtime, diagnosticsCollection, outputChannel };
  const registered = [];
  const definitionProviders = [];

  for (const commandId of COMMAND_IDS) {
    const disposable = vscodeApi.commands.registerCommand(
      commandId,
      createCommandHandler(commandId, vscodeApi, commandRuntime),
    );
    context?.subscriptions?.push?.(disposable);
    registered.push(commandId);
  }

  definitionProviders.push(registerCheckedExampleDefinitionProvider(vscodeApi, context, {
    runCheckedExampleNavigationLocations() {
      const rawConfig = readRawExtensionConfig(vscodeApi);
      const presenterDeps = {
        ...createPresenterDeps(vscodeApi, commandRuntime),
        ...(commandRuntime.presenterDeps ?? {}),
      };
      return runCheckedExampleNavigationLocations(rawConfig, {
        ...presenterDeps,
        runFacade: commandRuntime.runFacade ?? facadeRunnerFromRuntime(commandRuntime),
        fileRoot: commandRuntime.navigationFileRoot ?? DEFAULT_NAVIGATION_FILE_ROOT,
      });
    },
  }));

  if (outputChannel) {
    context?.subscriptions?.push?.(outputChannel);
  }
  if (diagnosticsCollection && diagnosticsCollection !== runtime.diagnosticsCollection) {
    context?.subscriptions?.push?.(diagnosticsCollection);
  }
  return { registered, definitionProviders };
}

export function deactivate() {}

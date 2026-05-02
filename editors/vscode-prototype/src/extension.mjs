import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
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

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FACADE_PATH = resolve(EXTENSION_ROOT, "bin/pccx-vscode-prototype.mjs");
const OUTPUT_CHANNEL_NAME = "PCCX SystemVerilog IDE Prototype";

export {
  COMMAND_IDS,
  buildFacadeArgsForCommand,
  createCommandExecutionPlan,
  defaultConfig,
  normalizeConfig,
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

export function createCommandHandler(commandId, vscodeApi, runtime = {}) {
  createCommandExecutionPlan(commandId, defaultConfig());
  return async (input) => {
    const rawConfig = readRawExtensionConfig(vscodeApi);
    const explicitPath = pathFromCommandInput(input);
    const request = commandId === "pccxSystemVerilog.runDiagnosticsLive" && explicitPath
      ? { ...rawConfig, defaultSource: explicitPath }
      : rawConfig;
    const deps = {
      runFacade: runtime.runFacade ?? facadeRunnerFromRuntime(runtime),
      showInformationMessage: vscodeApi?.window?.showInformationMessage?.bind(vscodeApi.window),
      showWarningMessage: (
        vscodeApi?.window?.showWarningMessage ?? vscodeApi?.window?.showErrorMessage
      )?.bind(vscodeApi.window),
      updateDiagnostics: runtime.updateDiagnostics,
      showNavigationItems: runtime.showNavigationItems,
    };
    const result = await runPrototypeCommand(commandId, request, deps);
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
  const commandRuntime = { ...runtime, outputChannel };
  const registered = [];

  for (const commandId of COMMAND_IDS) {
    const disposable = vscodeApi.commands.registerCommand(
      commandId,
      createCommandHandler(commandId, vscodeApi, commandRuntime),
    );
    context?.subscriptions?.push?.(disposable);
    registered.push(commandId);
  }

  if (outputChannel) {
    context?.subscriptions?.push?.(outputChannel);
  }
  return { registered };
}

export function deactivate() {}

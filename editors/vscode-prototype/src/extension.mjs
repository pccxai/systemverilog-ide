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

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FACADE_PATH = resolve(EXTENSION_ROOT, "bin/pccx-vscode-prototype.mjs");
const OUTPUT_CHANNEL_NAME = "PCCX SystemVerilog IDE Prototype";

export {
  COMMAND_IDS,
  buildFacadeArgsForCommand,
  defaultConfig,
  normalizeConfig,
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
  const settings = vscodeApi?.workspace?.getConfiguration?.(CONFIG_SECTION);
  if (!settings?.get) {
    return defaultConfig();
  }

  return normalizeConfig(Object.fromEntries(
    CONFIG_KEYS.map((key) => [key, settings.get(key)]),
  ));
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

export function summarizeFacadeResult(commandId, result) {
  if (!result.ok) {
    return `PCCX facade command failed for ${commandId}`;
  }

  if (Array.isArray(result.json?.diagnostics)) {
    return `PCCX facade returned ${result.json.diagnostics.length} diagnostics`;
  }
  if (Array.isArray(result.json?.items)) {
    return `PCCX facade returned ${result.json.items.length} navigation items`;
  }
  return "PCCX facade command completed";
}

function appendFacadeOutput(outputChannel, commandId, result) {
  if (!outputChannel?.appendLine) {
    return;
  }

  outputChannel.appendLine(`[${commandId}]`);
  if (result.stdout) {
    outputChannel.appendLine(result.stdout.trimEnd());
  }
  if (result.stderr) {
    outputChannel.appendLine(result.stderr.trimEnd());
  }
  if (result.error) {
    outputChannel.appendLine(result.error);
  }
  outputChannel.show?.(true);
}

export function createCommandHandler(commandId, vscodeApi, runtime = {}) {
  buildFacadeArgsForCommand(commandId, defaultConfig());
  return async (input) => {
    let result;
    try {
      const request = resolveCommandRequest(commandId, input, vscodeApi);
      const run = runtime.runFacadeForCommand ?? runFacadeForCommand;
      result = await run(commandId, request, runtime);
    } catch (error) {
      result = {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        error: error.message,
      };
    }
    appendFacadeOutput(runtime.outputChannel, commandId, result);

    const message = summarizeFacadeResult(commandId, result);
    if (result.ok) {
      vscodeApi?.window?.showInformationMessage?.(message);
    } else {
      vscodeApi?.window?.showErrorMessage?.(message);
    }
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

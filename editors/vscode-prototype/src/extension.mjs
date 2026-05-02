import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FACADE_PATH = resolve(EXTENSION_ROOT, "bin/pccx-vscode-prototype.mjs");
const OUTPUT_CHANNEL_NAME = "PCCX SystemVerilog IDE Prototype";

export const COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showDiagnosticsExample",
  "pccxSystemVerilog.showNavigationExample",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
]);

const COMMAND_CONFIGS = Object.freeze({
  "pccxSystemVerilog.showDiagnosticsExample": Object.freeze({
    facadeKind: "diagnostics",
    mode: "example",
    source: "check-missing-endmodule",
  }),
  "pccxSystemVerilog.showNavigationExample": Object.freeze({
    facadeKind: "navigation",
    mode: "example",
    source: "declarations",
  }),
  "pccxSystemVerilog.runDiagnosticsLive": Object.freeze({
    facadeKind: "diagnostics",
    mode: "live",
    pathOption: "--from-check",
    requiredPathField: "targetFile",
  }),
  "pccxSystemVerilog.runNavigationLive": Object.freeze({
    facadeKind: "navigation",
    mode: "live",
    pathOption: "--declarations",
    requiredPathField: "targetPath",
  }),
});

function commandConfig(commandId) {
  const config = COMMAND_CONFIGS[commandId];
  if (!config) {
    throw new Error(`unknown PCCX SystemVerilog command: ${commandId}`);
  }
  return config;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is required`);
  }
  return value;
}

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

export function buildFacadeArgsForCommand(commandId, options = {}) {
  const config = commandConfig(commandId);
  const args = [config.facadeKind, "--mode", config.mode];

  if (config.mode === "example") {
    return [...args, "--source", config.source];
  }

  return [
    ...args,
    config.pathOption,
    requiredString(options[config.requiredPathField], config.requiredPathField),
  ];
}

export function buildFacadeInvocationForCommand(commandId, options = {}, runtime = {}) {
  return {
    executable: runtime.nodeExecutable ?? process.execPath,
    args: [
      runtime.facadePath ?? DEFAULT_FACADE_PATH,
      ...buildFacadeArgsForCommand(commandId, options),
    ],
    shell: false,
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
  const result = await captureExecFile(invocation.executable, invocation.args, runtime);
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

export function resolveCommandRequest(commandId, input, vscodeApi) {
  commandConfig(commandId);
  const explicitPath = pathFromCommandInput(input);

  if (commandId === "pccxSystemVerilog.runDiagnosticsLive") {
    return {
      targetFile: explicitPath ?? vscodeApi?.window?.activeTextEditor?.document?.uri?.fsPath,
    };
  }

  if (commandId === "pccxSystemVerilog.runNavigationLive") {
    return {
      targetPath: explicitPath ?? vscodeApi?.workspace?.workspaceFolders?.[0]?.uri?.fsPath,
    };
  }

  return {};
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
  commandConfig(commandId);
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

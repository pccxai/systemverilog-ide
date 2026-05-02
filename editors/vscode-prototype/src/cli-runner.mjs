import { execFile } from "node:child_process";
import { dirname, delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const LOCATE_KINDS = new Set(["module", "package", "interface", "any"]);

function captureExec(command, args, options) {
  return new Promise((resolveResult) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        encoding: "utf8",
        env: options.env,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          resolveResult({
            ok: false,
            exitCode: null,
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            error: error.message,
          });
          return;
        }

        const exitCode = error && typeof error.code === "number" ? error.code : 0;
        resolveResult({
          ok: exitCode === 0,
          exitCode,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        });
      },
    );
  });
}

async function commandExists(command, cwd, env) {
  const result = await captureExec(command, ["--version"], { cwd, env });
  return result.exitCode === 0;
}

async function findPython(cwd, env) {
  if (env.PCCX_IDE_PYTHON) {
    return env.PCCX_IDE_PYTHON;
  }
  if (await commandExists("python", cwd, env)) {
    return "python";
  }
  if (await commandExists("python3", cwd, env)) {
    return "python3";
  }
  return null;
}

function cliEnv(repoRoot, baseEnv) {
  const env = { ...baseEnv };
  const srcPath = join(repoRoot, "src");
  env.PYTHONPATH = env.PYTHONPATH ? `${srcPath}${delimiter}${env.PYTHONPATH}` : srcPath;
  return env;
}

function structuredError(message) {
  return {
    ok: false,
    exitCode: null,
    stdout: "",
    stderr: "",
    error: message,
  };
}

async function runKnownJsonFlow(args, options = {}) {
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : ROOT;
  const env = cliEnv(repoRoot, { ...process.env, ...(options.env ?? {}) });
  const python = await findPython(repoRoot, env);

  if (!python) {
    return structuredError("python or python3 is required to run pccx_ide_cli");
  }

  return withParsedJson(await captureExec(
    python,
    ["-m", "pccx_ide_cli", ...args],
    { cwd: repoRoot, env },
  ));
}

export function repoRoot() {
  return ROOT;
}

export function withParsedJson(result) {
  const parsed = { ...result };
  if (parsed.stdout.trim()) {
    try {
      parsed.json = JSON.parse(parsed.stdout);
    } catch (error) {
      parsed.ok = false;
      parsed.error = `failed to parse JSON stdout: ${error.message}`;
    }
  }
  return parsed;
}

export function runProblemsFromCheckPayload(filePath, options = {}) {
  return runKnownJsonFlow(
    ["problems", "from-check", filePath, "--format", "json"],
    options,
  );
}

export function runProblemsFromXsimLogPayload(logPath, options = {}) {
  return runKnownJsonFlow(
    ["problems", "from-xsim-log", logPath, "--format", "json"],
    options,
  );
}

export function runDeclarationsPayload(path, options = {}) {
  return runKnownJsonFlow(
    ["declarations", path, "--format", "json"],
    options,
  );
}

export function runLocateDeclarationPayload(path, name, kind = "module", options = {}) {
  if (!LOCATE_KINDS.has(kind)) {
    return Promise.resolve(structuredError(`unsupported locate kind: ${kind}`));
  }

  return runKnownJsonFlow(
    ["locate", path, name, "--kind", kind, "--format", "json"],
    options,
  );
}

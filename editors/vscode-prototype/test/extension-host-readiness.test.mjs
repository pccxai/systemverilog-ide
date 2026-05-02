import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_ROOT = resolve(ROOT, "editors/vscode-prototype");
const SCRIPT = resolve(ROOT, "scripts/vscode-extension-host-smoke.sh");

async function readText(path) {
  return readFile(path, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function testPinnedRuntimeDependencyOnly() {
  const manifest = await readJson(resolve(EXTENSION_ROOT, "package.json"));
  const lockfile = await readJson(resolve(EXTENSION_ROOT, "package-lock.json"));
  const deps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  };

  assert.equal(manifest.dependencies, undefined);
  assert.deepEqual(manifest.devDependencies, {
    "@vscode/test-electron": "2.5.2",
  });
  assert.equal(deps["@vscode/test-electron"], "2.5.2");
  assert.equal(deps.vscode, undefined);
  assert.equal(await pathExists(resolve(ROOT, "package-lock.json")), false);
  assert.equal(lockfile.packages[""].devDependencies["@vscode/test-electron"], "2.5.2");
  assert.equal(lockfile.packages["node_modules/@vscode/test-electron"].version, "2.5.2");
  assert.match(
    lockfile.packages["node_modules/@vscode/test-electron"].integrity,
    /^sha512-/,
  );
}

function testGuardedScriptDefault() {
  const result = spawnSync("bash", [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PCCX_RUN_EXTENSION_HOST_SMOKE: "",
    },
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 2);
  assert.match(output, /Extension Host smoke is available but not enabled by default/);
  assert.match(output, /Default coverage remains static\/mock-only/);
  assert.match(output, /opt-in local runtime check/);
  assert.match(output, /PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts\/vscode-extension-host-smoke\.sh/);
  assert.match(output, /npm ci --prefix editors\/vscode-prototype/);
  assert.match(output, /VS Code 1\.90\.2/);
  assert.match(output, /@vscode\/test-electron/);
  assert.match(output, /do not add vsce/);
}

async function testReadinessDocsAndCiPolicy() {
  const readme = await readText(resolve(EXTENSION_ROOT, "README.md"));
  const readiness = await readText(resolve(EXTENSION_ROOT, "docs/EXTENSION_HOST_READINESS.md"));
  const ci = await readText(resolve(ROOT, ".github/workflows/ci.yml"));
  const extensionEntrypoint = await readText(resolve(EXTENSION_ROOT, "src/extension.mjs"));
  const extensionWrapper = await readText(resolve(EXTENSION_ROOT, "src/extension.cjs"));

  assert.match(readme, /experimental local VS Code prototype/i);
  assert.match(readme, /mostly static\/mock tests/i);
  assert.match(readme, /limited opt-in\s+Extension Host runtime smoke/i);
  assert.match(readiness, /Option A/i);
  assert.match(readiness, /local-only Extension Host runtime smoke/i);
  assert.match(readiness, /not a product claim/i);
  assert.match(readiness, /PCCX_RUN_EXTENSION_HOST_SMOKE=1/);
  assert.match(readiness, /does not imply\s+marketplace readiness/i);
  assert.match(readiness, /(?:not LSP|LSP support|LSP server)/i);
  assert.match(readiness, /(?:not a stable ABI\/API|stable ABI\/API claim)/i);
  assert.match(readiness, /facade boundary/i);
  assert.match(`${readme}\n${readiness}`, /DiagnosticCollection/);
  assert.match(`${readme}\n${readiness}`, /showCheckedExampleNavigation/);
  assert.match(`${readme}\n${readiness}`, /command-first navigation/i);
  assert.match(`${readme}\n${readiness}`, /no LSP provider/i);
  assert.match(`${readme}\n${readiness}`, /host theme first/i);
  assert.match(`${readme}\n${readiness}`, /not a completed\s+custom theme system/i);
  assert.doesNotMatch(ci, /vscode-extension-host-smoke\.sh/);
  assert.doesNotMatch(ci, /PCCX_RUN_EXTENSION_HOST_SMOKE/);
  assert.doesNotMatch(extensionEntrypoint, /pccx_ide_cli/);
  assert.doesNotMatch(extensionWrapper, /pccx_ide_cli/);
  assert.match(extensionWrapper, /require\("vscode"\)/);
  assert.match(extensionWrapper, /import\("\.\/extension\.mjs"\)/);
}

async function testRuntimeRunnerIsPinnedAndBounded() {
  const script = await readText(SCRIPT);
  const runnerPath = resolve(EXTENSION_ROOT, "test/extension-host/run-extension-host-smoke.mjs");
  const suitePath = resolve(EXTENSION_ROOT, "test/extension-host/smoke-suite.cjs");
  const runner = await readText(runnerPath);
  const suite = await readText(suitePath);

  assert.match(script, /PCCX_RUN_EXTENSION_HOST_SMOKE/);
  assert.match(script, /run-extension-host-smoke\.mjs/);
  assert.match(script, /npm ci --prefix editors\/vscode-prototype/);
  assert.match(runner, /VSCODE_TEST_VERSION = "1\.90\.2"/);
  assert.match(runner, /runTests/);
  assert.match(runner, /extensionDevelopmentPath/);
  assert.match(runner, /\.vscode-test/);
  assert.match(runner, /--extensions-dir=/);
  assert.match(runner, /--user-data-dir=/);
  assert.match(suite, /getCommands/);
  assert.match(suite, /publishCheckedExampleDiagnostics/);
  assert.match(suite, /showCheckedExampleNavigation/);
  assert.match(suite, /getDiagnostics/);
  assert.match(suite, /DiagnosticSeverity\.Error/);
  assert.match(suite, /navigationResult\.locations/);
  assert.match(suite, /vscode\.Location/);
  assert.doesNotMatch(suite, /executeCommand\(\s*"pccxSystemVerilog\.runDiagnosticsLive"/);
  assert.doesNotMatch(suite, /executeCommand\(\s*"pccxSystemVerilog\.runNavigationLive"/);
}

await testPinnedRuntimeDependencyOnly();
testGuardedScriptDefault();
await testReadinessDocsAndCiPolicy();
await testRuntimeRunnerIsPinnedAndBounded();

console.log("vscode extension host readiness tests ok");

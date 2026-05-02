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

async function testNoRuntimeDependencyChurn() {
  const manifest = JSON.parse(await readText(resolve(EXTENSION_ROOT, "package.json")));
  const deps = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  };

  assert.equal(deps["@vscode/test-electron"], undefined);
  assert.equal(deps.vscode, undefined);
  assert.equal(await pathExists(resolve(ROOT, "package-lock.json")), false);
  assert.equal(await pathExists(resolve(EXTENSION_ROOT, "package-lock.json")), false);
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
  assert.match(output, /Extension Host smoke is not enabled yet/);
  assert.match(output, /static\/mock-only/);
  assert.match(output, /no real VS Code Extension Host coverage is claimed/);
  assert.match(output, /PCCX_RUN_EXTENSION_HOST_SMOKE=1/);
  assert.match(output, /@vscode\/test-electron/);
  assert.match(output, /do not add vsce/);
}

async function testReadinessDocsAndCiPolicy() {
  const readme = await readText(resolve(EXTENSION_ROOT, "README.md"));
  const readiness = await readText(resolve(EXTENSION_ROOT, "docs/EXTENSION_HOST_READINESS.md"));
  const bridgeContract = await readText(resolve(ROOT, "docs/EDITOR_BRIDGE_CONTRACT.md"));
  const ci = await readText(resolve(ROOT, ".github/workflows/ci.yml"));

  assert.match(readme, /experimental local VS Code prototype/i);
  assert.match(readme, /mostly static\/mock tests/i);
  assert.match(readme, /guarded local-only\s+Extension Host smoke/i);
  assert.match(readiness, /Option B/i);
  assert.match(readiness, /guarded local-only scaffold/i);
  assert.match(readiness, /PCCX_RUN_EXTENSION_HOST_SMOKE=1/);
  assert.match(readiness, /No real VS Code Extension Host coverage is claimed/i);
  assert.match(bridgeContract, /guarded local-only\s+Extension Host smoke scaffold/i);
  assert.doesNotMatch(ci, /vscode-extension-host-smoke\.sh/);
}

async function testGuardScriptNamesFutureRunnerButDoesNotProvideIt() {
  const script = await readText(SCRIPT);

  assert.match(script, /PCCX_RUN_EXTENSION_HOST_SMOKE/);
  assert.match(script, /run-extension-host-smoke\.mjs/);
  assert.equal(
    await pathExists(resolve(EXTENSION_ROOT, "test/extension-host/run-extension-host-smoke.mjs")),
    false,
  );
}

await testNoRuntimeDependencyChurn();
testGuardedScriptDefault();
await testReadinessDocsAndCiPolicy();
await testGuardScriptNamesFutureRunnerButDoesNotProvideIt();

console.log("vscode extension host readiness tests ok");

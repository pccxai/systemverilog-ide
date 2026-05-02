import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runTests } from "@vscode/test-electron";

import { COMMAND_IDS } from "../../src/config.mjs";

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = resolve(EXTENSION_ROOT, "../..");
const VSCODE_TEST_VERSION = "1.90.2";
const LIVE_WORKSPACE_FIXTURE = resolve(
  EXTENSION_ROOT,
  "test/fixtures/live-workspace",
);

async function main() {
  await runTests({
    version: VSCODE_TEST_VERSION,
    cachePath: resolve(EXTENSION_ROOT, ".vscode-test"),
    extensionDevelopmentPath: EXTENSION_ROOT,
    extensionTestsPath: resolve(EXTENSION_ROOT, "test/extension-host/smoke-suite.cjs"),
    launchArgs: [
      LIVE_WORKSPACE_FIXTURE,
      `--extensions-dir=${resolve(EXTENSION_ROOT, ".vscode-test/extensions")}`,
      `--user-data-dir=${resolve(EXTENSION_ROOT, ".vscode-test/user-data")}`,
      "--disable-extensions",
    ],
    extensionTestsEnv: {
      PCCX_EXTENSION_ROOT: EXTENSION_ROOT,
      PCCX_REPO_ROOT: ROOT,
      PCCX_EXPECTED_COMMAND_IDS: COMMAND_IDS.join(","),
      PCCX_LIVE_WORKSPACE_FIXTURE: LIVE_WORKSPACE_FIXTURE,
      PCCX_VSCODE_TEST_VERSION: VSCODE_TEST_VERSION,
    },
  });
}

await main();

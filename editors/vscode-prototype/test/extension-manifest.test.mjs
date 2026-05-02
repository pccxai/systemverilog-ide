import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_ROOT = resolve(ROOT, "editors/vscode-prototype");
const COMMAND_IDS = [
  "pccxSystemVerilog.showDiagnosticsExample",
  "pccxSystemVerilog.showNavigationExample",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
];

async function readText(path) {
  return readFile(path, "utf8");
}

async function readPackageJson() {
  return JSON.parse(await readText(resolve(EXTENSION_ROOT, "package.json")));
}

function allManifestStrings(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      allManifestStrings(item, acc);
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      allManifestStrings(item, acc);
    }
  }
  return acc;
}

async function testPackageManifestShape() {
  const manifest = await readPackageJson();

  assert.equal(manifest.private, true);
  assert.equal(manifest.name, "pccx-systemverilog-ide-prototype");
  assert.equal(manifest.displayName, "PCCX SystemVerilog IDE Prototype");
  assert.match(manifest.description, /experimental local VS Code extension scaffold/i);
  assert.match(manifest.description, /not published/i);
  assert.doesNotMatch(manifest.description, /marketplace/i);
  assert.ok(manifest.engines?.vscode);
  assert.equal(manifest.main, "./src/extension.cjs");
}

async function testNoMarketplacePublishingShape() {
  const manifest = await readPackageJson();
  const manifestStrings = allManifestStrings(manifest).join("\n");

  assert.equal(Object.hasOwn(manifest, "publisher"), false);
  assert.equal(Object.hasOwn(manifest, "galleryBanner"), false);
  assert.doesNotMatch(manifestStrings, /\bvsce\b/i);
  assert.equal(manifest.scripts, undefined);
  assert.equal(manifest.scripts?.publish, undefined);
  assert.equal(manifest.scripts?.package, undefined);
  assert.equal(manifest.dependencies, undefined);
  assert.deepEqual(manifest.devDependencies, {
    "@vscode/test-electron": "2.5.2",
  });
}

async function testCommandContributions() {
  const manifest = await readPackageJson();
  const contributedCommands = new Set(
    manifest.contributes?.commands?.map((command) => command.command),
  );
  const activationEvents = new Set(manifest.activationEvents);
  const commandIds = manifest.contributes?.commands?.map((command) => command.command);

  assert.deepEqual(commandIds, COMMAND_IDS);
  assert.deepEqual(
    manifest.activationEvents,
    COMMAND_IDS.map((commandId) => `onCommand:${commandId}`),
  );
  for (const commandId of COMMAND_IDS) {
    assert.ok(contributedCommands.has(commandId), `${commandId} missing from contributes.commands`);
    assert.ok(
      activationEvents.has(`onCommand:${commandId}`),
      `${commandId} missing activation event`,
    );
  }
  assert.equal(contributedCommands.size, COMMAND_IDS.length);
}

async function testDocsKeepExperimentalScope() {
  const readme = await readText(resolve(EXTENSION_ROOT, "README.md"));
  const contract = await readText(resolve(ROOT, "docs/EDITOR_BRIDGE_CONTRACT.md"));
  const combined = `${readme}\n${contract}`;

  assert.match(combined, /experimental local VS Code extension scaffold/i);
  assert.match(combined, /not published/i);
  assert.match(combined, /not marketplace-ready/i);
  assert.match(combined, /no LSP/i);
  assert.match(combined, /not a stable ABI\/API/i);
  assert.match(combined, /static\/mock tests/i);
  assert.match(combined, /limited opt-in Extension Host runtime smoke/i);
  assert.match(combined, /not a product claim/i);
}

await testPackageManifestShape();
await testNoMarketplacePublishingShape();
await testCommandContributions();
await testDocsKeepExperimentalScope();

console.log("vscode extension manifest tests ok");

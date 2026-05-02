import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_ROOT = resolve(ROOT, "editors/vscode-prototype");

async function readText(path) {
  return readFile(path, "utf8");
}

async function readPackageJson() {
  return JSON.parse(await readText(resolve(EXTENSION_ROOT, "package.json")));
}

async function testNoDirectAiProviderOrNetworkCalls() {
  const sourceFiles = [
    "src/ai-assistant-boundary.mjs",
    "src/context-bundle.mjs",
    "src/command-handlers.mjs",
    "src/extension.mjs",
    "src/definition-provider.mjs",
  ];
  const combined = (await Promise.all(
    sourceFiles.map((file) => readText(resolve(EXTENSION_ROOT, file))),
  )).join("\n");

  assert.doesNotMatch(combined, /\bfetch\s*\(/);
  assert.doesNotMatch(combined, /XMLHttpRequest/);
  assert.doesNotMatch(combined, /node:https|node:http/);
  assert.doesNotMatch(combined, /\b(?:openai|anthropic|gemini)\b/i);
  assert.doesNotMatch(combined, /chat\.completions|responses\.create/i);
}

async function testNoLauncherOrMcpRuntimeImplementation() {
  const manifest = await readPackageJson();
  const source = await readText(resolve(EXTENSION_ROOT, "src/ai-assistant-boundary.mjs"));
  const packageStrings = JSON.stringify({
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
  });

  assert.doesNotMatch(source, /execFile|spawn|pccx-llm-launcher.*(?:request|connect|run)/i);
  assert.doesNotMatch(packageStrings, /modelcontextprotocol|mcp-server|llm-launcher/i);
}

async function testNoDirectCliCallsFromUiOrProviderLayers() {
  const uiLayerFiles = [
    "src/extension.mjs",
    "src/extension.cjs",
    "src/command-handlers.mjs",
    "src/definition-provider.mjs",
    "src/presenter.mjs",
  ];
  const combined = (await Promise.all(
    uiLayerFiles.map((file) => readText(resolve(EXTENSION_ROOT, file))),
  )).join("\n");

  assert.doesNotMatch(combined, /pccx_ide_cli/);
  assert.doesNotMatch(combined, /LanguageClient|vscode-languageclient/);
}

async function testNoPackagingPublisherOrLspDependencies() {
  const manifest = await readPackageJson();
  const manifestText = JSON.stringify(manifest);

  assert.equal(Object.hasOwn(manifest, "publisher"), false);
  assert.equal(Object.hasOwn(manifest, "galleryBanner"), false);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts, undefined);
  assert.doesNotMatch(manifestText, /\bvsce\b/i);
  assert.doesNotMatch(manifestText, /vscode-languageclient|LanguageClient/);
}

await testNoDirectAiProviderOrNetworkCalls();
await testNoLauncherOrMcpRuntimeImplementation();
await testNoDirectCliCallsFromUiOrProviderLayers();
await testNoPackagingPublisherOrLspDependencies();

console.log("vscode static boundary tests ok");

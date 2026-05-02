import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
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

async function listFiles(root, options = {}) {
  const skipDirs = new Set(options.skipDirs ?? [".git", ".vscode-test", "node_modules"]);
  const allowedExtensions = options.allowedExtensions ?? null;
  const results = [];
  async function visit(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          await visit(path);
        }
      } else if (!allowedExtensions || allowedExtensions.some((ext) => path.endsWith(ext))) {
        results.push(path);
      }
    }
  }
  await visit(root);
  return results.sort();
}

async function readCombined(paths) {
  return (await Promise.all(paths.map((path) => readText(path)))).join("\n");
}

async function extensionSourceFiles() {
  return [
    ...await listFiles(resolve(EXTENSION_ROOT, "src"), {
      allowedExtensions: [".mjs", ".cjs", ".js"],
    }),
    ...await listFiles(resolve(EXTENSION_ROOT, "bin"), {
      allowedExtensions: [".mjs", ".cjs", ".js"],
    }),
  ];
}

async function testNoDirectAiProviderOrNetworkCalls() {
  const combined = await readCombined(await extensionSourceFiles());

  assert.doesNotMatch(combined, /\bfetch\s*\(/);
  assert.doesNotMatch(combined, /XMLHttpRequest/);
  assert.doesNotMatch(combined, /\bWebSocket\b/);
  assert.doesNotMatch(combined, /\bEventSource\b/);
  assert.doesNotMatch(combined, /node:https|node:http/);
  assert.doesNotMatch(combined, /node:net|node:tls/);
  assert.doesNotMatch(combined, /\b(?:openai|anthropic|gemini)\b/i);
  assert.doesNotMatch(combined, /chat\.completions|responses\.create/i);
}

async function testNoLauncherOrMcpRuntimeImplementation() {
  const manifest = await readPackageJson();
  const source = await readCombined(await extensionSourceFiles());
  const packageStrings = JSON.stringify({
    dependencies: manifest.dependencies,
    devDependencies: manifest.devDependencies,
  });

  assert.doesNotMatch(
    source,
    /(?:execFile|spawn|request|connect|run)[\s\S]{0,120}pccx-llm-launcher|pccx-llm-launcher[\s\S]{0,120}(?:execFile|spawn|request|connect|run)/i,
  );
  assert.doesNotMatch(source, /\bMcpServer\s*\(|modelcontextprotocol|mcp-server/i);
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
  const repoPolicyFiles = [
    ...await listFiles(resolve(ROOT, "scripts"), {
      allowedExtensions: [".sh", ".mjs", ".js", ".py"],
    }),
    ...await listFiles(resolve(ROOT, ".github"), {
      allowedExtensions: [".yml", ".yaml"],
    }),
  ];
  const policyText = `${manifestText}\n${await readCombined(repoPolicyFiles)}`;

  assert.equal(Object.hasOwn(manifest, "publisher"), false);
  assert.equal(Object.hasOwn(manifest, "galleryBanner"), false);
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.scripts, undefined);
  assert.doesNotMatch(policyText, /\bvsce\s+(?:package|publish|login|create-publisher)\b/i);
  assert.doesNotMatch(manifestText, /vscode-languageclient|LanguageClient/);
}

async function testNoDirectShellInterpolation() {
  const source = await readCombined([
    ...await extensionSourceFiles(),
    ...await listFiles(resolve(ROOT, "src"), {
      allowedExtensions: [".py"],
    }),
  ]);

  assert.doesNotMatch(source, /\bexec\s*\(/);
  assert.doesNotMatch(source, /shell\s*:\s*true/);
  assert.doesNotMatch(source, /shell\s*=\s*True/);
}

async function testNoPositiveReadinessClaims() {
  const files = [
    ...await listFiles(ROOT, {
      allowedExtensions: [".md", ".sh", ".yml", ".yaml", ".py", ".mjs", ".cjs", ".js", ".json"],
    }),
  ].filter((path) => (
    !path.includes("/package-lock.json") &&
    !path.includes("/tests/") &&
    !path.endsWith("/editors/vscode-prototype/test/static-boundary.test.mjs")
  ));
  const positiveClaim =
    /\b(?:production[- ]ready|(?<!pre-)stable API|(?<!pre-)stable ABI|(?<!pre-)stable diagnostics envelope|marketplace-ready|complete AI integration)\b/i;
  const negation = /\b(?:no|not|never|without|does not|is not|are not|avoid|do not)\b/i;
  const violations = [];

  for (const file of files) {
    const lines = (await readText(file)).split(/\r?\n/);
    lines.forEach((line, index) => {
      const context = [
        lines[index - 2] ?? "",
        lines[index - 1] ?? "",
        line,
        lines[index + 1] ?? "",
      ].join(" ");
      if (positiveClaim.test(line) && !negation.test(context)) {
        violations.push(`${file}:${index + 1}: ${line}`);
      }
    });
  }

  assert.deepEqual(violations, []);
}

await testNoDirectAiProviderOrNetworkCalls();
await testNoLauncherOrMcpRuntimeImplementation();
await testNoDirectCliCallsFromUiOrProviderLayers();
await testNoPackagingPublisherOrLspDependencies();
await testNoDirectShellInterpolation();
await testNoPositiveReadinessClaims();

console.log("vscode static boundary tests ok");

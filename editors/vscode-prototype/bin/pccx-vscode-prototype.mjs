#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  payloadToNavigationItems,
  problemsPayloadToDiagnostics,
  readJsonPayload,
} from "../src/adapter.mjs";
import {
  getDeclarations,
  getProblemsFromCheck,
  getProblemsFromXsimLog,
  locateDeclaration,
} from "../src/live-adapter.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const EXAMPLES = resolve(ROOT, "docs/examples/editor-bridge");
const LOCATE_KINDS = new Set(["module", "package", "interface", "any"]);

const DIAGNOSTIC_EXAMPLES = new Map([
  ["check-ok", "problems-check-ok.example.json"],
  ["check-missing-endmodule", "problems-check-missing-endmodule.example.json"],
  ["xsim-mixed", "problems-xsim-mixed.example.json"],
]);

const NAVIGATION_EXAMPLES = new Map([
  ["declarations", "declarations.example.json"],
  ["locate-module", "locate-module.example.json"],
  ["locate-package", "locate-package.example.json"],
  ["locate-interface", "locate-interface.example.json"],
]);

function usage() {
  return [
    "usage:",
    "  node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics --mode example --source check-missing-endmodule",
    "  node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics --mode live --from-check <sv-file>",
    "  node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics --mode live --from-xsim-log <log-file>",
    "  node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation --mode example --source declarations",
    "  node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation --mode live --declarations <path>",
    "  node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation --mode live --locate <path> <name> --kind <kind>",
  ].join("\n");
}

function fail(message, exitCode = 2) {
  process.stderr.write(`error: ${message}\n${usage()}\n`);
  return exitCode;
}

function takeValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function parseOptions(argv) {
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mode") {
      options.mode = takeValue(argv, i, arg);
      i += 1;
    } else if (arg === "--source") {
      options.source = takeValue(argv, i, arg);
      i += 1;
    } else if (arg === "--from-check") {
      options.fromCheck = takeValue(argv, i, arg);
      i += 1;
    } else if (arg === "--from-xsim-log") {
      options.fromXsimLog = takeValue(argv, i, arg);
      i += 1;
    } else if (arg === "--declarations") {
      options.declarations = takeValue(argv, i, arg);
      i += 1;
    } else if (arg === "--locate") {
      const path = takeValue(argv, i, arg);
      const name = argv[i + 2];
      if (!name || name.startsWith("--")) {
        throw new Error("--locate requires a path and name");
      }
      options.locate = { path, name };
      i += 2;
    } else if (arg === "--kind") {
      options.kind = takeValue(argv, i, arg);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }

  return options;
}

function exactlyOne(values) {
  return values.filter(Boolean).length === 1;
}

function hasAny(values) {
  return values.some(Boolean);
}

function emitJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function outputPayload(kind, mode, records) {
  if (kind === "diagnostics") {
    return {
      tool: "pccx-vscode-prototype",
      kind: "vscode-diagnostics",
      mode,
      diagnostics: records,
    };
  }

  return {
    tool: "pccx-vscode-prototype",
    kind: "vscode-navigation",
    mode,
    items: records,
  };
}

async function readExample(kind, source) {
  const examples = kind === "diagnostics" ? DIAGNOSTIC_EXAMPLES : NAVIGATION_EXAMPLES;
  const filename = examples.get(source);
  if (!filename) {
    throw new Error(`unknown ${kind} example source: ${source}`);
  }
  return readJsonPayload(resolve(EXAMPLES, filename));
}

function writeLiveFailure(result, label) {
  process.stderr.write(`error: ${label} failed\n`);
  if (result.stderr) {
    process.stderr.write(result.stderr.endsWith("\n") ? result.stderr : `${result.stderr}\n`);
  }
  if (result.error) {
    process.stderr.write(`${result.error}\n`);
  }
}

async function runDiagnostics(options) {
  if (options.mode === "example") {
    if (
      !options.source ||
      hasAny([options.fromCheck, options.fromXsimLog, options.declarations, options.locate, options.kind])
    ) {
      return fail("example diagnostics requires only --source");
    }
    const payload = await readExample("diagnostics", options.source);
    emitJson(outputPayload("diagnostics", "example", problemsPayloadToDiagnostics(payload)));
    return 0;
  }

  if (
    !exactlyOne([options.fromCheck, options.fromXsimLog]) ||
    hasAny([options.source, options.declarations, options.locate, options.kind])
  ) {
    return fail("live diagnostics requires exactly one of --from-check or --from-xsim-log");
  }

  const result = options.fromCheck
    ? await getProblemsFromCheck(options.fromCheck)
    : await getProblemsFromXsimLog(options.fromXsimLog);

  if (!result.ok) {
    writeLiveFailure(result, "live diagnostics");
    return result.exitCode || 1;
  }

  emitJson(outputPayload("diagnostics", "live", result.diagnostics));
  return 0;
}

async function runNavigation(options) {
  if (options.mode === "example") {
    if (
      !options.source ||
      hasAny([options.declarations, options.locate, options.fromCheck, options.fromXsimLog, options.kind])
    ) {
      return fail("example navigation requires only --source");
    }
    const payload = await readExample("navigation", options.source);
    emitJson(outputPayload("navigation", "example", payloadToNavigationItems(payload)));
    return 0;
  }

  if (
    !exactlyOne([options.declarations, options.locate]) ||
    hasAny([options.source, options.fromCheck, options.fromXsimLog])
  ) {
    return fail("live navigation requires exactly one of --declarations or --locate");
  }
  if (options.declarations && options.kind) {
    return fail("live navigation --kind is only valid with --locate");
  }

  if (options.kind && !LOCATE_KINDS.has(options.kind)) {
    return fail(`unsupported locate kind: ${options.kind}`);
  }

  const result = options.declarations
    ? await getDeclarations(options.declarations)
    : await locateDeclaration(options.locate.path, options.locate.name, options.kind ?? "module");

  if (!result.ok) {
    writeLiveFailure(result, "live navigation");
    return result.exitCode || 1;
  }

  emitJson(outputPayload("navigation", "live", result.navigationItems));
  return 0;
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!["diagnostics", "navigation"].includes(command)) {
    return fail("expected diagnostics or navigation command");
  }

  let options;
  try {
    options = parseOptions(rest);
  } catch (error) {
    return fail(error.message);
  }

  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (!["example", "live"].includes(options.mode)) {
    return fail("expected explicit --mode example or --mode live");
  }

  try {
    return command === "diagnostics"
      ? await runDiagnostics(options)
      : await runNavigation(options);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}

export { main };

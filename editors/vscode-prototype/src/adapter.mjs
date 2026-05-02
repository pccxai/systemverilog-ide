import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_SOURCE = "pccx_ide_cli";

export function severityToVsCode(severity) {
  const normalized = String(severity ?? "").toLowerCase();
  if (normalized === "error") {
    return "Error";
  }
  if (normalized === "warning") {
    return "Warning";
  }
  return "Information";
}

export function toZeroBasedPosition(value) {
  return Number.isInteger(value) && value > 0 ? value - 1 : 0;
}

function oneBasedOrNull(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function stringOrEmpty(value) {
  return value == null ? "" : String(value);
}

export function problemToDiagnostic(problem, payload = {}) {
  const startLine = toZeroBasedPosition(problem.line);
  const startCharacter = toZeroBasedPosition(problem.column);
  const diagnostic = {
    file: stringOrEmpty(problem.file ?? payload.source),
    range: {
      start: {
        line: startLine,
        character: startCharacter,
      },
      end: {
        line: startLine,
        character: startCharacter + 1,
      },
    },
    severity: severityToVsCode(problem.severity),
    message: stringOrEmpty(problem.message),
    source: stringOrEmpty(problem.source_kind ?? payload.source_kind ?? DEFAULT_SOURCE),
  };

  if (problem.code != null) {
    diagnostic.code = String(problem.code);
  }
  if (problem.raw != null) {
    diagnostic.raw = String(problem.raw);
  }

  return diagnostic;
}

export function problemsPayloadToDiagnostics(payload) {
  const problems = Array.isArray(payload.problems) ? payload.problems : [];
  return problems.map((problem) => problemToDiagnostic(problem, payload));
}

export function declarationToNavigationItem(declaration) {
  return {
    name: stringOrEmpty(declaration.name),
    kind: stringOrEmpty(declaration.kind),
    file: stringOrEmpty(declaration.file),
    line: oneBasedOrNull(declaration.line),
    column: oneBasedOrNull(declaration.column),
    zero_based_line: toZeroBasedPosition(declaration.line),
    zero_based_column: toZeroBasedPosition(declaration.column),
  };
}

export function declarationsPayloadToNavigationItems(payload) {
  const declarations = Array.isArray(payload.declarations) ? payload.declarations : [];
  return declarations.map(declarationToNavigationItem);
}

export function locatePayloadToNavigationItems(payload) {
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  return matches.map(declarationToNavigationItem);
}

export function payloadToNavigationItems(payload) {
  if (Array.isArray(payload.declarations)) {
    return declarationsPayloadToNavigationItems(payload);
  }
  return locatePayloadToNavigationItems(payload);
}

export async function readJsonPayload(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(argv) {
  const [mode, jsonPath] = argv;
  if (!["diagnostics", "navigation"].includes(mode) || !jsonPath) {
    process.stderr.write(
      "usage: node editors/vscode-prototype/src/adapter.mjs " +
        "diagnostics|navigation <editor-bridge-json>\n",
    );
    return 2;
  }

  const payload = await readJsonPayload(jsonPath);
  const output = mode === "diagnostics"
    ? problemsPayloadToDiagnostics(payload)
    : payloadToNavigationItems(payload);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main(process.argv.slice(2));
  process.exitCode = exitCode;
}

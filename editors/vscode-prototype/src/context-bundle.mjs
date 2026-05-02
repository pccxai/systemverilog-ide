import { isAbsolute, relative } from "node:path";

export const CONTEXT_BUNDLE_VERSION = "pccx.contextBundle.v0";
export const CONTEXT_BUNDLE_SOURCE = "pccx-systemverilog-ide";

export const DEFAULT_CONTEXT_BUNDLE_LIMITS = Object.freeze({
  maxFiles: 3,
  maxDiagnostics: 10,
  maxDeclarations: 12,
  maxSnippetLines: 40,
  maxLogSummaryLines: 20,
  maxTextCharacters: 4000,
});

const EXCLUDED_PATH_SEGMENTS = new Set([
  ".git",
  ".vscode-test",
  "node_modules",
]);

const SECRET_LIKE_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b/i;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const PRIVATE_INSTRUCTION_PATH_PATTERN =
  /(?:^|[/\\])(?:\.codex|private[-_ ]?worker|worker[-_ ]?instruction|subagent[-_ ]?instruction)(?:[/\\]|$)/i;

function mergeLimits(limits = {}) {
  return {
    ...DEFAULT_CONTEXT_BUNDLE_LIMITS,
    ...Object.fromEntries(
      Object.entries(limits).filter(([, value]) => Number.isInteger(value) && value >= 0),
    ),
  };
}

function normalizeWorkspacePath(workspaceRoot) {
  if (typeof workspaceRoot !== "string" || workspaceRoot.trim().length === 0) {
    return null;
  }
  return workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
}

function hasExcludedPathSegment(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
}

function normalizePathRef(path, workspaceRoot = null) {
  if (typeof path !== "string" || path.trim().length === 0) {
    return null;
  }
  if (path.includes("\0") || path.includes("\n") || path.includes("\r")) {
    return null;
  }

  const normalizedWorkspaceRoot = normalizeWorkspacePath(workspaceRoot);
  let normalizedPath = path.replace(/\\/g, "/");

  if (isAbsolute(normalizedPath)) {
    if (!normalizedWorkspaceRoot) {
      return null;
    }
    const rel = relative(normalizedWorkspaceRoot, normalizedPath).replace(/\\/g, "/");
    if (rel.startsWith("../") || rel === ".." || isAbsolute(rel)) {
      return null;
    }
    normalizedPath = rel;
  }

  normalizedPath = normalizedPath.replace(/^\.\//, "");
  if (
    normalizedPath === "" ||
    normalizedPath.startsWith("../") ||
    normalizedPath === ".." ||
    hasExcludedPathSegment(normalizedPath) ||
    SECRET_LIKE_PATTERN.test(normalizedPath) ||
    PRIVATE_INSTRUCTION_PATH_PATTERN.test(normalizedPath)
  ) {
    return null;
  }
  return normalizedPath;
}

function clampNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRange(range) {
  if (!range || typeof range !== "object") {
    return null;
  }
  return {
    start: {
      line: Math.max(0, Math.floor(clampNumber(range.start?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.start?.character))),
    },
    end: {
      line: Math.max(0, Math.floor(clampNumber(range.end?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.end?.character))),
    },
  };
}

function scrubText(value, maxCharacters) {
  if (typeof value !== "string" || value.length === 0 || maxCharacters === 0) {
    return "";
  }
  return value
    .split(/\r?\n/)
    .map((line) => (SECRET_ASSIGNMENT_PATTERN.test(line) ? "[redacted]" : line))
    .join("\n")
    .slice(0, maxCharacters);
}

function isBinaryLike(text) {
  return typeof text !== "string" || text.includes("\0");
}

function boundedLines(value, limit, maxCharacters) {
  if (typeof value !== "string" || limit === 0 || maxCharacters === 0) {
    return [];
  }
  return scrubText(value, maxCharacters)
    .split(/\r?\n/)
    .slice(0, limit);
}

function normalizeDiagnostic(diagnostic, workspaceRoot, limits) {
  const path = normalizePathRef(diagnostic?.path ?? diagnostic?.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    path,
    range: normalizeRange(diagnostic.range),
    severity: scrubText(diagnostic.severity ?? "Information", 80),
    message: scrubText(diagnostic.message ?? "", 500),
    source: scrubText(diagnostic.source ?? "", 120),
    code: scrubText(diagnostic.code ?? "", 120),
  };
}

function normalizeDeclaration(declaration, workspaceRoot, limits) {
  const path = normalizePathRef(declaration?.path ?? declaration?.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    name: scrubText(declaration.name ?? "", 160),
    kind: scrubText(declaration.kind ?? "any", 80),
    path,
    range: normalizeRange(declaration.range),
    line: declaration.line == null ? undefined : Math.max(1, Math.floor(clampNumber(declaration.line, 1))),
    column: declaration.column == null ? undefined : Math.max(1, Math.floor(clampNumber(declaration.column, 1))),
  };
}

function normalizeSnippet(file, workspaceRoot, limits) {
  const path = normalizePathRef(file?.path ?? file?.file, workspaceRoot);
  if (!path || isBinaryLike(file?.text ?? "")) {
    return null;
  }

  const lines = boundedLines(file.text ?? "", limits.maxSnippetLines, limits.maxTextCharacters);
  return {
    path,
    language: scrubText(file.language ?? "systemverilog", 80),
    range: normalizeRange(file.range),
    lines,
    truncated: typeof file.text === "string" && file.text.split(/\r?\n/).length > lines.length,
  };
}

function sortedByPathAndName(items) {
  return [...items].sort((a, b) => {
    const pathOrder = String(a.path ?? "").localeCompare(String(b.path ?? ""));
    if (pathOrder !== 0) {
      return pathOrder;
    }
    return String(a.name ?? a.message ?? "").localeCompare(String(b.name ?? b.message ?? ""));
  });
}

function normalizeLogSummary(entry, limits) {
  const lines = Array.isArray(entry?.summaryLines)
    ? entry.summaryLines.join("\n")
    : entry?.summary ?? "";
  return {
    label: scrubText(entry?.label ?? entry?.flow ?? "pccx-lab-output", 160),
    exitCode: entry?.exitCode == null ? null : Math.floor(clampNumber(entry.exitCode)),
    lines: boundedLines(lines, limits.maxLogSummaryLines, limits.maxTextCharacters),
  };
}

export function buildContextBundle(input = {}, options = {}) {
  const limits = mergeLimits(options.limits);
  const workspaceRoot = options.workspaceRoot ?? input.workspaceRoot ?? null;
  const files = Array.isArray(input.files) ? input.files : [];
  const diagnostics = Array.isArray(input.activeDiagnostics) ? input.activeDiagnostics : [];
  const declarations = Array.isArray(input.symbolContext?.declarations)
    ? input.symbolContext.declarations
    : [];
  const pccxLabOutputs = Array.isArray(input.pccxLabOutputs) ? input.pccxLabOutputs : [];

  const snippets = sortedByPathAndName(
    files
      .map((file) => normalizeSnippet(file, workspaceRoot, limits))
      .filter(Boolean),
  ).slice(0, limits.maxFiles);

  const selectedPath = normalizePathRef(input.selectedFilePath, workspaceRoot);

  return {
    version: CONTEXT_BUNDLE_VERSION,
    source: CONTEXT_BUNDLE_SOURCE,
    limits,
    selectedFile: selectedPath ? { path: selectedPath } : null,
    selectedRange: normalizeRange(input.selectedRange),
    userIntent: scrubText(input.userIntent ?? "", limits.maxTextCharacters),
    diagnostics: sortedByPathAndName(
      diagnostics
        .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
        .filter(Boolean),
    ).slice(0, limits.maxDiagnostics),
    symbols: {
      selected: input.selectedSymbol
        ? {
            name: scrubText(input.selectedSymbol.name ?? "", 160),
            kind: scrubText(input.selectedSymbol.kind ?? "any", 80),
            path: normalizePathRef(input.selectedSymbol.path ?? input.selectedSymbol.file, workspaceRoot),
            range: normalizeRange(input.selectedSymbol.range),
          }
        : null,
      declarations: sortedByPathAndName(
        declarations
          .map((declaration) => normalizeDeclaration(declaration, workspaceRoot, limits))
          .filter(Boolean),
      ).slice(0, limits.maxDeclarations),
    },
    snippets,
    validation: {
      recent: input.recentValidation
        ? {
            status: scrubText(input.recentValidation.status ?? "unknown", 80),
            summary: scrubText(input.recentValidation.summary ?? "", 800),
            exitCode: input.recentValidation.exitCode == null
              ? null
              : Math.floor(clampNumber(input.recentValidation.exitCode)),
          }
        : null,
    },
    pccxLab: {
      commandBoundary: "pccx_ide_cli",
      outputs: pccxLabOutputs
        .map((entry) => normalizeLogSummary(entry, limits))
        .slice(0, limits.maxFiles),
    },
    excludedPathSegments: [...EXCLUDED_PATH_SEGMENTS].sort(),
  };
}

export function summarizeContextBundle(bundle) {
  return {
    version: bundle?.version ?? CONTEXT_BUNDLE_VERSION,
    selectedFile: bundle?.selectedFile ?? null,
    diagnosticCount: Array.isArray(bundle?.diagnostics) ? bundle.diagnostics.length : 0,
    snippetCount: Array.isArray(bundle?.snippets) ? bundle.snippets.length : 0,
    declarationCount: Array.isArray(bundle?.symbols?.declarations)
      ? bundle.symbols.declarations.length
      : 0,
    pccxLabOutputCount: Array.isArray(bundle?.pccxLab?.outputs)
      ? bundle.pccxLab.outputs.length
      : 0,
  };
}

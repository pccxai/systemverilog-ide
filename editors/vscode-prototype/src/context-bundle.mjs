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

const EXCLUDED_PATH_NAMES = new Set([
  "AGENTS.md",
  "package-lock.json",
]);

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  ".git/**",
  ".vscode-test/**",
  "node_modules/**",
  "agent-instruction-files",
  "lockfiles",
  ".codex/**",
  "private-worker/**",
  "worker-instruction/**",
  "subagent-instruction/**",
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

function hasExcludedPathName(path) {
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => EXCLUDED_PATH_NAMES.has(segment));
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
    hasExcludedPathName(normalizedPath) ||
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
  const normalized = {
    start: {
      line: Math.max(0, Math.floor(clampNumber(range.start?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.start?.character))),
    },
    end: {
      line: Math.max(0, Math.floor(clampNumber(range.end?.line))),
      character: Math.max(0, Math.floor(clampNumber(range.end?.character))),
    },
  };
  if (
    normalized.end.line < normalized.start.line ||
    (
      normalized.end.line === normalized.start.line &&
      normalized.end.character < normalized.start.character
    )
  ) {
    normalized.end = { ...normalized.start };
  }
  return normalized;
}

function redactSecretAssignments(value) {
  return value
    .split(/\r?\n/)
    .map((line) => (SECRET_ASSIGNMENT_PATTERN.test(line) ? "[redacted]" : line))
    .join("\n");
}

function scrubText(value, maxCharacters) {
  if (typeof value !== "string" || value.length === 0 || maxCharacters === 0) {
    return "";
  }
  return redactSecretAssignments(value).slice(0, maxCharacters);
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

function boundedSnippetLines(value, limit, maxCharacters) {
  if (typeof value !== "string" || limit === 0 || maxCharacters === 0) {
    return { lines: [], truncated: typeof value === "string" && value.length > 0 };
  }
  const redacted = redactSecretAssignments(value);
  const charLimited = redacted.slice(0, maxCharacters);
  const allLines = charLimited.split(/\r?\n/);
  const lines = allLines.slice(0, limit);
  return {
    lines,
    truncated: redacted.length > charLimited.length || allLines.length > lines.length,
  };
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

  const snippet = boundedSnippetLines(
    file.text ?? "",
    limits.maxSnippetLines,
    limits.maxTextCharacters,
  );
  return {
    path,
    language: scrubText(file.language ?? "systemverilog", 80),
    range: normalizeRange(file.range),
    lines: snippet.lines,
    truncated: snippet.truncated,
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

function sortedSnippets(items, selectedPath) {
  return sortedByPathAndName(items).sort((a, b) => {
    const aSelected = selectedPath && a.path === selectedPath ? 0 : 1;
    const bSelected = selectedPath && b.path === selectedPath ? 0 : 1;
    return aSelected - bSelected;
  });
}

function rangeStartsWithin(range, selectedRange) {
  if (!range || !selectedRange) {
    return false;
  }
  const line = range.start?.line;
  const selectedStart = selectedRange.start?.line;
  const selectedEnd = selectedRange.end?.line;
  return Number.isInteger(line) &&
    Number.isInteger(selectedStart) &&
    Number.isInteger(selectedEnd) &&
    line >= selectedStart &&
    line <= selectedEnd;
}

function sortedDiagnostics(items, selectedPath, selectedRange) {
  return sortedByPathAndName(items).sort((a, b) => {
    const aScore = (selectedPath && a.path === selectedPath ? 0 : 2) +
      (rangeStartsWithin(a.range, selectedRange) ? 0 : 1);
    const bScore = (selectedPath && b.path === selectedPath ? 0 : 2) +
      (rangeStartsWithin(b.range, selectedRange) ? 0 : 1);
    return aScore - bScore;
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

function normalizeConfiguration(configuration) {
  if (!configuration || typeof configuration !== "object") {
    return {
      mode: "unknown",
      liveWorkspace: { enabled: false },
    aiAssistant: { enabled: false, backend: "none" },
    pccxLab: { commandBoundary: "pccx_ide_cli" },
    validationRunner: { enabled: false, mode: "disabled" },
  };
}
  return {
    mode: scrubText(configuration.mode ?? "unknown", 80),
    liveWorkspace: {
      enabled: configuration.liveWorkspace?.enabled === true,
    },
    aiAssistant: {
      enabled: configuration.aiAssistant?.enabled === true,
      backend: scrubText(configuration.aiAssistant?.backend ?? "none", 80),
    },
    pccxLab: {
      commandBoundary: scrubText(configuration.pccxLab?.commandBoundary ?? "pccx_ide_cli", 120),
    },
    validationRunner: {
      enabled: configuration.validationRunner?.enabled === true,
      mode: scrubText(configuration.validationRunner?.mode ?? "disabled", 80),
      defaultWorkingDirectory: scrubText(
        configuration.validationRunner?.defaultWorkingDirectory ?? "repo-root",
        80,
      ),
      maxOutputLines: Math.max(0, Math.floor(clampNumber(
        configuration.validationRunner?.maxOutputLines,
      ))),
      timeoutMs: Math.max(0, Math.floor(clampNumber(configuration.validationRunner?.timeoutMs))),
    },
  };
}

function normalizeSelectedSymbol(symbol, workspaceRoot) {
  if (!symbol) {
    return null;
  }
  const path = normalizePathRef(symbol.path ?? symbol.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    name: scrubText(symbol.name ?? "", 160),
    kind: scrubText(symbol.kind ?? "any", 80),
    path,
    range: normalizeRange(symbol.range),
  };
}

function normalizeCurrentLine(currentLine, limits) {
  if (!currentLine || typeof currentLine !== "object") {
    return null;
  }
  return {
    number: Math.max(1, Math.floor(clampNumber(currentLine.number, 1))),
    text: scrubText(currentLine.text ?? "", limits.maxTextCharacters),
    truncated: currentLine.truncated === true,
  };
}

function normalizeSelectionSummary(summary, limits) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const previewLines = Array.isArray(summary.previewLines)
    ? summary.previewLines
      .map((line) => scrubText(line, limits.maxTextCharacters))
      .slice(0, limits.maxSnippetLines)
    : [];
  return {
    lineCount: Math.max(0, Math.floor(clampNumber(summary.lineCount))),
    characterCount: Math.max(0, Math.floor(clampNumber(summary.characterCount))),
    previewLines,
    truncated: summary.truncated === true,
  };
}

function normalizeCursor(cursor) {
  if (!cursor || typeof cursor !== "object") {
    return null;
  }
  return {
    line: Math.max(0, Math.floor(clampNumber(cursor.line))),
    character: Math.max(0, Math.floor(clampNumber(cursor.character))),
  };
}

function normalizeSelectedSymbolContext(context, workspaceRoot, limits) {
  if (!context || typeof context !== "object") {
    return null;
  }
  const path = normalizePathRef(context.path ?? context.file, workspaceRoot);
  if (!path) {
    return null;
  }
  return {
    version: scrubText(context.version ?? "", 80),
    path,
    language: scrubText(context.language ?? "systemverilog", 80),
    symbolText: scrubText(context.symbolText ?? context.name ?? "", 160),
    lexicalKind: scrubText(context.lexicalKind ?? context.kind ?? "identifier", 80),
    range: normalizeRange(context.range),
    cursor: normalizeCursor(context.cursor),
    currentLine: normalizeCurrentLine(context.currentLine, limits),
    selectionSummary: normalizeSelectionSummary(context.selectionSummary, limits),
    enclosingDeclaration: normalizeDeclaration(context.enclosingDeclaration, workspaceRoot, limits),
    relatedNavigation: Array.isArray(context.relatedNavigation)
      ? sortedByPathAndName(context.relatedNavigation
        .map((item) => normalizeDeclaration(item, workspaceRoot, limits))
        .filter(Boolean))
        .slice(0, limits.maxDeclarations)
      : [],
    nearbyDiagnostics: Array.isArray(context.nearbyDiagnostics)
      ? sortedDiagnostics(context.nearbyDiagnostics
        .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
        .filter(Boolean), path, normalizeRange(context.range))
        .slice(0, limits.maxDiagnostics)
      : [],
    analysis: {
      kind: scrubText(context.analysis?.kind ?? "lexical", 80),
      semanticResolution: context.analysis?.semanticResolution === true,
    },
  };
}

function normalizeRecentCommandStatus(status, limits) {
  if (!status || typeof status !== "object") {
    return null;
  }
  return {
    commandId: scrubText(status.commandId ?? "", 160),
    ok: status.ok === true,
    actionKind: scrubText(status.actionKind ?? "", 80),
    summary: scrubText(status.summary ?? "", 500),
    facade: status.facade
      ? {
          command: scrubText(status.facade.command ?? "", 80),
          mode: scrubText(status.facade.mode ?? "", 80),
        }
      : null,
    diagnosticCount: Math.max(0, Math.floor(clampNumber(status.diagnosticCount))),
    navigationItemCount: Math.max(0, Math.floor(clampNumber(status.navigationItemCount))),
    error: scrubText(status.error ?? "", limits.maxTextCharacters),
  };
}

function normalizeOutputSummary(summary, limits) {
  const lines = Array.isArray(summary?.lines)
    ? summary.lines
      .map((line) => scrubText(String(line ?? ""), limits.maxTextCharacters))
      .slice(0, limits.maxLogSummaryLines)
    : [];
  return {
    lines,
    lineCount: Math.max(0, Math.floor(clampNumber(summary?.lineCount, lines.length))),
    truncated: summary?.truncated === true || (
      Array.isArray(summary?.lines) && summary.lines.length > lines.length
    ),
  };
}

function normalizeRecentValidation(validation, limits) {
  if (!validation || typeof validation !== "object") {
    return null;
  }
  return {
    version: scrubText(validation.version ?? "", 80),
    proposalId: scrubText(validation.proposalId ?? "", 120),
    commandLabel: scrubText(validation.commandLabel ?? "", 160),
    status: scrubText(validation.status ?? "unknown", 80),
    summary: scrubText(validation.summary ?? "", 800),
    exitCode: validation.exitCode == null
      ? null
      : Math.floor(clampNumber(validation.exitCode)),
    durationMs: validation.durationMs == null
      ? null
      : Math.max(0, Math.floor(clampNumber(validation.durationMs))),
    startedAt: scrubText(validation.startedAt ?? "", 80),
    finishedAt: scrubText(validation.finishedAt ?? "", 80),
    command: scrubText(validation.command ?? "", 120),
    args: Array.isArray(validation.args)
      ? validation.args
        .map((arg) => scrubText(String(arg ?? ""), 300))
        .slice(0, 12)
      : [],
    cwdKind: scrubText(validation.cwdKind ?? "", 80),
    cwdLabel: scrubText(validation.cwdLabel ?? "", 80),
    stdoutSummary: normalizeOutputSummary(validation.stdoutSummary, limits),
    stderrSummary: normalizeOutputSummary(validation.stderrSummary, limits),
    failureHints: Array.isArray(validation.failureHints)
      ? validation.failureHints
        .map((hint) => scrubText(String(hint ?? ""), 500))
        .slice(0, 3)
      : [],
    safety: {
      allowlisted: validation.safety?.allowlisted === true,
      shell: validation.safety?.shell === true,
      fixedArgs: validation.safety?.fixedArgs === true,
      userProvidedCommand: validation.safety?.userProvidedCommand === true,
      writesFiles: validation.safety?.writesFiles === true,
      providerCalls: validation.safety?.providerCalls === true,
      launcherCalls: validation.safety?.launcherCalls === true,
      mcpServerCalls: validation.safety?.mcpServerCalls === true,
    },
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
  const selectedPath = normalizePathRef(input.selectedFilePath, workspaceRoot);
  const selectedRange = normalizeRange(input.selectedRange);

  const snippets = sortedSnippets(
    files
      .map((file) => normalizeSnippet(file, workspaceRoot, limits))
      .filter(Boolean),
    selectedPath,
  ).slice(0, limits.maxFiles);

  return {
    version: CONTEXT_BUNDLE_VERSION,
    source: CONTEXT_BUNDLE_SOURCE,
    limits,
    configuration: normalizeConfiguration(input.configuration),
    selectedFile: selectedPath ? { path: selectedPath } : null,
    selectedRange,
    userIntent: scrubText(input.userIntent ?? "", limits.maxTextCharacters),
    diagnostics: sortedDiagnostics(
      diagnostics
        .map((diagnostic) => normalizeDiagnostic(diagnostic, workspaceRoot, limits))
        .filter(Boolean),
      selectedPath,
      selectedRange,
    ).slice(0, limits.maxDiagnostics),
    symbols: {
      selected: normalizeSelectedSymbol(input.selectedSymbol, workspaceRoot),
      selectedContext: normalizeSelectedSymbolContext(input.selectedSymbolContext, workspaceRoot, limits),
      declarations: sortedByPathAndName(
        declarations
          .map((declaration) => normalizeDeclaration(declaration, workspaceRoot, limits))
          .filter(Boolean),
      ).slice(0, limits.maxDeclarations),
    },
    snippets,
    validation: {
      recent: normalizeRecentValidation(input.recentValidation, limits),
    },
    recentCommand: normalizeRecentCommandStatus(input.recentCommandStatus, limits),
    pccxLab: {
      commandBoundary: "pccx_ide_cli",
      outputs: pccxLabOutputs
        .map((entry) => normalizeLogSummary(entry, limits))
        .slice(0, limits.maxFiles),
    },
    excludedPathSegments: [...EXCLUDED_PATH_SEGMENTS].sort(),
    excludedPathPatterns: [...EXCLUDED_PATH_PATTERNS],
    redaction: {
      assignmentPolicy: "secret-like-lines-redacted",
      absolutePaths: "workspaceRelativeOnly",
      privateInstructionPathsExcluded: true,
    },
  };
}

export function summarizeContextBundle(bundle) {
  return {
    version: bundle?.version ?? CONTEXT_BUNDLE_VERSION,
    selectedFile: bundle?.selectedFile ?? null,
    selectedSymbol: bundle?.symbols?.selected
      ? {
          name: bundle.symbols.selected.name,
          kind: bundle.symbols.selected.kind,
          path: bundle.symbols.selected.path,
        }
      : null,
    diagnosticCount: Array.isArray(bundle?.diagnostics) ? bundle.diagnostics.length : 0,
    snippetCount: Array.isArray(bundle?.snippets) ? bundle.snippets.length : 0,
    declarationCount: Array.isArray(bundle?.symbols?.declarations)
      ? bundle.symbols.declarations.length
      : 0,
    pccxLabOutputCount: Array.isArray(bundle?.pccxLab?.outputs)
      ? bundle.pccxLab.outputs.length
      : 0,
    validation: bundle?.validation?.recent
      ? {
          proposalId: bundle.validation.recent.proposalId,
          status: bundle.validation.recent.status,
          commandLabel: bundle.validation.recent.commandLabel,
        }
      : null,
  };
}

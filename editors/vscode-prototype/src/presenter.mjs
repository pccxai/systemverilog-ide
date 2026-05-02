const DEFAULT_FILE = "";
const DEFAULT_POSITION = Object.freeze({ line: 0, character: 0 });

function requireAction(action, expectedKind) {
  if (action?.kind !== expectedKind) {
    throw new Error(`expected ${expectedKind} UI action`);
  }
}

function safePosition(position) {
  return {
    line: Number.isInteger(position?.line) && position.line >= 0 ? position.line : 0,
    character: Number.isInteger(position?.character) && position.character >= 0
      ? position.character
      : 0,
  };
}

function safeRange(diagnostic) {
  const start = safePosition(diagnostic?.range?.start ?? DEFAULT_POSITION);
  const end = safePosition(diagnostic?.range?.end ?? {
    line: start.line,
    character: start.character + 1,
  });
  return { start, end };
}

function severityName(severity) {
  const normalized = String(severity ?? "").toLowerCase();
  if (normalized === "error") {
    return "Error";
  }
  if (normalized === "warning") {
    return "Warning";
  }
  return "Information";
}

export function mapDiagnosticSeverity(severity, diagnosticSeverity = {}) {
  const name = severityName(severity);
  return diagnosticSeverity[name] ?? name;
}

function groupDiagnostics(diagnostics) {
  const groups = new Map();
  for (const diagnostic of diagnostics) {
    const file = diagnostic?.file == null ? DEFAULT_FILE : String(diagnostic.file);
    if (!groups.has(file)) {
      groups.set(file, []);
    }
    groups.get(file).push(diagnostic);
  }
  return groups;
}

export function createDiagnosticsPresentation(action) {
  requireAction(action, "diagnostics");
  const diagnostics = Array.isArray(action.diagnostics) ? action.diagnostics : [];
  const files = Array.from(groupDiagnostics(diagnostics), ([file, fileDiagnostics]) => ({
    file,
    diagnostics: fileDiagnostics,
  }));

  return {
    kind: "diagnostics-presentation",
    files,
    summary: String(action.summary ?? `${diagnostics.length} diagnostic(s)`),
  };
}

function fallbackUri(file) {
  return { fsPath: file };
}

function fallbackRange(startLine, startCharacter, endLine, endCharacter) {
  return {
    start: { line: startLine, character: startCharacter },
    end: { line: endLine, character: endCharacter },
  };
}

function fallbackDiagnostic(range, message, severity) {
  return { range, message, severity };
}

function toVsCodeLikeDiagnostic(diagnostic, deps) {
  const range = safeRange(diagnostic);
  const vsCodeRange = (deps.createRange ?? fallbackRange)(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  );
  const severity = mapDiagnosticSeverity(diagnostic?.severity, deps.diagnosticSeverity);
  return (deps.createDiagnostic ?? fallbackDiagnostic)(
    vsCodeRange,
    String(diagnostic?.message ?? ""),
    severity,
    diagnostic,
  );
}

export function presentDiagnostics(action, deps = {}) {
  const presentation = createDiagnosticsPresentation(action);
  const collection = deps.diagnosticsCollection;

  if (presentation.files.length === 0) {
    collection?.clear?.();
    deps.showInformationMessage?.(presentation.summary, presentation);
    return presentation;
  }

  for (const fileGroup of presentation.files) {
    const uri = (deps.createUri ?? fallbackUri)(fileGroup.file);
    const diagnostics = fileGroup.diagnostics.map((diagnostic) => (
      toVsCodeLikeDiagnostic(diagnostic, deps)
    ));
    collection?.set?.(uri, diagnostics);
  }

  if (action.diagnostics?.length > 0) {
    deps.showWarningMessage?.(presentation.summary, presentation);
  } else {
    deps.showInformationMessage?.(presentation.summary, presentation);
  }
  return presentation;
}

function oneBased(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function navigationLabel(item) {
  const kind = item?.kind ? `${String(item.kind)} ` : "";
  const name = item?.name ? String(item.name) : "(unnamed)";
  return `${kind}${name}`.trim();
}

function navigationDescription(item) {
  const file = item?.file == null ? "" : String(item.file);
  const line = oneBased(item?.line);
  const column = oneBased(item?.column);
  if (line && column) {
    return `${file}:${line}:${column}`;
  }
  if (line) {
    return `${file}:${line}`;
  }
  return file;
}

export function createNavigationPresentation(action) {
  requireAction(action, "navigation");
  const items = Array.isArray(action.items) ? action.items : [];
  return {
    kind: "navigation-presentation",
    items: items.map((item) => ({
      label: navigationLabel(item),
      description: navigationDescription(item),
      detail: item?.kind ? String(item.kind) : "",
      file: item?.file == null ? "" : String(item.file),
      line: oneBased(item?.line),
      column: oneBased(item?.column),
    })),
    summary: String(action.summary ?? `${items.length} navigation item(s)`),
  };
}

export async function presentNavigation(action, deps = {}) {
  const presentation = createNavigationPresentation(action);
  if (presentation.items.length === 0) {
    await deps.showInformationMessage?.(presentation.summary, presentation);
    return presentation;
  }

  await deps.showQuickPick?.(presentation.items, {
    title: "PCCX SystemVerilog Navigation",
    placeHolder: presentation.summary,
  });
  return presentation;
}

export function presentAction(action, deps = {}) {
  if (action?.kind === "diagnostics") {
    return presentDiagnostics(action, deps);
  }
  if (action?.kind === "navigation") {
    return presentNavigation(action, deps);
  }
  throw new Error(`unsupported UI action kind: ${action?.kind ?? "missing"}`);
}

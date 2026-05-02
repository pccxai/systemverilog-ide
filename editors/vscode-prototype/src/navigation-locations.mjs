import { isAbsolute, resolve } from "node:path";

const DEFAULT_SOURCE = "pccx-vscode-prototype";

function stringOrEmpty(value) {
  return value == null ? "" : String(value);
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

function fallbackLocation(uri, range) {
  return { uri, range };
}

function positiveOneBased(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function nonNegativeZeroBased(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function zeroBasedPosition(item, zeroBasedKey, oneBasedKey) {
  return nonNegativeZeroBased(item?.[zeroBasedKey])
    ?? (positiveOneBased(item?.[oneBasedKey]) == null ? 0 : item[oneBasedKey] - 1);
}

function navigationFilePath(file, fileRoot) {
  const filePath = stringOrEmpty(file);
  if (filePath.length === 0 || isAbsolute(filePath) || !fileRoot) {
    return filePath;
  }
  return resolve(fileRoot, filePath);
}

export function createNavigationLocationRecord(item, deps = {}) {
  const file = stringOrEmpty(item?.file);
  const filePath = navigationFilePath(file, deps.fileRoot);
  const uri = (deps.createUri ?? fallbackUri)(filePath);
  const startLine = zeroBasedPosition(item, "zero_based_line", "line");
  const startCharacter = zeroBasedPosition(item, "zero_based_column", "column");
  const range = (deps.createRange ?? fallbackRange)(
    startLine,
    startCharacter,
    startLine,
    startCharacter + 1,
  );
  const location = (deps.createLocation ?? fallbackLocation)(uri, range);
  const name = stringOrEmpty(item?.name);
  const kind = stringOrEmpty(item?.kind);

  return {
    uri,
    range,
    location,
    targetKind: kind,
    kind,
    symbol: name,
    name,
    source: stringOrEmpty(item?.source) || stringOrEmpty(deps.source) || DEFAULT_SOURCE,
    file,
    line: positiveOneBased(item?.line) ?? startLine + 1,
    column: positiveOneBased(item?.column) ?? startCharacter + 1,
  };
}

export function createNavigationLocationRecords(items, deps = {}) {
  return Array.isArray(items)
    ? items.map((item) => createNavigationLocationRecord(item, deps))
    : [];
}

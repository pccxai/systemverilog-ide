import { summarizeOutputText } from "./validation-result-summary.mjs";

export const VALIDATION_RESULT_CACHE_ENTRY_VERSION = "pccx.validationResultCacheEntry.v0";
export const DEFAULT_VALIDATION_RESULT_CACHE_MAX_SIZE = 5;
export const DEFAULT_VALIDATION_RESULT_CACHE_OUTPUT_LINES = 20;

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/g;
const HOME_PATH_TEST_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/;
const WORKING_DIRECTORY_KINDS = new Set(["repo-root", "workspace"]);

function clampInteger(value, fallback, min, max) {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function redactText(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => (SECRET_ASSIGNMENT_PATTERN.test(line) ? "[redacted]" : line))
    .join("\n")
    .replace(HOME_PATH_PATTERN, "[home]");
}

function boundedText(value, maxCharacters) {
  if (typeof value !== "string" || value.length === 0 || maxCharacters === 0) {
    return "";
  }
  return redactText(value).slice(0, maxCharacters);
}

function outputSummaryOptions(options = {}) {
  return {
    maxOutputLines: clampInteger(
      options.maxOutputLines,
      DEFAULT_VALIDATION_RESULT_CACHE_OUTPUT_LINES,
      1,
      120,
    ),
    maxLineCharacters: clampInteger(options.maxLineCharacters, 500, 80, 2000),
    maxTextCharacters: clampInteger(options.maxTextCharacters, 4000, 500, 10000),
  };
}

function normalizeOutputSummary(summary, options = {}) {
  const limits = outputSummaryOptions(options);
  const sourceLines = Array.isArray(summary?.lines)
    ? summary.lines.map((line) => String(line ?? ""))
    : [];
  const rawText = sourceLines.join("\n");
  const normalized = summarizeOutputText(rawText, limits);
  const sourceLineCount = Math.max(
    0,
    Math.floor(finiteNumber(summary?.lineCount, normalized.lineCount)),
  );
  const redactionApplied = sourceLines.some((line) => (
    SECRET_ASSIGNMENT_PATTERN.test(line) ||
    HOME_PATH_TEST_PATTERN.test(line) ||
    line.includes("[redacted]") ||
    line.includes("[home]")
  ));

  return {
    summary: {
      lines: normalized.lines,
      lineCount: Math.max(sourceLineCount, normalized.lineCount),
      truncated: summary?.truncated === true ||
        normalized.truncated === true ||
        sourceLines.length > normalized.lines.length ||
        sourceLineCount > normalized.lines.length,
    },
    redactionApplied,
  };
}

function normalizedWorkingDirectoryKind(summary = {}) {
  const kind = summary.workingDirectoryKind ?? summary.cwdKind ?? summary.cwdLabel ?? "";
  return WORKING_DIRECTORY_KINDS.has(kind) ? kind : "";
}

function normalizedCommandKind(summary = {}) {
  if (typeof summary.commandKind === "string" && summary.commandKind.trim()) {
    return boundedText(summary.commandKind, 120);
  }
  if (summary.safety?.allowlisted === true) {
    return "allowlisted-validation-proposal";
  }
  return "validation-proposal";
}

function cloneEntry(entry) {
  return JSON.parse(JSON.stringify(entry));
}

export function createValidationResultCacheEntry(validationResult = {}, options = {}) {
  const source = validationResult?.resultSummary &&
    typeof validationResult.resultSummary === "object"
    ? validationResult.resultSummary
    : validationResult;
  const stdout = normalizeOutputSummary(source.stdoutSummary, options);
  const stderr = normalizeOutputSummary(source.stderrSummary, options);
  const label = boundedText(
    source.label ?? source.commandLabel ?? source.proposalId ?? "validation",
    160,
  );
  const summaryText = boundedText(source.summaryText ?? source.summary ?? "", 800);

  return {
    version: VALIDATION_RESULT_CACHE_ENTRY_VERSION,
    proposalId: boundedText(source.proposalId ?? "", 120),
    label,
    status: boundedText(source.status ?? "unknown", 80),
    exitCode: source.exitCode == null ? null : Math.floor(finiteNumber(source.exitCode)),
    startedAt: boundedText(source.startedAt ?? "", 80),
    finishedAt: boundedText(source.finishedAt ?? "", 80),
    durationMs: source.durationMs == null
      ? null
      : Math.max(0, Math.floor(finiteNumber(source.durationMs))),
    summaryText,
    workingDirectoryKind: normalizedWorkingDirectoryKind(source),
    commandKind: normalizedCommandKind(source),
    stdoutSummary: stdout.summary,
    stderrSummary: stderr.summary,
    truncated: source.truncated === true ||
      stdout.summary.truncated === true ||
      stderr.summary.truncated === true,
    redactionApplied: source.redactionApplied === true ||
      stdout.redactionApplied ||
      stderr.redactionApplied ||
      summaryText.includes("[redacted]") ||
      summaryText.includes("[home]"),
    safety: {
      allowlisted: source.safety?.allowlisted === true,
      shell: source.safety?.shell === true,
      fixedArgs: source.safety?.fixedArgs === true,
      userProvidedCommand: source.safety?.userProvidedCommand === true,
      writesFiles: source.safety?.writesFiles === true,
      providerCalls: source.safety?.providerCalls === true,
      launcherCalls: source.safety?.launcherCalls === true,
      mcpServerCalls: source.safety?.mcpServerCalls === true,
    },
  };
}

export function createValidationResultCache(options = {}) {
  const maxSize = clampInteger(
    options.maxSize,
    DEFAULT_VALIDATION_RESULT_CACHE_MAX_SIZE,
    1,
    20,
  );
  const entryOptions = outputSummaryOptions(options);
  let entries = [];

  return {
    add(validationResult) {
      const entry = createValidationResultCacheEntry(validationResult, entryOptions);
      entries = [entry, ...entries].slice(0, maxSize);
      return cloneEntry(entry);
    },
    list() {
      return entries.map((entry) => cloneEntry(entry));
    },
    latest() {
      return entries[0] ? cloneEntry(entries[0]) : null;
    },
    clear() {
      const count = entries.length;
      entries = [];
      return count;
    },
    size() {
      return entries.length;
    },
  };
}

import { summarizeOutputText } from "./validation-result-summary.mjs";

export const VALIDATION_RESULT_CACHE_ENTRY_VERSION = "pccx.validationResultCacheEntry.v0";
export const VALIDATION_RESULT_CACHE_STATUS_VERSION = "pccx.validationResultCacheStatus.v0";
export const DEFAULT_VALIDATION_RESULT_CACHE_MAX_SIZE = 5;
export const DEFAULT_VALIDATION_RESULT_CACHE_OUTPUT_LINES = 20;
export const DEFAULT_VALIDATION_RESULT_CACHE_DISPLAY_LINES = 8;

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

function lineCount(summary) {
  return Math.max(0, Math.floor(finiteNumber(summary?.lineCount)));
}

function outputLines(summary, maxLines = DEFAULT_VALIDATION_RESULT_CACHE_DISPLAY_LINES) {
  return Array.isArray(summary?.lines)
    ? summary.lines
      .map((line) => boundedText(String(line ?? ""), 500))
      .slice(0, Math.max(0, maxLines))
    : [];
}

function yesNo(value) {
  return value === true ? "yes" : "no";
}

function latestStatus(entry) {
  if (!entry) {
    return null;
  }
  return {
    proposalId: boundedText(entry.proposalId ?? "", 120),
    label: boundedText(entry.label ?? "", 160),
    status: boundedText(entry.status ?? "unknown", 80),
    exitCode: entry.exitCode == null ? null : Math.floor(finiteNumber(entry.exitCode)),
    durationMs: entry.durationMs == null
      ? null
      : Math.max(0, Math.floor(finiteNumber(entry.durationMs))),
    truncated: entry.truncated === true,
    redactionApplied: entry.redactionApplied === true,
  };
}

export function createValidationResultCacheStatus(entries = [], maxSize = DEFAULT_VALIDATION_RESULT_CACHE_MAX_SIZE) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  return {
    version: VALIDATION_RESULT_CACHE_STATUS_VERSION,
    count: safeEntries.length,
    maxSize: Math.max(0, Math.floor(finiteNumber(maxSize))),
    latest: latestStatus(safeEntries[0]),
    truncated: safeEntries.some((entry) => entry?.truncated === true),
    redactionApplied: safeEntries.some((entry) => entry?.redactionApplied === true),
    summaryOnly: true,
    fullLogsExcluded: true,
  };
}

export function formatValidationResultCacheEntry(entry = {}, options = {}) {
  const maxLines = clampInteger(
    options.maxDisplayLines,
    DEFAULT_VALIDATION_RESULT_CACHE_DISPLAY_LINES,
    0,
    40,
  );
  const stdoutLines = outputLines(entry.stdoutSummary, maxLines);
  const stderrLines = outputLines(entry.stderrSummary, maxLines);
  const lines = [
    "Validation Result Summary",
    `proposalId: ${boundedText(entry.proposalId ?? "", 120) || "(none)"}`,
    `label: ${boundedText(entry.label ?? "", 160) || "validation"}`,
    `status: ${boundedText(entry.status ?? "unknown", 80)}`,
    `exitCode: ${entry.exitCode == null ? "none" : Math.floor(finiteNumber(entry.exitCode))}`,
    `durationMs: ${entry.durationMs == null ? "none" : Math.max(0, Math.floor(finiteNumber(entry.durationMs)))}`,
    `workingDirectoryKind: ${boundedText(entry.workingDirectoryKind ?? "", 80) || "unknown"}`,
    `commandKind: ${boundedText(entry.commandKind ?? "", 120) || "validation-proposal"}`,
    `redactionApplied: ${yesNo(entry.redactionApplied === true)}`,
    `truncated: ${yesNo(entry.truncated === true)}`,
    `summary: ${boundedText(entry.summaryText ?? "", 800) || "(none)"}`,
    `stdoutSummary: ${lineCount(entry.stdoutSummary)} line(s), shown ${stdoutLines.length}, truncated=${yesNo(entry.stdoutSummary?.truncated === true)}`,
    ...stdoutLines.map((line) => `  ${line}`),
    `stderrSummary: ${lineCount(entry.stderrSummary)} line(s), shown ${stderrLines.length}, truncated=${yesNo(entry.stderrSummary?.truncated === true)}`,
    ...stderrLines.map((line) => `  ${line}`),
  ];
  return lines.join("\n");
}

export function formatValidationResultCacheStatus(status = {}) {
  const latest = status.latest;
  return [
    "Validation Cache Status",
    `count: ${Math.max(0, Math.floor(finiteNumber(status.count)))}`,
    `maxSize: ${Math.max(0, Math.floor(finiteNumber(status.maxSize)))}`,
    `latestProposalId: ${latest?.proposalId || "(none)"}`,
    `latestLabel: ${latest?.label || "(none)"}`,
    `latestStatus: ${latest?.status || "(none)"}`,
    `latestExitCode: ${latest?.exitCode == null ? "none" : latest.exitCode}`,
    `latestDurationMs: ${latest?.durationMs == null ? "none" : latest.durationMs}`,
    `redactionApplied: ${yesNo(status.redactionApplied === true)}`,
    `truncated: ${yesNo(status.truncated === true)}`,
    `summaryOnly: ${yesNo(status.summaryOnly === true)}`,
    `fullLogsExcluded: ${yesNo(status.fullLogsExcluded === true)}`,
  ].join("\n");
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
    status() {
      return createValidationResultCacheStatus(entries, maxSize);
    },
    maxSize() {
      return maxSize;
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

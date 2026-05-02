export const VALIDATION_RESULT_SUMMARY_VERSION = "pccx.validationResultSummary.v0";

export const DEFAULT_VALIDATION_SUMMARY_LIMITS = Object.freeze({
  maxOutputLines: 120,
  maxLineCharacters: 500,
  maxTextCharacters: 8000,
});

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/g;

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

function summaryLimits(options = {}) {
  return {
    maxOutputLines: clampInteger(
      options.maxOutputLines,
      DEFAULT_VALIDATION_SUMMARY_LIMITS.maxOutputLines,
      1,
      500,
    ),
    maxLineCharacters: clampInteger(
      options.maxLineCharacters,
      DEFAULT_VALIDATION_SUMMARY_LIMITS.maxLineCharacters,
      80,
      2000,
    ),
    maxTextCharacters: clampInteger(
      options.maxTextCharacters,
      DEFAULT_VALIDATION_SUMMARY_LIMITS.maxTextCharacters,
      500,
      50000,
    ),
  };
}

function redactLine(line, maxLineCharacters) {
  const text = String(line ?? "");
  if (SECRET_ASSIGNMENT_PATTERN.test(text)) {
    return "[redacted]";
  }
  return text
    .replace(HOME_PATH_PATTERN, "[home]")
    .slice(0, maxLineCharacters);
}

export function summarizeOutputText(value, options = {}) {
  const limits = summaryLimits(options);
  if (typeof value !== "string" || value.length === 0) {
    return {
      lines: [],
      lineCount: 0,
      truncated: false,
    };
  }

  const text = value.slice(0, limits.maxTextCharacters);
  const allLines = text.split(/\r?\n/);
  if (allLines.at(-1) === "") {
    allLines.pop();
  }
  const lines = allLines
    .slice(0, limits.maxOutputLines)
    .map((line) => redactLine(line, limits.maxLineCharacters));

  return {
    lines,
    lineCount: allLines.length,
    truncated: value.length > text.length || allLines.length > lines.length,
  };
}

function compactFailureHints(result, stdoutSummary, stderrSummary) {
  if (result?.status === "passed") {
    return [];
  }
  const lines = [
    ...stderrSummary.lines,
    ...stdoutSummary.lines,
  ];
  const hints = [];
  for (const line of lines) {
    if (/error|failed|failure|traceback|timed out|timeout|blocked/i.test(line)) {
      hints.push(line);
    }
    if (hints.length >= 3) {
      break;
    }
  }
  if (hints.length === 0 && typeof result?.blockedReason === "string" && result.blockedReason) {
    hints.push(redactLine(result.blockedReason, 500));
  }
  return hints;
}

export function createValidationResultSummary(result = {}, options = {}) {
  const limits = summaryLimits(options);
  const stdoutSummary = result.stdoutSummary?.lines
    ? {
        lines: result.stdoutSummary.lines.map((line) => redactLine(line, limits.maxLineCharacters)),
        lineCount: Math.max(0, Math.floor(finiteNumber(
          result.stdoutSummary.lineCount,
          result.stdoutSummary.lines.length,
        ))),
        truncated: result.stdoutSummary.truncated === true,
      }
    : summarizeOutputText(result.stdout ?? "", limits);
  const stderrSummary = result.stderrSummary?.lines
    ? {
        lines: result.stderrSummary.lines.map((line) => redactLine(line, limits.maxLineCharacters)),
        lineCount: Math.max(0, Math.floor(finiteNumber(
          result.stderrSummary.lineCount,
          result.stderrSummary.lines.length,
        ))),
        truncated: result.stderrSummary.truncated === true,
      }
    : summarizeOutputText(result.stderr ?? "", limits);
  const status = typeof result.status === "string" && result.status
    ? result.status
    : "blocked";
  const commandLabel = typeof result.commandLabel === "string" ? result.commandLabel : "";
  const proposalId = typeof result.proposalId === "string" ? result.proposalId : "";
  const exitCode = result.exitCode == null ? null : Math.floor(finiteNumber(result.exitCode));
  const summary = [
    commandLabel || proposalId || "validation",
    status,
    exitCode == null ? "" : `(exit ${exitCode})`,
  ].filter(Boolean).join(" ");

  return {
    version: VALIDATION_RESULT_SUMMARY_VERSION,
    proposalId,
    commandLabel,
    status,
    summary,
    exitCode,
    durationMs: Number.isFinite(result.durationMs)
      ? Math.max(0, Math.floor(result.durationMs))
      : null,
    startedAt: typeof result.startedAt === "string" ? result.startedAt : "",
    finishedAt: typeof result.finishedAt === "string" ? result.finishedAt : "",
    command: typeof result.command === "string" ? result.command : "",
    args: Array.isArray(result.args)
      ? result.args.filter((arg) => typeof arg === "string").map((arg) => redactLine(arg, 500))
      : [],
    cwdKind: typeof result.cwdKind === "string" ? result.cwdKind : "",
    cwdLabel: typeof result.cwdLabel === "string" ? result.cwdLabel : "",
    stdoutSummary,
    stderrSummary,
    failureHints: compactFailureHints(result, stdoutSummary, stderrSummary),
    safety: {
      allowlisted: result.safety?.allowlisted === true,
      shell: result.safety?.shell === true,
      fixedArgs: result.safety?.fixedArgs === true,
      userProvidedCommand: result.safety?.userProvidedCommand === true,
      writesFiles: result.safety?.writesFiles === true,
      providerCalls: result.safety?.providerCalls === true,
      launcherCalls: result.safety?.launcherCalls === true,
      mcpServerCalls: result.safety?.mcpServerCalls === true,
    },
  };
}

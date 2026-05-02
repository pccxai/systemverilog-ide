import { execFile } from "node:child_process";
import { resolve } from "node:path";

import { normalizeConfig } from "./config.mjs";
import { findValidationCommandProposalById } from "./validation-proposals.mjs";
import {
  createValidationResultSummary,
  summarizeOutputText,
} from "./validation-result-summary.mjs";

export const APPROVED_VALIDATION_RESULT_VERSION = "pccx.approvedValidationResult.v0";

const DISALLOWED_ARG_PATTERN =
  /(?:&&|\|\||;|`|\$\(|>|<|\brm\b|\bsudo\b|\bgit\b|\bgh\b|\bcommit\b|\bpush\b|\bmerge\b|\brelease\b|\btag\b|\bruleset\b|\bsettings\b|\bsecret\b|\bpatch\b)/i;
const ALLOWED_EXECUTABLES = new Set(["bash", "python3"]);
const PROPOSAL_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

function nowIso(clock = Date) {
  return new Date(clock.now()).toISOString();
}

function durationMs(startedMs, finishedMs) {
  return Math.max(0, Math.floor(finishedMs - startedMs));
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function resolveApprovedValidationProposalId(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input && typeof input === "object" && typeof input.proposalId === "string") {
    return input.proposalId;
  }
  return null;
}

function safeBaseResult(proposalId, proposal = null) {
  const argv = safeArray(proposal?.command?.argv);
  return {
    version: APPROVED_VALIDATION_RESULT_VERSION,
    kind: "approved-validation-result",
    proposalId: proposalId ?? "",
    commandLabel: proposal?.label ?? "",
    command: argv[0] ?? "",
    args: argv.slice(1),
    cwdKind: proposal?.command?.cwd ?? "",
    cwdLabel: proposal?.command?.cwd ?? "",
    exitCode: null,
    status: "blocked",
    stdoutSummary: { lines: [], lineCount: 0, truncated: false },
    stderrSummary: { lines: [], lineCount: 0, truncated: false },
    startedAt: "",
    finishedAt: "",
    durationMs: 0,
    blockedReason: "",
    safety: {
      allowlisted: Boolean(proposal?.command),
      shell: false,
      fixedArgs: true,
      userProvidedCommand: false,
      writesFiles: false,
      providerCalls: false,
      launcherCalls: false,
      mcpServerCalls: false,
    },
    ok: false,
  };
}

function blockedResult(proposalId, proposal, reason, options = {}) {
  const startedMs = options.startedMs ?? Date.now();
  const finishedMs = options.finishedMs ?? startedMs;
  const result = {
    ...safeBaseResult(proposalId, proposal),
    blockedReason: reason,
    startedAt: options.startedAt ?? "",
    finishedAt: options.finishedAt ?? "",
    durationMs: durationMs(startedMs, finishedMs),
    stderrSummary: summarizeOutputText(reason, {
      maxOutputLines: options.maxOutputLines ?? 1,
    }),
  };
  result.resultSummary = createValidationResultSummary(result, {
    maxOutputLines: options.maxOutputLines,
  });
  return result;
}

function validateAllowlistedCommand(proposal) {
  const argv = safeArray(proposal?.command?.argv);
  if (!proposal?.command || argv.length === 0) {
    throw new Error("validation proposal has no executable command");
  }
  const executable = argv[0];
  if (!ALLOWED_EXECUTABLES.has(executable)) {
    throw new Error(`validation executable is not allowlisted: ${executable}`);
  }
  for (const item of argv) {
    if (DISALLOWED_ARG_PATTERN.test(item)) {
      throw new Error(`validation command contains a blocked argument pattern: ${item}`);
    }
  }
  for (const [key, value] of Object.entries(proposal.command.env ?? {})) {
    if (DISALLOWED_ARG_PATTERN.test(key) || DISALLOWED_ARG_PATTERN.test(String(value))) {
      throw new Error(`validation command contains a blocked environment shape: ${key}`);
    }
  }
  return {
    executable,
    args: argv.slice(1),
  };
}

function cwdForProposal(proposal, options = {}) {
  const cwdKind = proposal?.command?.cwd ?? options.defaultWorkingDirectory ?? "repo-root";
  if (cwdKind === "repo-root") {
    return {
      cwd: options.repoRoot ?? process.cwd(),
      cwdKind: "repo-root",
      cwdLabel: "repo-root",
    };
  }
  if (cwdKind === "workspace") {
    return {
      cwd: options.workspaceRoot ?? options.repoRoot ?? process.cwd(),
      cwdKind: "workspace",
      cwdLabel: "workspace",
    };
  }
  return {
    cwd: options.repoRoot ?? process.cwd(),
    cwdKind: "repo-root",
    cwdLabel: "repo-root",
  };
}

function envForProposal(proposal, options = {}) {
  return {
    ...(options.env ?? process.env),
    ...(proposal?.command?.env ?? {}),
  };
}

function captureExecFile(executable, args, options = {}) {
  const execFileFn = options.execFile ?? execFile;
  return new Promise((resolveResult) => {
    execFileFn(
      executable,
      args,
      {
        cwd: options.cwd,
        encoding: "utf8",
        env: options.env,
        maxBuffer: 128 * 1024,
        shell: false,
        timeout: options.timeoutMs,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const timedOut = error?.killed === true ||
          error?.signal === "SIGTERM" ||
          error?.code === "ETIMEDOUT" ||
          /timed out|timeout/i.test(error?.message ?? "");
        const exitCode = error
          ? (typeof error.code === "number" ? error.code : null)
          : 0;
        resolveResult({
          exitCode,
          timedOut,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          error: error && typeof error.code !== "number" ? error.message : "",
        });
      },
    );
  });
}

export async function runApprovedValidationProposal(input, rawConfig = {}, options = {}) {
  const config = normalizeConfig(rawConfig);
  const proposalId = resolveApprovedValidationProposalId(input);
  const maxOutputLines = config.validationRunner.maxOutputLines;
  const startedMs = options.clock?.now?.() ?? Date.now();
  const startedAt = nowIso(options.clock ?? Date);

  if (!proposalId || !PROPOSAL_ID_PATTERN.test(proposalId)) {
    const finishedMs = options.clock?.now?.() ?? Date.now();
    return blockedResult("", null, "approved validation runner accepts a proposal ID only", {
      maxOutputLines,
      startedMs,
      finishedMs,
      startedAt,
      finishedAt: nowIso(options.clock ?? Date),
    });
  }

  const proposal = findValidationCommandProposalById(proposalId);
  if (!proposal) {
    const finishedMs = options.clock?.now?.() ?? Date.now();
    return blockedResult(proposalId, null, "unknown validation proposal ID", {
      maxOutputLines,
      startedMs,
      finishedMs,
      startedAt,
      finishedAt: nowIso(options.clock ?? Date),
    });
  }

  if (!config.validationRunner.enabled || config.validationRunner.mode !== "allowlisted") {
    const finishedMs = options.clock?.now?.() ?? Date.now();
    return blockedResult(
      proposalId,
      proposal,
      "approved validation runner is disabled; set validationRunner.enabled=true and validationRunner.mode=allowlisted",
      {
        maxOutputLines,
        startedMs,
        finishedMs,
        startedAt,
        finishedAt: nowIso(options.clock ?? Date),
      },
    );
  }

  if (proposal.runnerPolicy === "proposalOnly") {
    const finishedMs = options.clock?.now?.() ?? Date.now();
    return blockedResult(
      proposalId,
      proposal,
      proposal.runnerBlockedReason || "validation proposal remains proposal-only",
      {
        maxOutputLines,
        startedMs,
        finishedMs,
        startedAt,
        finishedAt: nowIso(options.clock ?? Date),
      },
    );
  }

  let executable;
  let args;
  try {
    ({ executable, args } = validateAllowlistedCommand(proposal));
  } catch (error) {
    const finishedMs = options.clock?.now?.() ?? Date.now();
    return blockedResult(proposalId, proposal, error.message, {
      maxOutputLines,
      startedMs,
      finishedMs,
      startedAt,
      finishedAt: nowIso(options.clock ?? Date),
    });
  }

  const cwd = cwdForProposal(proposal, {
    ...options,
    defaultWorkingDirectory: config.validationRunner.defaultWorkingDirectory,
  });
  const execution = await captureExecFile(executable, args, {
    cwd: resolve(cwd.cwd),
    env: envForProposal(proposal, options),
    execFile: options.execFile,
    timeoutMs: config.validationRunner.timeoutMs,
  });
  const finishedMs = options.clock?.now?.() ?? Date.now();
  const status = execution.timedOut
    ? "timedOut"
    : (execution.exitCode === 0 ? "passed" : "failed");
  const result = {
    ...safeBaseResult(proposalId, proposal),
    command: executable,
    args,
    cwdKind: cwd.cwdKind,
    cwdLabel: cwd.cwdLabel,
    exitCode: execution.exitCode,
    status,
    stdoutSummary: summarizeOutputText(execution.stdout, { maxOutputLines }),
    stderrSummary: summarizeOutputText(
      execution.error
        ? [execution.stderr, execution.error].filter(Boolean).join("\n")
        : execution.stderr,
      { maxOutputLines },
    ),
    startedAt,
    finishedAt: nowIso(options.clock ?? Date),
    durationMs: durationMs(startedMs, finishedMs),
    ok: status === "passed",
    safety: {
      allowlisted: true,
      shell: false,
      fixedArgs: true,
      userProvidedCommand: false,
      writesFiles: false,
      providerCalls: false,
      launcherCalls: false,
      mcpServerCalls: false,
    },
  };
  result.resultSummary = createValidationResultSummary(result, { maxOutputLines });
  return result;
}

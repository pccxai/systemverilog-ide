import {
  VALIDATION_PROPOSAL_PREFLIGHT_VERSION,
  createValidationDiagnosticsHandoffContext,
  findValidationCommandProposalById,
  listValidationCommandProposals,
} from "./validation-proposals.mjs";

export const VALIDATION_PROPOSAL_PREFLIGHT_AUDIT_VERSION =
  "pccx.validationProposalPreflightAudit.v0";

const PROPOSAL_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const MAX_CHECK_MESSAGE_CHARACTERS = 180;
const MAX_TEXT_LINES = 18;
const MAX_COLLECTED_STRINGS = 80;
const MAX_COLLECTED_STRING_CHARACTERS = 320;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/g;
const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\(|>|<)/;
const RAW_SHELL_FIELD_PATTERN =
  /^(?:command|commandLine|rawCommand|shellCommand|script|scriptText)$/i;
const LAUNCHER_COMMAND_PATTERN =
  /\b(?:pccx[-_]?llm[-_]?launcher|launcher_diagnostics_handoff|launcher\s+(?:run|status|launch|diagnostics|execute))\b/i;
const PCCX_LAB_COMMAND_PATTERN =
  /\b(?:pccx[-_]?lab|pccx_lab|pccx_ide_cli)\b/i;
const PCCX_LAB_VALIDATOR_PATTERN =
  /\b(?:diagnostics[-_ ]handoff\s+validate|validate\s+diagnostics[-_ ]handoff|pccx[-_]?lab[\s\S]{0,80}validate|pccx_ide_cli[\s\S]{0,80}validate)\b/i;
const EXECUTION_CLAIM_PATTERN = new RegExp([
  "\\b(?:provider|runtime|KV260|MCP|LSP|marketplace)\\b[^\\n]{0,80}\\b(?:ready|enabled|implemented|executes?|runs?|launch(?:es|ed)?|invoke[sd]?|calls?|integrat(?:e|ed|ion)|publishes?|uploads?|writes?|works)\\b",
  "\\b(?:ready|enabled|implemented|executes?|runs?|launch(?:es|ed)?|invoke[sd]?|calls?|integrat(?:e|ed|ion)|publishes?|uploads?|writes?|works)\\b[^\\n]{0,80}\\b(?:provider|runtime|KV260|MCP|LSP|marketplace)\\b",
].join("|"), "i");
const EXECUTION_CLAIM_NEGATION_PATTERN =
  /\b(?:no|not|never|without|does not|do not|disabled|unsupported|future|reserved|proposal-only|status-only|blocked|false)\b/i;

function scrubLine(value, maxCharacters = MAX_CHECK_MESSAGE_CHARACTERS) {
  if (typeof value !== "string" || maxCharacters <= 0) {
    return "";
  }
  const cleaned = value
    .replace(/\0/g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(HOME_PATH_PATTERN, "[home]")
    .trim();
  return (SECRET_ASSIGNMENT_PATTERN.test(cleaned) ? "[redacted]" : cleaned)
    .slice(0, maxCharacters)
    .trim();
}

function check(id, status, message) {
  return {
    id,
    status: status ? "pass" : "fail",
    message: scrubLine(message),
  };
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function proposalIdFromInput(input) {
  if (typeof input === "string") {
    return input;
  }
  if (typeof input?.proposalId === "string") {
    return input.proposalId;
  }
  if (typeof input?.proposal?.id === "string") {
    return input.proposal.id;
  }
  if (typeof input?.id === "string") {
    return input.id;
  }
  return "";
}

function directProposalFromInput(input) {
  if (safeObject(input?.proposal)) {
    return input.proposal;
  }
  if (
    safeObject(input) &&
    (
      Object.hasOwn(input, "id") ||
      Object.hasOwn(input, "category") ||
      Object.hasOwn(input, "label") ||
      Object.hasOwn(input, "command") ||
      Object.hasOwn(input, "preflight")
    ) &&
    !Object.hasOwn(input, "proposalId")
  ) {
    return input;
  }
  return null;
}

function contextInputFrom(input, options = {}) {
  return {
    contextBundle: options.contextBundle ?? input?.contextBundle,
    diagnosticsHandoffContext: options.diagnosticsHandoffContext ?? input?.diagnosticsHandoffContext,
  };
}

function collectStrings(value, options = {}, state = { count: 0, strings: [] }) {
  if (state.count >= MAX_COLLECTED_STRINGS || value == null) {
    return state.strings;
  }
  if (typeof value === "string") {
    state.count += 1;
    state.strings.push(scrubLine(value, MAX_COLLECTED_STRING_CHARACTERS));
    return state.strings;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    state.count += 1;
    state.strings.push(String(value));
    return state.strings;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, options, state);
      if (state.count >= MAX_COLLECTED_STRINGS) {
        break;
      }
    }
    return state.strings;
  }
  if (safeObject(value)) {
    for (const key of Object.keys(value).sort()) {
      if (options.skipKeys?.has(key)) {
        continue;
      }
      collectStrings(value[key], options, state);
      if (state.count >= MAX_COLLECTED_STRINGS) {
        break;
      }
    }
  }
  return state.strings;
}

function collectRawShellFindings(value, path = "", findings = []) {
  if (value == null || findings.length >= 8) {
    return findings;
  }
  if (typeof value === "string") {
    const key = path.split(".").at(-1) ?? "";
    if (RAW_SHELL_FIELD_PATTERN.test(key) || SHELL_CONTROL_PATTERN.test(value)) {
      findings.push(path || "input");
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectRawShellFindings(item, `${path}[${index}]`, findings));
    return findings;
  }
  if (safeObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (key === "shell" && item === true) {
        findings.push(nextPath);
      }
      if (findings.length >= 8) {
        break;
      }
      collectRawShellFindings(item, nextPath, findings);
    }
  }
  return findings;
}

function commandStringsFrom(input, proposal) {
  const commandInputs = [
    proposal?.command,
    safeObject(input) ? input.command : null,
    safeObject(input) ? input.argv : null,
    safeObject(input) ? input.args : null,
    safeObject(input) ? input.env : null,
    safeObject(input) ? input.executable : null,
    safeObject(input) ? input.commandLine : null,
    safeObject(input) ? input.rawCommand : null,
    safeObject(input) ? input.shellCommand : null,
  ];
  const strings = collectStrings(commandInputs);
  const joined = scrubLine(strings.join(" "), MAX_COLLECTED_STRING_CHARACTERS);
  return joined ? [...strings, joined] : strings;
}

function rawShellSourcesFrom(input, proposal) {
  const inputSources = safeObject(input)
    ? {
        command: input.command,
        argv: input.argv,
        args: input.args,
        env: input.env,
        executable: input.executable,
        commandLine: input.commandLine,
        rawCommand: input.rawCommand,
        shellCommand: input.shellCommand,
        shell: input.shell,
      }
    : input;
  return [
    { command: proposal?.command },
    inputSources,
  ];
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function commandMatchesCanonical(proposal, canonical) {
  if (!proposal?.command || !canonical?.command) {
    return false;
  }
  return proposal.command.cwd === canonical.command.cwd &&
    jsonEqual(proposal.command.argv, canonical.command.argv) &&
    jsonEqual(proposal.command.env ?? {}, canonical.command.env ?? {});
}

function hasExecutionClaim(strings) {
  return strings.some((line) => (
    EXECUTION_CLAIM_PATTERN.test(line) &&
    !EXECUTION_CLAIM_NEGATION_PATTERN.test(line)
  ));
}

function diagnosticsHandoffFromProposal(proposal, input, options = {}) {
  const context = createValidationDiagnosticsHandoffContext(contextInputFrom(input, options));
  const proposalPreflight = proposal?.preflight?.diagnosticsHandoff;
  return {
    status: proposalPreflight?.status ?? context.status,
    source: proposalPreflight?.source ?? context.source,
    summaryAvailable: proposalPreflight?.summaryAvailable ?? context.summaryAvailable,
    contextOnly: true,
    executionInput: false,
  };
}

function allowedRunnerIds(input, options = {}) {
  return listValidationCommandProposals(contextInputFrom(input, options))
    .filter((proposal) => proposal.command && proposal.runnerPolicy !== "proposalOnly")
    .map((proposal) => proposal.id);
}

function boundedBlockedReasons(checks) {
  return checks
    .filter((item) => item.status === "fail")
    .slice(0, 4)
    .map((item) => item.id);
}

export function createValidationProposalPreflightAudit(input = {}, options = {}) {
  const rawProposalId = proposalIdFromInput(input);
  const proposalId = scrubLine(rawProposalId, 80);
  const contextInput = contextInputFrom(input, options);
  const directProposal = directProposalFromInput(input);
  const canonical = proposalId && PROPOSAL_ID_PATTERN.test(proposalId)
    ? findValidationCommandProposalById(proposalId, contextInput)
    : null;
  const proposal = directProposal ?? canonical;
  const commandStrings = commandStringsFrom(input, proposal);
  const proposalText = collectStrings(proposal, {
    skipKeys: new Set(["diagnosticsHandoffContext"]),
  });
  const allText = collectStrings([input, proposal], {
    skipKeys: new Set(["diagnosticsHandoffContext", "contextBundle"]),
  });
  const rawShellFindings = collectRawShellFindings(rawShellSourcesFrom(input, proposal));
  const hasCommandShape = proposal?.command == null || (
    safeObject(proposal.command) &&
    typeof proposal.command.cwd === "string" &&
    Array.isArray(proposal.command.argv) &&
    proposal.command.argv.length > 0 &&
    proposal.command.argv.every((arg) => typeof arg === "string") &&
    safeObject(proposal.command.env ?? {})
  );
  const allowlistedIds = allowedRunnerIds(input, options);
  const proposalIdKnown = Boolean(proposalId && canonical);
  const commandAllowlisted = proposalIdKnown &&
    allowlistedIds.includes(proposalId) &&
    commandMatchesCanonical(proposal, canonical);
  const rawShellBlocked = rawShellFindings.length > 0 ||
    commandStrings.some((line) => SHELL_CONTROL_PATTERN.test(line));
  const launcherBlocked = commandStrings.some((line) => LAUNCHER_COMMAND_PATTERN.test(line));
  const pccxLabBlocked = commandStrings.some((line) => PCCX_LAB_COMMAND_PATTERN.test(line));
  const pccxLabValidatorBlocked = commandStrings.some((line) => (
    PCCX_LAB_VALIDATOR_PATTERN.test(line)
  ));
  const executionClaimBlocked = hasExecutionClaim(proposalText.concat(allText));
  const diagnosticsHandoff = diagnosticsHandoffFromProposal(proposal, input, options);
  const diagnosticsHandoffExecutionInput = commandStrings.some((line) => (
    /diagnosticsHandoff|diagnostics[-_ ]handoff|pccx\.diagnosticsHandoff\.v0/i.test(line)
  ));
  const diagnosticsContextOnly = diagnosticsHandoff.contextOnly === true &&
    diagnosticsHandoff.executionInput === false &&
    diagnosticsHandoffExecutionInput === false;
  const checks = [
    check(
      "proposal-id-exists",
      proposalIdKnown,
      proposalIdKnown
        ? "proposal ID resolves to a checked validation proposal"
        : "proposal ID is missing, malformed, or unknown",
    ),
    check(
      "proposal-shape",
      Boolean(proposal) && hasCommandShape,
      Boolean(proposal) && hasCommandShape
        ? "proposal shape is bounded and command is an argument array when present"
        : "proposal is missing or command shape is malformed",
    ),
    check(
      "command-allowlist",
      commandAllowlisted,
      commandAllowlisted
        ? "command matches the existing approved runner proposal allowlist"
        : "command is absent, proposal-only, placeholder, or not in the existing runner allowlist",
    ),
    check(
      "no-raw-shell",
      !rawShellBlocked,
      rawShellBlocked
        ? "raw shell string, shell flag, or shell control syntax was detected"
        : "no raw shell string, shell flag, or shell control syntax detected",
    ),
    check(
      "no-launcher-command",
      !launcherBlocked,
      launcherBlocked
        ? "launcher command wording was detected in execution inputs"
        : "no launcher command appears in execution inputs",
    ),
    check(
      "no-pccx-lab-command",
      !pccxLabBlocked,
      pccxLabBlocked
        ? "pccx-lab command wording was detected; no existing runner policy allows it"
        : "no pccx-lab command appears in execution inputs",
    ),
    check(
      "no-pccx-lab-validator",
      !pccxLabValidatorBlocked,
      pccxLabValidatorBlocked
        ? "pccx-lab diagnostics handoff validator invocation was detected"
        : "no pccx-lab diagnostics handoff validator invocation detected",
    ),
    check(
      "no-execution-claim-wording",
      !executionClaimBlocked,
      executionClaimBlocked
        ? "provider/runtime/KV260/MCP/LSP/marketplace wording implies execution"
        : "no provider/runtime/KV260/MCP/LSP/marketplace execution claim detected",
    ),
    check(
      "diagnostics-handoff-context-only",
      diagnosticsContextOnly,
      diagnosticsContextOnly
        ? "diagnostics handoff is represented as proposal context only"
        : "diagnostics handoff appears in command argv, env, or another execution input",
    ),
  ];
  const failedCheckIds = boundedBlockedReasons(checks);
  const eligibleForApprovedRunner = failedCheckIds.length === 0;

  return {
    version: VALIDATION_PROPOSAL_PREFLIGHT_AUDIT_VERSION,
    kind: "validation-proposal-preflight-audit",
    proposalId,
    status: eligibleForApprovedRunner ? "passed" : "failed",
    eligibleForApprovedRunner,
    execution: "auditOnly",
    proposalOnly: true,
    executes: false,
    auditScope: "validation-proposal-to-approved-runner",
    preflightVersion: VALIDATION_PROPOSAL_PREFLIGHT_VERSION,
    blockedReason: eligibleForApprovedRunner
      ? ""
      : `validation proposal preflight audit failed: ${failedCheckIds.join(", ")}`,
    checks,
    diagnosticsHandoff,
    allowlist: {
      source: "existing-approved-validation-runner",
      broadened: false,
      runnerProposalIds: allowlistedIds,
    },
    findings: {
      rawShellString: rawShellBlocked,
      launcherCommand: launcherBlocked,
      pccxLabCommand: pccxLabBlocked,
      pccxLabValidatorInvocation: pccxLabValidatorBlocked,
      executionClaimWording: executionClaimBlocked,
      diagnosticsHandoffExecutionInput,
    },
    bounds: {
      maxCheckCount: checks.length,
      maxCheckMessageCharacters: MAX_CHECK_MESSAGE_CHARACTERS,
      maxTextLines: MAX_TEXT_LINES,
      rawLogsExcluded: true,
    },
    safety: {
      auditOnly: true,
      dataOnly: true,
      readOnly: true,
      proposalOnly: true,
      automaticExecution: false,
      allowlistBroadened: false,
      shellExecution: false,
      rawShellStringExecution: false,
      launcherExecution: false,
      pccxLabExecution: false,
      pccxLabValidatorInvocation: false,
      providerCalls: false,
      networkCalls: false,
      runtimeCalls: false,
      mcpCalls: false,
      lspImplemented: false,
      marketplaceFlow: false,
      telemetry: false,
      automaticUpload: false,
      writeBack: false,
    },
  };
}

export function formatValidationProposalPreflightAudit(audit, options = {}) {
  const maxLines = Number.isInteger(options.maxLines) ? options.maxLines : MAX_TEXT_LINES;
  const lines = [
    "Validation Proposal Preflight Audit",
    `version: ${scrubLine(audit?.version ?? "", 120)}`,
    `proposalId: ${scrubLine(audit?.proposalId ?? "", 80)}`,
    `status: ${audit?.status === "passed" ? "passed" : "failed"}`,
    `eligibleForApprovedRunner: ${audit?.eligibleForApprovedRunner === true ? "yes" : "no"}`,
    `execution: ${audit?.executes === false ? "no command executed" : "unexpected execution flag"}`,
    `allowlistBroadened: ${audit?.allowlist?.broadened === false ? "no" : "unknown"}`,
    `diagnosticsHandoff: ${scrubLine(audit?.diagnosticsHandoff?.status ?? "unavailable", 80)} context-only`,
    "checks:",
  ];

  for (const item of audit?.checks ?? []) {
    lines.push(`- ${item.status}: ${item.id} - ${scrubLine(item.message)}`);
    if (lines.length >= maxLines) {
      break;
    }
  }
  if (audit?.blockedReason && lines.length < maxLines) {
    lines.push(`blockedReason: ${scrubLine(audit.blockedReason)}`);
  }
  return lines.slice(0, maxLines).join("\n");
}

export const VALIDATION_PROPOSAL_VERSION = "pccx.validationCommandProposal.v0";
export const VALIDATION_PROPOSAL_DIAGNOSTICS_HANDOFF_CONTEXT_VERSION =
  "pccx.validationProposalDiagnosticsHandoffContext.v0";
export const VALIDATION_PROPOSAL_PREFLIGHT_VERSION =
  "pccx.validationProposalPreflight.v0";

export const VALIDATION_PROPOSAL_CATEGORIES = Object.freeze([
  "vscodeAdapterSmoke",
  "editorBridgeSmoke",
  "exampleDriftCheck",
  "pytestBaseline",
  "extensionHostSmoke",
  "futurePccxLabDiagnostics",
  "futureXsimLogAnalysis",
]);

const PROPOSALS = Object.freeze([
  Object.freeze({
    id: "vscodeAdapterSmoke",
    category: "vscodeAdapterSmoke",
    label: "VS Code adapter smoke",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["bash", "scripts/vscode-adapter-smoke.sh"]),
      env: Object.freeze({}),
    }),
    reason: "Checks the VS Code prototype adapter, facade, boundary, and static guard suite.",
    riskLevel: "low",
  }),
  Object.freeze({
    id: "editorBridgeSmoke",
    category: "editorBridgeSmoke",
    label: "Editor bridge smoke",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["bash", "scripts/editor-bridge-smoke.sh"]),
      env: Object.freeze({}),
    }),
    reason: "Checks the editor bridge examples and CLI contract conversion path.",
    riskLevel: "low",
  }),
  Object.freeze({
    id: "exampleDriftCheck",
    category: "exampleDriftCheck",
    label: "Editor bridge example drift check",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["bash", "scripts/check-editor-bridge-examples.sh"]),
      env: Object.freeze({}),
    }),
    reason: "Verifies checked-in editor bridge examples still match the current CLI behavior.",
    riskLevel: "low",
  }),
  Object.freeze({
    id: "pytestBaseline",
    category: "pytestBaseline",
    label: "Python pytest baseline",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["python3", "-m", "pytest", "-q"]),
      env: Object.freeze({
        PYTHONDONTWRITEBYTECODE: "1",
        PYTEST_ADDOPTS: "-p no:cacheprovider",
      }),
    }),
    reason: "Runs the repository Python baseline used by the lightweight CI path.",
    riskLevel: "low",
  }),
  Object.freeze({
    id: "extensionHostSmokeOptIn",
    category: "extensionHostSmoke",
    label: "VS Code Extension Host smoke",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["bash", "scripts/vscode-extension-host-smoke.sh"]),
      env: Object.freeze({ PCCX_RUN_EXTENSION_HOST_SMOKE: "1" }),
    }),
    reason: "Runs the opt-in local Extension Host smoke against the controlled fixture workspace.",
    riskLevel: "medium",
    runnerPolicy: "proposalOnly",
    runnerBlockedReason: "Extension Host smoke remains opt-in local-only and is not executed from inside the approved validation runner.",
  }),
  Object.freeze({
    id: "futurePccxLabDiagnostics",
    category: "futurePccxLabDiagnostics",
    label: "Future pccx-lab diagnostics validation",
    command: null,
    placeholder: true,
    reason: "Reserved for a later allowlisted pccx-lab command palette integration.",
    riskLevel: "medium",
  }),
  Object.freeze({
    id: "futureXsimLogAnalysis",
    category: "futureXsimLogAnalysis",
    label: "Future xsim-log analysis validation",
    command: null,
    placeholder: true,
    reason: "Reserved for later controlled xsim-log analysis through the pccx-lab boundary.",
    riskLevel: "medium",
  }),
]);

const DIAGNOSTICS_HANDOFF_SOURCE = "contextBundle.diagnosticsHandoff";
const MAX_PREFLIGHT_NOTES = 4;
const MAX_ISSUE_NOTES = 3;
const MAX_NOTE_CHARACTERS = 240;
const MAX_SUMMARY_CHARACTERS = 320;
const HANDOFF_SEVERITIES = Object.freeze(["info", "warning", "blocked", "error"]);
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|[A-Za-z]:\\Users\\)/g;

function scrubLine(value, maxCharacters = MAX_NOTE_CHARACTERS) {
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

function boundedNotes(values, limit) {
  const seen = new Set();
  const notes = [];
  for (const value of values) {
    const note = scrubLine(value);
    if (note.length === 0 || seen.has(note)) {
      continue;
    }
    seen.add(note);
    notes.push(note);
    if (notes.length >= limit) {
      break;
    }
  }
  return notes;
}

function count(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function severityCounts(context) {
  return Object.fromEntries(HANDOFF_SEVERITIES.map((severity) => [
    severity,
    count(context?.diagnostics?.bySeverity?.[severity]),
  ]));
}

function diagnosticsHandoffSafetyBase() {
  return {
    dataOnly: true,
    readOnly: true,
    proposalOnly: true,
    launcherExecution: false,
    pccxLabExecution: false,
    pccxLabValidatorInvocation: false,
    shellExecution: false,
    providerCalls: false,
    networkCalls: false,
    runtimeCalls: false,
    mcpCalls: false,
    lspImplemented: false,
    marketplaceFlow: false,
    telemetry: false,
    automaticUpload: false,
    writeBack: false,
  };
}

function isSafeDiagnosticsHandoffContext(context) {
  const safety = context?.safety ?? {};
  return context?.kind === "diagnostics-handoff-context" &&
    context?.source?.rawHandoffParsedByUi !== true &&
    safety.dataOnly === true &&
    safety.readOnly === true &&
    safety.launcherExecution !== true &&
    safety.pccxLabExecution !== true &&
    safety.pccxLabValidatorInvocation !== true &&
    safety.shellExecution !== true &&
    safety.providerCalls !== true &&
    safety.networkCalls !== true &&
    safety.runtimeCalls !== true &&
    safety.mcpCalls !== true &&
    safety.lspImplemented !== true &&
    safety.marketplaceFlow !== true &&
    safety.telemetry !== true &&
    safety.automaticUpload !== true &&
    safety.writeBack !== true;
}

function diagnosticsHandoffContextFromInput(input = {}) {
  return input?.contextBundle?.diagnosticsHandoff ??
    input?.diagnosticsHandoffContext ??
    null;
}

function unavailableDiagnosticsHandoffContext(reason = "") {
  return {
    version: VALIDATION_PROPOSAL_DIAGNOSTICS_HANDOFF_CONTEXT_VERSION,
    source: DIAGNOSTICS_HANDOFF_SOURCE,
    status: "unavailable",
    sourceStatus: "notAvailable",
    summaryAvailable: false,
    summary: "Diagnostics handoff context unavailable in the local context bundle.",
    diagnostics: {
      count: 0,
      bySeverity: Object.fromEntries(HANDOFF_SEVERITIES.map((severity) => [severity, 0])),
    },
    preflightNotes: boundedNotes([
      "No diagnostics handoff summary is available from the local context bundle.",
      "Validation proposals remain allowlisted, proposal-only data.",
      reason,
    ], MAX_PREFLIGHT_NOTES),
    issueNotes: boundedNotes([reason], MAX_ISSUE_NOTES),
    safety: diagnosticsHandoffSafetyBase(),
  };
}

function invalidDiagnosticsHandoffContext(context, reason = "") {
  return {
    version: VALIDATION_PROPOSAL_DIAGNOSTICS_HANDOFF_CONTEXT_VERSION,
    source: DIAGNOSTICS_HANDOFF_SOURCE,
    status: "invalid",
    sourceStatus: scrubLine(context?.status ?? "invalid", 80) || "invalid",
    summaryAvailable: false,
    summary: "Diagnostics handoff context invalid or unsafe in the local context bundle.",
    diagnostics: {
      count: 0,
      bySeverity: Object.fromEntries(HANDOFF_SEVERITIES.map((severity) => [severity, 0])),
    },
    preflightNotes: boundedNotes([
      "Diagnostics handoff context was rejected before proposal display.",
      "Validation proposals remain allowlisted, proposal-only data.",
      "Invalid handoff context does not trigger launcher, pccx-lab, validator, shell, provider, runtime, MCP, LSP, marketplace, telemetry, upload, or write-back flows.",
    ], MAX_PREFLIGHT_NOTES),
    issueNotes: boundedNotes([
      reason,
      context?.reason,
      "Diagnostics handoff context must stay data-only and read-only.",
    ], MAX_ISSUE_NOTES),
    safety: diagnosticsHandoffSafetyBase(),
  };
}

function availableDiagnosticsHandoffContext(context) {
  const bySeverity = severityCounts(context);
  const diagnosticCount = count(context?.diagnostics?.count);
  const schemaVersion = scrubLine(context?.handoff?.schemaVersion ?? "", 120);
  const summary = scrubLine(
    `Diagnostics handoff context available: ${diagnosticCount} diagnostic item(s), ` +
      `${bySeverity.blocked} blocked, ${bySeverity.warning} warning, ${bySeverity.error} error.`,
    MAX_SUMMARY_CHARACTERS,
  );
  const limitationNotes = Array.isArray(context?.limitations) ? context.limitations : [];

  return {
    version: VALIDATION_PROPOSAL_DIAGNOSTICS_HANDOFF_CONTEXT_VERSION,
    source: DIAGNOSTICS_HANDOFF_SOURCE,
    status: "available",
    sourceStatus: scrubLine(context?.status ?? "available", 80) || "available",
    summaryAvailable: true,
    schemaVersion,
    summary,
    diagnostics: {
      count: diagnosticCount,
      bySeverity,
    },
    preflightNotes: boundedNotes([
      "Diagnostics handoff summary is available from the local context bundle.",
      schemaVersion ? `Schema ${schemaVersion}; read-only summary data only.` : "",
      "Validation proposals remain proposal-only until an approved validation runner accepts an allowlisted proposal ID.",
      ...limitationNotes,
    ], MAX_PREFLIGHT_NOTES),
    issueNotes: boundedNotes([
      bySeverity.blocked > 0
        ? `${bySeverity.blocked} blocked handoff diagnostic(s) are present in the summary.`
        : "",
      bySeverity.warning > 0
        ? `${bySeverity.warning} warning handoff diagnostic(s) are present in the summary.`
        : "",
      bySeverity.error > 0
        ? `${bySeverity.error} error handoff diagnostic(s) are present in the summary.`
        : "",
    ], MAX_ISSUE_NOTES),
    safety: diagnosticsHandoffSafetyBase(),
  };
}

export function createValidationDiagnosticsHandoffContext(input = {}) {
  const context = diagnosticsHandoffContextFromInput(input);
  if (!context) {
    return unavailableDiagnosticsHandoffContext();
  }
  if (context.kind !== "diagnostics-handoff-context") {
    return unavailableDiagnosticsHandoffContext(
      "Validation proposals accept only the normalized context bundle diagnosticsHandoff section.",
    );
  }
  if (!isSafeDiagnosticsHandoffContext(context)) {
    return invalidDiagnosticsHandoffContext(
      context,
      "Diagnostics handoff context failed data-only/read-only safety checks.",
    );
  }
  if (context.status === "invalid") {
    return invalidDiagnosticsHandoffContext(context, context.reason);
  }
  if (context.status === "available" && context.summaryAvailable === true) {
    return availableDiagnosticsHandoffContext(context);
  }
  return unavailableDiagnosticsHandoffContext(context.reason);
}

function cloneCommand(command) {
  if (!command) {
    return null;
  }
  return {
    cwd: command.cwd,
    argv: [...command.argv],
    env: { ...command.env },
  };
}

function proposalStatus(proposal, diagnosticsHandoffContext) {
  return {
    proposalOnly: true,
    commandAvailable: Boolean(proposal.command),
    placeholder: proposal.placeholder === true,
    diagnosticsHandoff: diagnosticsHandoffContext.status,
  };
}

function proposalPreflight(diagnosticsHandoffContext) {
  return {
    version: VALIDATION_PROPOSAL_PREFLIGHT_VERSION,
    diagnosticsHandoff: {
      source: diagnosticsHandoffContext.source,
      status: diagnosticsHandoffContext.status,
      summaryAvailable: diagnosticsHandoffContext.summaryAvailable,
      summary: diagnosticsHandoffContext.summary,
      issueNoteCount: diagnosticsHandoffContext.issueNotes.length,
    },
  };
}

function cloneProposal(proposal, diagnosticsHandoffContext) {
  return {
    id: proposal.id,
    category: proposal.category,
    label: proposal.label,
    command: cloneCommand(proposal.command),
    placeholder: proposal.placeholder === true,
    reason: proposal.reason,
    riskLevel: proposal.riskLevel,
    runnerPolicy: proposal.runnerPolicy ?? "allowlisted",
    runnerBlockedReason: proposal.runnerBlockedReason ?? "",
    status: proposalStatus(proposal, diagnosticsHandoffContext),
    preflight: proposalPreflight(diagnosticsHandoffContext),
    reasonContext: {
      diagnosticsHandoff: diagnosticsHandoffContext.summary,
    },
    requiresUserApproval: true,
    executes: false,
  };
}

export function listValidationCommandProposals(input = {}) {
  const diagnosticsHandoffContext = createValidationDiagnosticsHandoffContext(input);
  return PROPOSALS.map((proposal) => cloneProposal(proposal, diagnosticsHandoffContext));
}

export function findValidationCommandProposalById(proposalId, input = {}) {
  if (typeof proposalId !== "string" || proposalId.trim().length === 0) {
    return null;
  }
  const proposal = PROPOSALS.find((item) => item.id === proposalId);
  return proposal ? cloneProposal(proposal, createValidationDiagnosticsHandoffContext(input)) : null;
}

export function createValidationCommandProposal(input = {}) {
  const diagnosticsHandoffContext = createValidationDiagnosticsHandoffContext(input);
  return {
    version: VALIDATION_PROPOSAL_VERSION,
    kind: "validation-command-proposal",
    execution: "proposalOnly",
    proposalOnly: true,
    executes: false,
    requiresUserApproval: true,
    providerCalls: false,
    runtimeCalls: false,
    diagnosticsHandoffContext,
    safety: {
      ...diagnosticsHandoffSafetyBase(),
      proposalOnly: true,
    },
    commandSource: "allowlistedTemplates",
    proposals: PROPOSALS.map((proposal) => cloneProposal(proposal, diagnosticsHandoffContext)),
    disallowedActions: [
      "executeCommand",
      "spawnProcess",
      "writeFile",
      "commit",
      "push",
      "merge",
      "release",
      "tag",
      "changeRuleset",
      "accessSecrets",
    ],
  };
}

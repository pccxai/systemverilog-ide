export const VALIDATION_PROPOSAL_VERSION = "pccx.validationCommandProposal.v0";

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

function cloneProposal(proposal) {
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
    requiresUserApproval: true,
    executes: false,
  };
}

export function listValidationCommandProposals() {
  return PROPOSALS.map(cloneProposal);
}

export function findValidationCommandProposalById(proposalId) {
  if (typeof proposalId !== "string" || proposalId.trim().length === 0) {
    return null;
  }
  const proposal = PROPOSALS.find((item) => item.id === proposalId);
  return proposal ? cloneProposal(proposal) : null;
}

export function createValidationCommandProposal(_input = {}) {
  return {
    version: VALIDATION_PROPOSAL_VERSION,
    kind: "validation-command-proposal",
    execution: "proposalOnly",
    proposalOnly: true,
    executes: false,
    requiresUserApproval: true,
    providerCalls: false,
    runtimeCalls: false,
    commandSource: "allowlistedTemplates",
    proposals: listValidationCommandProposals(),
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

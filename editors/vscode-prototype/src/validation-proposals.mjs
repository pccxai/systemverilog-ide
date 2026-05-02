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
    category: "pytestBaseline",
    label: "Python pytest baseline",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["python3", "-m", "pytest", "-q"]),
      env: Object.freeze({}),
    }),
    reason: "Runs the repository Python baseline used by the lightweight CI path.",
    riskLevel: "low",
  }),
  Object.freeze({
    category: "extensionHostSmoke",
    label: "VS Code Extension Host smoke",
    command: Object.freeze({
      cwd: "repo-root",
      argv: Object.freeze(["bash", "scripts/vscode-extension-host-smoke.sh"]),
      env: Object.freeze({ PCCX_RUN_EXTENSION_HOST_SMOKE: "1" }),
    }),
    reason: "Runs the opt-in local Extension Host smoke against the controlled fixture workspace.",
    riskLevel: "medium",
  }),
  Object.freeze({
    category: "futurePccxLabDiagnostics",
    label: "Future pccx-lab diagnostics validation",
    command: null,
    placeholder: true,
    reason: "Reserved for a later allowlisted pccx-lab command palette integration.",
    riskLevel: "medium",
  }),
  Object.freeze({
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
    category: proposal.category,
    label: proposal.label,
    command: cloneCommand(proposal.command),
    placeholder: proposal.placeholder === true,
    reason: proposal.reason,
    riskLevel: proposal.riskLevel,
    requiresUserApproval: true,
    executes: false,
  };
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
    proposals: PROPOSALS.map(cloneProposal),
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

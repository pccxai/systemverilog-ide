import { normalizeConfig } from "./config.mjs";
import {
  buildContextBundle,
  summarizeContextBundle,
} from "./context-bundle.mjs";

export const AI_ASSISTANT_BOUNDARY_VERSION = "pccx.aiAssistantBoundary.v0";

export const AI_ASSISTANT_STATUSES = Object.freeze({
  DISABLED: "disabled",
  NOT_CONFIGURED: "notConfigured",
  PROPOSAL_BOUNDARY: "proposalBoundary",
});

export const AI_PROPOSAL_KINDS = Object.freeze([
  "explainDiagnostics",
  "proposePatch",
  "proposeValidationCommand",
  "summarizeXsimLogOutput",
  "askForMoreContext",
  "openRelatedSymbol",
  "callPccxLabTool",
]);

export const DISALLOWED_AI_ACTIONS = Object.freeze([
  "directFileWrite",
  "directGitCommit",
  "directGitPush",
  "directReleaseOrTag",
  "directRulesetSettingsOrSecretsChange",
  "stagingOrPrivateRepoAccess",
  "arbitraryShellCommand",
]);

function proposalAction(kind) {
  return {
    kind,
    execution: "proposalOnly",
  };
}

export function createAssistantBoundaryStatus(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  if (!config.aiAssistant.enabled) {
    return {
      version: AI_ASSISTANT_BOUNDARY_VERSION,
      status: AI_ASSISTANT_STATUSES.DISABLED,
      backend: config.aiAssistant.backend,
      providerCalls: false,
      runtimeCalls: false,
    };
  }
  if (config.aiAssistant.backend === "none") {
    return {
      version: AI_ASSISTANT_BOUNDARY_VERSION,
      status: AI_ASSISTANT_STATUSES.NOT_CONFIGURED,
      backend: config.aiAssistant.backend,
      providerCalls: false,
      runtimeCalls: false,
    };
  }
  return {
    version: AI_ASSISTANT_BOUNDARY_VERSION,
    status: AI_ASSISTANT_STATUSES.PROPOSAL_BOUNDARY,
    backend: config.aiAssistant.backend,
    providerCalls: false,
    runtimeCalls: false,
  };
}

export function createAssistantRequest(rawConfig = {}, contextInput = {}, options = {}) {
  const status = createAssistantBoundaryStatus(rawConfig);
  const contextBundle = buildContextBundle(contextInput, options);

  return {
    ...status,
    contextBundle,
    contextSummary: summarizeContextBundle(contextBundle),
    allowedActions: AI_PROPOSAL_KINDS.map(proposalAction),
    disallowedActions: [...DISALLOWED_AI_ACTIONS],
  };
}

export function createCommandProposal(kind, payload = {}) {
  if (!AI_PROPOSAL_KINDS.includes(kind)) {
    throw new Error(`unsupported AI assistant proposal kind: ${kind}`);
  }
  return {
    kind,
    execution: "proposalOnly",
    payload: { ...payload },
  };
}

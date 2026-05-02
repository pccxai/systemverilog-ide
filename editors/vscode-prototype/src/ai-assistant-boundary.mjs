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
  "summarizeLog",
  "askForMoreContext",
  "openRelatedSymbol",
]);

export const DISALLOWED_AI_ACTIONS = Object.freeze([
  "writeFile",
  "commit",
  "push",
  "merge",
  "release",
  "tag",
  "changeRuleset",
  "accessSecrets",
  "accessStaging",
]);

function proposalAction(kind) {
  return {
    kind,
    execution: "proposalOnly",
  };
}

export function createAssistantBoundaryStatus(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  const baseStatus = {
    version: AI_ASSISTANT_BOUNDARY_VERSION,
    backend: config.aiAssistant.backend,
    providerCalls: false,
    runtimeCalls: false,
    providerCallsImplemented: false,
    runtimeCallsImplemented: false,
    mcpServerImplemented: false,
    directExecution: false,
    proposalOnly: true,
    allowedActions: AI_PROPOSAL_KINDS.map(proposalAction),
    disallowedActions: [...DISALLOWED_AI_ACTIONS],
  };

  if (!config.aiAssistant.enabled) {
    return {
      ...baseStatus,
      status: AI_ASSISTANT_STATUSES.DISABLED,
    };
  }
  if (config.aiAssistant.backend === "none") {
    return {
      ...baseStatus,
      status: AI_ASSISTANT_STATUSES.NOT_CONFIGURED,
    };
  }
  return {
    ...baseStatus,
    status: AI_ASSISTANT_STATUSES.PROPOSAL_BOUNDARY,
  };
}

export function createAssistantRequest(rawConfig = {}, contextInput = {}, options = {}) {
  const status = createAssistantBoundaryStatus(rawConfig);
  const contextBundle = buildContextBundle(contextInput, options);

  return {
    ...status,
    kind: "ai-context-bundle",
    contextBundle,
    contextSummary: summarizeContextBundle(contextBundle),
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

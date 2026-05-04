// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

import { normalizeConfig } from "./config.mjs";
import {
  buildContextBundle,
  summarizeContextBundle,
} from "./context-bundle.mjs";

export const WORKFLOW_BOUNDARY_VERSION = "pccx.workflowBoundary.v0";

export const WORKFLOW_BOUNDARY_STATUSES = Object.freeze({
  DISABLED: "disabled",
  NOT_CONFIGURED: "notConfigured",
  PROPOSAL_BOUNDARY: "proposalBoundary",
});

export const WORKFLOW_PROPOSAL_KINDS = Object.freeze([
  "explainDiagnostics",
  "proposePatch",
  "proposeValidationCommand",
  "summarizeLog",
  "askForMoreContext",
  "openRelatedSymbol",
]);

export const DISALLOWED_WORKFLOW_ACTIONS = Object.freeze([
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

export function createWorkflowBoundaryStatus(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  const baseStatus = {
    version: WORKFLOW_BOUNDARY_VERSION,
    backend: config.workflowBoundary.backend,
    providerCalls: false,
    runtimeCalls: false,
    providerCallsImplemented: false,
    runtimeCallsImplemented: false,
    mcpServerImplemented: false,
    directExecution: false,
    proposalOnly: true,
    allowedActions: WORKFLOW_PROPOSAL_KINDS.map(proposalAction),
    disallowedActions: [...DISALLOWED_WORKFLOW_ACTIONS],
  };

  if (!config.workflowBoundary.enabled) {
    return {
      ...baseStatus,
      status: WORKFLOW_BOUNDARY_STATUSES.DISABLED,
    };
  }
  if (config.workflowBoundary.backend === "none") {
    return {
      ...baseStatus,
      status: WORKFLOW_BOUNDARY_STATUSES.NOT_CONFIGURED,
    };
  }
  return {
    ...baseStatus,
    status: WORKFLOW_BOUNDARY_STATUSES.PROPOSAL_BOUNDARY,
  };
}

export function createWorkflowContextRequest(rawConfig = {}, contextInput = {}, options = {}) {
  const status = createWorkflowBoundaryStatus(rawConfig);
  const contextBundle = buildContextBundle(contextInput, options);

  return {
    ...status,
    kind: "workflow-context-bundle",
    contextBundle,
    contextSummary: summarizeContextBundle(contextBundle),
  };
}

export function createCommandProposal(kind, payload = {}) {
  if (!WORKFLOW_PROPOSAL_KINDS.includes(kind)) {
    throw new Error(`unsupported workflow boundary proposal kind: ${kind}`);
  }
  return {
    kind,
    execution: "proposalOnly",
    payload: { ...payload },
  };
}

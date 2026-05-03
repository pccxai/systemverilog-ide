import {
  createLauncherStatusContractStatus,
} from "./launcher-status-contract.mjs";
import {
  createPccxLabCommandDescriptorStatus,
} from "./pccx-lab-command-descriptor.mjs";
import {
  createDiagnosticsHandoffConsumerBoundaryStatus,
} from "./diagnostics-handoff-consumer.mjs";

export const LOCAL_WORKFLOW_STATUS_VERSION = "pccx.localWorkflowStatus.v0";

function validationStatusFromCache(cache) {
  if (!cache || typeof cache.status !== "function") {
    return {
      count: 0,
      maxSize: 0,
      latestStatus: "none",
      latestProposalId: "",
      redactionApplied: false,
      truncated: false,
    };
  }
  const status = cache.status();
  return {
    count: status.count,
    maxSize: status.maxSize,
    latestStatus: status.latest?.status ?? "none",
    latestProposalId: status.latest?.proposalId ?? "",
    redactionApplied: status.redactionApplied === true,
    truncated: status.truncated === true,
  };
}

function contextBundleEstimate(input = {}) {
  const contextSummary = input.contextSummary ?? null;
  return {
    itemCount: [
      contextSummary?.diagnosticCount ?? input.diagnosticCount ?? 0,
      contextSummary?.snippetCount ?? input.snippetCount ?? 0,
      contextSummary?.declarationCount ?? input.declarationCount ?? 0,
      contextSummary?.pccxLabOutputCount ?? input.pccxLabOutputCount ?? 0,
      input.validationHistoryCount ?? 0,
      input.launcherStatusCount ?? 0,
      input.labStatusCount ?? 0,
    ].reduce((sum, value) => sum + Math.max(0, Number.isInteger(value) ? value : 0), 0),
    diagnosticCount: contextSummary?.diagnosticCount ?? input.diagnosticCount ?? 0,
    snippetCount: contextSummary?.snippetCount ?? input.snippetCount ?? 0,
    declarationCount: contextSummary?.declarationCount ?? input.declarationCount ?? 0,
    validationHistoryCount: input.validationHistoryCount ?? 0,
  };
}

export function createLocalWorkflowStatus(config = {}, input = {}) {
  const pccxLabBoundary = createPccxLabCommandDescriptorStatus();
  const launcherBoundary = createLauncherStatusContractStatus();
  const diagnosticsHandoffBoundary = createDiagnosticsHandoffConsumerBoundaryStatus();
  const validationCache = validationStatusFromCache(input.validationResultCache);
  const extensionMode = typeof config.mode === "string" ? config.mode : "checkedExample";
  const validationRunner = config.validationRunner ?? {};

  return {
    version: LOCAL_WORKFLOW_STATUS_VERSION,
    kind: "local-workflow-status",
    extensionMode,
    liveWorkspace: {
      enabled: config.liveWorkspace?.enabled === true,
    },
    validationRunner: {
      enabled: validationRunner.enabled === true,
      mode: typeof validationRunner.mode === "string" ? validationRunner.mode : "disabled",
    },
    recentValidation: validationCache,
    pccxLabBoundary: {
      state: pccxLabBoundary.descriptors[0]?.executionState ?? "future",
      descriptorOnly: pccxLabBoundary.descriptorOnly === true,
      executes: pccxLabBoundary.executes === true,
      descriptorCount: pccxLabBoundary.descriptors.length,
    },
    launcherBoundary: {
      state: launcherBoundary.status.launcherStatus,
      fixtureOnly: launcherBoundary.fixtureOnly === true,
      runtimeCalls: launcherBoundary.runtimeCalls === true,
      launcherCalls: launcherBoundary.launcherCalls === true,
    },
    diagnosticsHandoffBoundary: {
      supportedSchemaVersion: diagnosticsHandoffBoundary.supportedSchemaVersion,
      fixtureConsumer: diagnosticsHandoffBoundary.fixtureConsumer === true,
      readOnly: diagnosticsHandoffBoundary.readOnly === true,
      invokesLauncher: diagnosticsHandoffBoundary.invokesLauncher === true,
      invokesPccxLab: diagnosticsHandoffBoundary.invokesPccxLab === true,
      lspImplemented: diagnosticsHandoffBoundary.lspImplemented === true,
    },
    contextBundle: contextBundleEstimate(input),
    safety: {
      providerCalls: false,
      launcherCalls: false,
      pccxLabExecution: false,
      mcpCalls: false,
      lspImplemented: false,
      marketplaceFlow: false,
    },
  };
}

export function formatLocalWorkflowStatus(status) {
  return [
    "Local Workflow Status",
    `extensionMode: ${status.extensionMode}`,
    `liveWorkspaceEnabled: ${status.liveWorkspace.enabled ? "yes" : "no"}`,
    `validationRunner: ${status.validationRunner.enabled ? "enabled" : "disabled"} (${status.validationRunner.mode})`,
    `recentValidation: ${status.recentValidation.count}/${status.recentValidation.maxSize} latest=${status.recentValidation.latestStatus}`,
    `pccxLabBoundary: ${status.pccxLabBoundary.state} descriptorOnly=${status.pccxLabBoundary.descriptorOnly ? "yes" : "no"}`,
    `launcherBoundary: ${status.launcherBoundary.state} fixtureOnly=${status.launcherBoundary.fixtureOnly ? "yes" : "no"}`,
    `diagnosticsHandoffBoundary: ${status.diagnosticsHandoffBoundary.supportedSchemaVersion} readOnly=${status.diagnosticsHandoffBoundary.readOnly ? "yes" : "no"}`,
    `contextBundleItems: ${status.contextBundle.itemCount}`,
    "safety: no provider calls, no launcher calls, no pccx-lab execution",
  ].join("\n");
}

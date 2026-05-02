import {
  COMMAND_IDS,
  buildFacadeArgsForCommand,
  isLiveFacadeArgs,
  normalizeConfig,
} from "./config.mjs";

export { COMMAND_IDS };

function countSummary(count, label) {
  return `${count} ${label}(s)`;
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${label} must be an argument array`);
  }
}

export function createCommandExecutionPlan(commandId, rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  const facadeArgs = buildFacadeArgsForCommand(commandId, config);
  assertStringArray(facadeArgs, "facade args");

  const plan = {
    commandId,
    config,
    facadeArgs,
    env: {},
  };

  if (isLiveFacadeArgs(facadeArgs)) {
    plan.env.PCCX_IDE_PYTHON = config.pythonPath;
  }

  return plan;
}

export function toDiagnosticsUiAction(facadePayload) {
  if (facadePayload?.kind !== "vscode-diagnostics") {
    throw new Error("expected vscode-diagnostics facade payload");
  }

  const diagnostics = Array.isArray(facadePayload.diagnostics)
    ? facadePayload.diagnostics
    : [];
  return {
    kind: "diagnostics",
    diagnostics,
    summary: countSummary(diagnostics.length, "diagnostic"),
  };
}

export function toNavigationUiAction(facadePayload) {
  if (facadePayload?.kind !== "vscode-navigation") {
    throw new Error("expected vscode-navigation facade payload");
  }

  const items = Array.isArray(facadePayload.items) ? facadePayload.items : [];
  return {
    kind: "navigation",
    items,
    summary: countSummary(items.length, "navigation item"),
  };
}

function payloadFromFacadeResult(result) {
  if (!result?.ok) {
    throw new Error(result?.error || result?.stderr || "facade command failed");
  }

  if (result.json) {
    return result.json;
  }
  if (result.kind) {
    return result;
  }

  throw new Error("facade command did not return JSON payload");
}

function toUiAction(facadePayload) {
  if (facadePayload?.kind === "vscode-diagnostics") {
    return toDiagnosticsUiAction(facadePayload);
  }
  if (facadePayload?.kind === "vscode-navigation") {
    return toNavigationUiAction(facadePayload);
  }
  throw new Error(`unsupported facade payload kind: ${facadePayload?.kind ?? "missing"}`);
}

async function applyUiAction(action, deps) {
  if (action.kind === "diagnostics") {
    await deps.updateDiagnostics?.(action.diagnostics, action);
  } else if (action.kind === "navigation") {
    await deps.showNavigationItems?.(action.items, action);
  }

  if (action.kind === "diagnostics" && action.diagnostics.length > 0) {
    await deps.showWarningMessage?.(action.summary, action);
  } else {
    await deps.showInformationMessage?.(action.summary, action);
  }
}

export async function runPrototypeCommand(commandId, rawConfig = {}, deps = {}) {
  let plan;
  try {
    plan = createCommandExecutionPlan(commandId, rawConfig);
    if (typeof deps.runFacade !== "function") {
      throw new Error("runFacade dependency is required");
    }

    const facadeResult = await deps.runFacade(plan.facadeArgs, plan.env, plan);
    const facadePayload = payloadFromFacadeResult(facadeResult);
    const action = toUiAction(facadePayload);
    await applyUiAction(action, deps);

    return {
      ok: true,
      commandId,
      plan,
      action,
    };
  } catch (error) {
    const result = {
      ok: false,
      commandId,
      error: error.message,
    };
    if (plan) {
      result.plan = plan;
    }
    await deps.showWarningMessage?.(result.error, result);
    return result;
  }
}

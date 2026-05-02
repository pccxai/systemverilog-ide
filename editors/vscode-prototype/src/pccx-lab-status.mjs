import { normalizeConfig } from "./config.mjs";

export const PCCX_LAB_BACKEND_STATUS_VERSION = "pccx.pccxLabBackendStatus.v0";

export const FUTURE_PCCX_LAB_OPERATIONS = Object.freeze([
  "diagnostics",
  "index",
  "locate",
  "declarations",
  "xsim-log analysis",
  "validation summary",
]);

export function createPccxLabBackendStatus(rawConfig = {}) {
  const config = normalizeConfig(rawConfig);
  return {
    version: PCCX_LAB_BACKEND_STATUS_VERSION,
    kind: "pccx-lab-backend-status",
    configuredCommand: config.pccxLab.command,
    status: "placeholder",
    configured: Boolean(config.pccxLab.command),
    execution: "statusOnly",
    executes: false,
    providerCalls: false,
    runtimeCalls: false,
    backendCommandExecuted: false,
    integration: "commandPalettePreparation",
    futureControlledOperations: [...FUTURE_PCCX_LAB_OPERATIONS],
    note: "pccx-lab remains the CLI-first backend; this status command does not execute it.",
  };
}

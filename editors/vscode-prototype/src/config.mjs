export const CONFIG_SECTION = "pccxSystemVerilog";

export const CONFIG_KEYS = Object.freeze([
  "mode",
  "liveWorkspace.enabled",
  "pccxLab.command",
  "aiAssistant.enabled",
  "aiAssistant.backend",
  "pythonPath",
  "defaultSource",
  "defaultLog",
  "defaultNavigationRoot",
  "defaultModule",
  "defaultDeclarationKind",
]);

export const FACADE_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.publishCheckedExampleDiagnostics",
  "pccxSystemVerilog.showCheckedExampleNavigation",
  "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
  "pccxSystemVerilog.showLiveWorkspaceNavigation",
  "pccxSystemVerilog.showDiagnosticsExample",
  "pccxSystemVerilog.showNavigationExample",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
]);

export const AI_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showAIAssistantStatus",
  "pccxSystemVerilog.buildAIContextBundle",
  "pccxSystemVerilog.proposeValidationCommand",
]);

export const PCCX_LAB_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.showPccxLabBackendStatus",
]);

export const COMMAND_IDS = Object.freeze([
  ...FACADE_COMMAND_IDS,
  ...AI_COMMAND_IDS,
  ...PCCX_LAB_COMMAND_IDS,
]);

export const MODES = Object.freeze(["checkedExample", "liveWorkspace"]);
export const AI_ASSISTANT_BACKENDS = Object.freeze(["none", "pccx-llm-launcher", "mcp"]);
export const DECLARATION_KINDS = Object.freeze(["module", "package", "interface", "any"]);
export const LIVE_WORKSPACE_COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.publishLiveWorkspaceDiagnostics",
  "pccxSystemVerilog.showLiveWorkspaceNavigation",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
]);

const DEFAULT_CONFIG = Object.freeze({
  mode: "checkedExample",
  liveWorkspace: Object.freeze({
    enabled: false,
  }),
  pccxLab: Object.freeze({
    command: "pccx_ide_cli",
  }),
  aiAssistant: Object.freeze({
    enabled: false,
    backend: "none",
  }),
  pythonPath: "python3",
  defaultSource: "fixtures/missing_endmodule.sv",
  defaultLog: "fixtures/xsim/mixed.log",
  defaultNavigationRoot: "fixtures/modules",
  defaultModule: "simple_mod",
  defaultDeclarationKind: "module",
});

const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\()/;

function rawConfigValue(rawConfig, key) {
  if (rawConfig && typeof rawConfig.get === "function") {
    return rawConfig.get(key);
  }
  if (rawConfig && Object.hasOwn(rawConfig, key)) {
    return rawConfig[key];
  }

  const parts = key.split(".");
  let value = rawConfig;
  for (const part of parts) {
    if (value == null || typeof value !== "object" || !Object.hasOwn(value, part)) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

function stringSetting(rawConfig, key, fallback) {
  const value = rawConfigValue(rawConfig, key);
  if (value == null) {
    return fallback;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${CONFIG_SECTION}.${key} must be a non-empty string`);
  }
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new Error(`${CONFIG_SECTION}.${key} must be a single-line string`);
  }
  if (SHELL_CONTROL_PATTERN.test(value)) {
    throw new Error(`${CONFIG_SECTION}.${key} must not contain shell control syntax`);
  }
  return value;
}

function commandSetting(rawConfig, key, fallback) {
  const value = stringSetting(rawConfig, key, fallback);
  if (/\s/.test(value)) {
    throw new Error(`${CONFIG_SECTION}.${key} must be a command name or path without arguments`);
  }
  return value;
}

function booleanSetting(rawConfig, key, fallback) {
  const value = rawConfigValue(rawConfig, key);
  if (value == null) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${CONFIG_SECTION}.${key} must be a boolean`);
  }
  return value;
}

function enumSetting(rawConfig, key, fallback, allowedValues) {
  const value = stringSetting(rawConfig, key, fallback);
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${CONFIG_SECTION}.${key} must be one of: ${allowedValues.join(", ")}`,
    );
  }
  return value;
}

export function defaultConfig() {
  return {
    ...DEFAULT_CONFIG,
    liveWorkspace: { ...DEFAULT_CONFIG.liveWorkspace },
    pccxLab: { ...DEFAULT_CONFIG.pccxLab },
    aiAssistant: { ...DEFAULT_CONFIG.aiAssistant },
  };
}

export function normalizeConfig(rawConfig = {}) {
  return {
    mode: enumSetting(rawConfig, "mode", DEFAULT_CONFIG.mode, MODES),
    liveWorkspace: {
      enabled: booleanSetting(
        rawConfig,
        "liveWorkspace.enabled",
        DEFAULT_CONFIG.liveWorkspace.enabled,
      ),
    },
    pccxLab: {
      command: commandSetting(rawConfig, "pccxLab.command", DEFAULT_CONFIG.pccxLab.command),
    },
    aiAssistant: {
      enabled: booleanSetting(
        rawConfig,
        "aiAssistant.enabled",
        DEFAULT_CONFIG.aiAssistant.enabled,
      ),
      backend: enumSetting(
        rawConfig,
        "aiAssistant.backend",
        DEFAULT_CONFIG.aiAssistant.backend,
        AI_ASSISTANT_BACKENDS,
      ),
    },
    pythonPath: stringSetting(rawConfig, "pythonPath", DEFAULT_CONFIG.pythonPath),
    defaultSource: stringSetting(rawConfig, "defaultSource", DEFAULT_CONFIG.defaultSource),
    defaultLog: stringSetting(rawConfig, "defaultLog", DEFAULT_CONFIG.defaultLog),
    defaultNavigationRoot: stringSetting(
      rawConfig,
      "defaultNavigationRoot",
      DEFAULT_CONFIG.defaultNavigationRoot,
    ),
    defaultModule: stringSetting(rawConfig, "defaultModule", DEFAULT_CONFIG.defaultModule),
    defaultDeclarationKind: enumSetting(
      rawConfig,
      "defaultDeclarationKind",
      DEFAULT_CONFIG.defaultDeclarationKind,
      DECLARATION_KINDS,
    ),
  };
}

export function isKnownCommandId(commandId) {
  return COMMAND_IDS.includes(commandId);
}

export function isFacadeCommandId(commandId) {
  return FACADE_COMMAND_IDS.includes(commandId);
}

export function assertKnownCommandId(commandId) {
  if (!isKnownCommandId(commandId)) {
    throw new Error(`unknown PCCX SystemVerilog command: ${commandId}`);
  }
}

export function assertFacadeCommandId(commandId) {
  if (!isFacadeCommandId(commandId)) {
    assertKnownCommandId(commandId);
    throw new Error(`PCCX SystemVerilog command does not use the facade: ${commandId}`);
  }
}

export function isLiveWorkspaceCommand(commandId) {
  return LIVE_WORKSPACE_COMMAND_IDS.includes(commandId);
}

export function isLiveWorkspaceEnabled(config) {
  return config?.mode === "liveWorkspace" && config?.liveWorkspace?.enabled === true;
}

export function assertLiveWorkspaceEnabled(config) {
  if (!isLiveWorkspaceEnabled(config)) {
    throw new Error(
      "live workspace commands require pccxSystemVerilog.mode=liveWorkspace " +
        "and pccxSystemVerilog.liveWorkspace.enabled=true",
    );
  }
}

export function buildFacadeArgsForCommand(commandId, rawConfig = {}) {
  assertFacadeCommandId(commandId);
  const config = normalizeConfig(rawConfig);

  if (
    commandId === "pccxSystemVerilog.publishCheckedExampleDiagnostics" ||
    commandId === "pccxSystemVerilog.showDiagnosticsExample"
  ) {
    return ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"];
  }

  if (
    commandId === "pccxSystemVerilog.showCheckedExampleNavigation" ||
    commandId === "pccxSystemVerilog.showNavigationExample"
  ) {
    return ["navigation", "--mode", "example", "--source", "declarations"];
  }

  if (
    commandId === "pccxSystemVerilog.publishLiveWorkspaceDiagnostics" ||
    commandId === "pccxSystemVerilog.runDiagnosticsLive"
  ) {
    assertLiveWorkspaceEnabled(config);
    return ["diagnostics", "--mode", "live", "--from-check", config.defaultSource];
  }

  if (
    commandId === "pccxSystemVerilog.showLiveWorkspaceNavigation" ||
    commandId === "pccxSystemVerilog.runNavigationLive"
  ) {
    assertLiveWorkspaceEnabled(config);
    return [
      "navigation",
      "--mode",
      "live",
      "--locate",
      config.defaultNavigationRoot,
      config.defaultModule,
      "--kind",
      config.defaultDeclarationKind,
    ];
  }

  throw new Error(`unhandled PCCX SystemVerilog command: ${commandId}`);
}

export function isLiveFacadeArgs(args) {
  return Array.isArray(args) && args[1] === "--mode" && args[2] === "live";
}

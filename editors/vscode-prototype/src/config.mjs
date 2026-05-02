export const CONFIG_SECTION = "pccxSystemVerilog";

export const CONFIG_KEYS = Object.freeze([
  "mode",
  "pythonPath",
  "defaultSource",
  "defaultLog",
  "defaultModule",
  "defaultDeclarationKind",
]);

export const COMMAND_IDS = Object.freeze([
  "pccxSystemVerilog.publishCheckedExampleDiagnostics",
  "pccxSystemVerilog.showDiagnosticsExample",
  "pccxSystemVerilog.showNavigationExample",
  "pccxSystemVerilog.runDiagnosticsLive",
  "pccxSystemVerilog.runNavigationLive",
]);

export const MODES = Object.freeze(["example", "live"]);
export const DECLARATION_KINDS = Object.freeze(["module", "package", "interface", "any"]);

const DEFAULT_CONFIG = Object.freeze({
  mode: "example",
  pythonPath: "python3",
  defaultSource: "fixtures/missing_endmodule.sv",
  defaultLog: "fixtures/xsim/mixed.log",
  defaultModule: "simple_mod",
  defaultDeclarationKind: "module",
});

const NAVIGATION_ROOT = "fixtures/modules";
const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\()/;

function rawConfigValue(rawConfig, key) {
  if (rawConfig && typeof rawConfig.get === "function") {
    return rawConfig.get(key);
  }
  return rawConfig?.[key];
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
  return { ...DEFAULT_CONFIG };
}

export function normalizeConfig(rawConfig = {}) {
  return {
    mode: enumSetting(rawConfig, "mode", DEFAULT_CONFIG.mode, MODES),
    pythonPath: stringSetting(rawConfig, "pythonPath", DEFAULT_CONFIG.pythonPath),
    defaultSource: stringSetting(rawConfig, "defaultSource", DEFAULT_CONFIG.defaultSource),
    defaultLog: stringSetting(rawConfig, "defaultLog", DEFAULT_CONFIG.defaultLog),
    defaultModule: stringSetting(rawConfig, "defaultModule", DEFAULT_CONFIG.defaultModule),
    defaultDeclarationKind: enumSetting(
      rawConfig,
      "defaultDeclarationKind",
      DEFAULT_CONFIG.defaultDeclarationKind,
      DECLARATION_KINDS,
    ),
  };
}

export function buildFacadeArgsForCommand(commandId, rawConfig = {}) {
  const config = normalizeConfig(rawConfig);

  if (
    commandId === "pccxSystemVerilog.publishCheckedExampleDiagnostics" ||
    commandId === "pccxSystemVerilog.showDiagnosticsExample"
  ) {
    return ["diagnostics", "--mode", "example", "--source", "check-missing-endmodule"];
  }

  if (commandId === "pccxSystemVerilog.showNavigationExample") {
    return ["navigation", "--mode", "example", "--source", "declarations"];
  }

  if (commandId === "pccxSystemVerilog.runDiagnosticsLive") {
    return ["diagnostics", "--mode", "live", "--from-check", config.defaultSource];
  }

  if (commandId === "pccxSystemVerilog.runNavigationLive") {
    return [
      "navigation",
      "--mode",
      "live",
      "--locate",
      NAVIGATION_ROOT,
      config.defaultModule,
      "--kind",
      config.defaultDeclarationKind,
    ];
  }

  throw new Error(`unknown PCCX SystemVerilog command: ${commandId}`);
}

export function isLiveFacadeArgs(args) {
  return Array.isArray(args) && args[1] === "--mode" && args[2] === "live";
}

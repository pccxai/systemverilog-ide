export const LAUNCHER_STATUS_CONTRACT_VERSION = "pccx.launcherStatusContract.v0";
export const LAUNCHER_STATUS_SCHEMA_VERSION = 1;
export const DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export const LAUNCHER_STATUSES = Object.freeze(["unavailable", "available", "future", "disabled"]);
export const LAUNCHER_DEVICE_STATUSES = Object.freeze(["unknown", "not-connected", "connected", "future"]);
export const LAUNCHER_SESSION_STATUSES = Object.freeze(["none", "starting", "running", "stopped", "future"]);
export const LAUNCHER_MODEL_STATUSES = Object.freeze(["unknown", "not-loaded", "loaded", "future"]);
export const LAUNCHER_BACKEND_KINDS = Object.freeze(["local", "external", "future", "unknown"]);

const STATUS_KEYS = new Set([
  "version",
  "launcherStatus",
  "deviceStatus",
  "sessionStatus",
  "modelStatus",
  "backendKind",
  "capabilities",
  "limitations",
  "lastUpdatedAt",
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/;
const MODEL_OR_WEIGHT_PATH_PATTERN =
  /\.(?:bin|gguf|onnx|pt|pth|safetensors|xclbin|bit)(?:\s|$)/i;
const BOARD_OR_PERFORMANCE_CLAIM_PATTERN =
  /(?:kv260[\s\S]{0,40}(?:inference|model|runs|working)|20\s*tok\/s|timing\s+clos(?:ed|ure))/i;

function unknownKeys(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).filter((key) => !allowedKeys.has(key));
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function enumField(value, path, allowedValues, fallback, errors) {
  if (value == null) {
    return fallback;
  }
  if (!allowedValues.includes(value)) {
    addError(errors, path, `must be one of: ${allowedValues.join(", ")}`);
    return fallback;
  }
  return value;
}

function boundedString(value, path, errors, maxCharacters = 240) {
  if (typeof value !== "string" || value.trim().length === 0) {
    addError(errors, path, "must be a non-empty string");
    return "";
  }
  if (value.length > maxCharacters || value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    addError(errors, path, `must be a single-line string up to ${maxCharacters} characters`);
  }
  if (
    SECRET_ASSIGNMENT_PATTERN.test(value) ||
    HOME_PATH_PATTERN.test(value) ||
    MODEL_OR_WEIGHT_PATH_PATTERN.test(value) ||
    BOARD_OR_PERFORMANCE_CLAIM_PATTERN.test(value)
  ) {
    addError(errors, path, "must not include secrets, private paths, model artifacts, board logs, or performance claims");
  }
  return value;
}

function boundedStringList(value, path, errors) {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    addError(errors, path, "must be an array");
    return [];
  }
  if (value.length > 12) {
    addError(errors, path, "must contain at most 12 item(s)");
  }
  return value.slice(0, 12).map((item, index) => boundedString(item, `${path}[${index}]`, errors));
}

function timestampField(value, errors) {
  const timestamp = typeof value === "string" && value
    ? value
    : DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP;
  if (Number.isNaN(Date.parse(timestamp))) {
    addError(errors, "lastUpdatedAt", "must be an ISO timestamp string");
    return DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP;
  }
  if (HOME_PATH_PATTERN.test(timestamp) || SECRET_ASSIGNMENT_PATTERN.test(timestamp)) {
    addError(errors, "lastUpdatedAt", "must not include private or secret-like text");
  }
  return timestamp;
}

export function normalizeLauncherStatusContract(status = {}) {
  const errors = [];
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    throw new Error("launcher status contract must be an object");
  }
  for (const key of unknownKeys(status, STATUS_KEYS)) {
    addError(errors, key, "is not allowed in launcher status contracts");
  }
  if (status.version != null && status.version !== LAUNCHER_STATUS_SCHEMA_VERSION) {
    addError(errors, "version", `must be ${LAUNCHER_STATUS_SCHEMA_VERSION}`);
  }

  const normalized = {
    version: LAUNCHER_STATUS_SCHEMA_VERSION,
    launcherStatus: enumField(
      status.launcherStatus,
      "launcherStatus",
      LAUNCHER_STATUSES,
      "future",
      errors,
    ),
    deviceStatus: enumField(
      status.deviceStatus,
      "deviceStatus",
      LAUNCHER_DEVICE_STATUSES,
      "unknown",
      errors,
    ),
    sessionStatus: enumField(
      status.sessionStatus,
      "sessionStatus",
      LAUNCHER_SESSION_STATUSES,
      "none",
      errors,
    ),
    modelStatus: enumField(
      status.modelStatus,
      "modelStatus",
      LAUNCHER_MODEL_STATUSES,
      "unknown",
      errors,
    ),
    backendKind: enumField(
      status.backendKind,
      "backendKind",
      LAUNCHER_BACKEND_KINDS,
      "future",
      errors,
    ),
    capabilities: boundedStringList(status.capabilities, "capabilities", errors),
    limitations: boundedStringList(status.limitations, "limitations", errors),
    lastUpdatedAt: timestampField(status.lastUpdatedAt, errors),
  };

  if (errors.length > 0) {
    throw new Error(`invalid launcher status contract: ${errors.join("; ")}`);
  }
  return normalized;
}

export function validateLauncherStatusContract(status = {}) {
  try {
    return {
      ok: true,
      status: normalizeLauncherStatusContract(status),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      errors: error.message.replace(/^invalid launcher status contract: /, "").split("; "),
    };
  }
}

export function createDefaultLauncherStatusContract(overrides = {}) {
  return normalizeLauncherStatusContract({
    version: LAUNCHER_STATUS_SCHEMA_VERSION,
    launcherStatus: "future",
    deviceStatus: "unknown",
    sessionStatus: "none",
    modelStatus: "unknown",
    backendKind: "future",
    capabilities: [
      "future bounded context consumer",
      "future local status bridge",
    ],
    limitations: [
      "no launcher runtime calls in this prototype",
      "no device communication in this prototype",
      "no model or board performance claims",
    ],
    lastUpdatedAt: DETERMINISTIC_LAUNCHER_STATUS_TIMESTAMP,
    ...overrides,
  });
}

export function createLauncherStatusContractStatus() {
  return {
    version: LAUNCHER_STATUS_CONTRACT_VERSION,
    schemaVersion: LAUNCHER_STATUS_SCHEMA_VERSION,
    statusOnly: true,
    fixtureOnly: true,
    providerCalls: false,
    runtimeCalls: false,
    launcherCalls: false,
    deviceCommunication: false,
    modelPathsIncluded: false,
    boardLogsIncluded: false,
    status: createDefaultLauncherStatusContract(),
  };
}

export const PCCX_LAB_COMMAND_DESCRIPTOR_VERSION = "pccx.pccxLabCommandDescriptor.v0";
export const PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION = 1;

export const PCCX_LAB_COMMAND_CATEGORIES = Object.freeze([
  "status",
  "diagnostics",
  "trace",
  "verification",
]);

export const PCCX_LAB_COMMAND_EXECUTION_STATES = Object.freeze([
  "future",
  "disabled",
  "allowlisted",
]);

export const PCCX_LAB_WORKING_DIRECTORY_POLICIES = Object.freeze([
  "repo-root",
  "workspace-root",
  "configured",
]);

const DESCRIPTOR_KEYS = new Set([
  "version",
  "descriptorId",
  "label",
  "category",
  "executionState",
  "args",
  "workingDirectoryPolicy",
  "outputPolicy",
  "requiresExplicitApproval",
]);

const OUTPUT_POLICY_KEYS = new Set([
  "maxLines",
  "redactSecrets",
  "dropPrivatePaths",
]);

const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api[_-]?key|authorization|bearer|client[_-]?secret|password|private[_-]?key|secret|token)\b\s*[:=]/i;
const HOME_PATH_PATTERN = /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+)/;
const SHELL_CONTROL_PATTERN = /(?:&&|\|\||;|`|\$\(|>|<)/;
const RAW_SHELL_COMMAND_PATTERN =
  /\b(?:bash|sh|zsh|fish|python|python3|node|npm|pnpm|yarn|git|gh|rm|mv|cp|curl|wget|make)\s+[^\n]+/i;

const DEFAULT_DESCRIPTORS = Object.freeze([
  Object.freeze({
    version: PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION,
    descriptorId: "labStatus",
    label: "pccx-lab backend status",
    category: "status",
    executionState: "future",
    args: Object.freeze([]),
    workingDirectoryPolicy: "repo-root",
    outputPolicy: Object.freeze({
      maxLines: 120,
      redactSecrets: true,
      dropPrivatePaths: true,
    }),
    requiresExplicitApproval: true,
  }),
]);

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function unknownKeys(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.keys(value).filter((key) => !allowedKeys.has(key));
}

function boundedString(value, path, errors, maxCharacters) {
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
    SHELL_CONTROL_PATTERN.test(value) ||
    RAW_SHELL_COMMAND_PATTERN.test(value)
  ) {
    addError(errors, path, "must not include secrets, private paths, or shell command text");
  }
  return value;
}

function boundedArgs(args, errors) {
  if (!Array.isArray(args)) {
    addError(errors, "args", "must be an array");
    return [];
  }
  if (args.length > 12) {
    addError(errors, "args", "must contain at most 12 fixed argument item(s)");
  }
  return args.slice(0, 12).map((arg, index) => (
    boundedString(arg, `args[${index}]`, errors, 160)
  ));
}

function normalizeOutputPolicy(policy, errors) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    addError(errors, "outputPolicy", "must be an object");
    return {
      maxLines: 120,
      redactSecrets: true,
      dropPrivatePaths: true,
    };
  }
  for (const key of unknownKeys(policy, OUTPUT_POLICY_KEYS)) {
    addError(errors, `outputPolicy.${key}`, "is not allowed in pccx-lab command descriptors");
  }
  const maxLines = Number.isInteger(policy.maxLines) ? policy.maxLines : 120;
  if (maxLines < 1 || maxLines > 500) {
    addError(errors, "outputPolicy.maxLines", "must be between 1 and 500");
  }
  if (policy.redactSecrets !== true) {
    addError(errors, "outputPolicy.redactSecrets", "must be true");
  }
  if (policy.dropPrivatePaths !== true) {
    addError(errors, "outputPolicy.dropPrivatePaths", "must be true");
  }
  return {
    maxLines: Math.min(500, Math.max(1, maxLines)),
    redactSecrets: true,
    dropPrivatePaths: true,
  };
}

export function normalizePccxLabCommandDescriptor(descriptor = {}) {
  const errors = [];
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error("pccx-lab command descriptor must be an object");
  }
  for (const key of unknownKeys(descriptor, DESCRIPTOR_KEYS)) {
    addError(errors, key, "is not allowed in pccx-lab command descriptors");
  }
  if (descriptor.version !== PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION) {
    addError(errors, "version", `must be ${PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION}`);
  }
  if (!PCCX_LAB_COMMAND_CATEGORIES.includes(descriptor.category)) {
    addError(errors, "category", `must be one of: ${PCCX_LAB_COMMAND_CATEGORIES.join(", ")}`);
  }
  if (!PCCX_LAB_COMMAND_EXECUTION_STATES.includes(descriptor.executionState)) {
    addError(errors, "executionState", `must be one of: ${PCCX_LAB_COMMAND_EXECUTION_STATES.join(", ")}`);
  }
  if (!PCCX_LAB_WORKING_DIRECTORY_POLICIES.includes(descriptor.workingDirectoryPolicy)) {
    addError(
      errors,
      "workingDirectoryPolicy",
      `must be one of: ${PCCX_LAB_WORKING_DIRECTORY_POLICIES.join(", ")}`,
    );
  }
  if (descriptor.requiresExplicitApproval !== true) {
    addError(errors, "requiresExplicitApproval", "must be true");
  }

  const normalized = {
    version: PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION,
    descriptorId: boundedString(descriptor.descriptorId ?? "", "descriptorId", errors, 120),
    label: boundedString(descriptor.label ?? "", "label", errors, 160),
    category: PCCX_LAB_COMMAND_CATEGORIES.includes(descriptor.category)
      ? descriptor.category
      : "status",
    executionState: PCCX_LAB_COMMAND_EXECUTION_STATES.includes(descriptor.executionState)
      ? descriptor.executionState
      : "future",
    args: boundedArgs(descriptor.args, errors),
    workingDirectoryPolicy: PCCX_LAB_WORKING_DIRECTORY_POLICIES.includes(descriptor.workingDirectoryPolicy)
      ? descriptor.workingDirectoryPolicy
      : "repo-root",
    outputPolicy: normalizeOutputPolicy(descriptor.outputPolicy, errors),
    requiresExplicitApproval: true,
  };

  if (errors.length > 0) {
    throw new Error(`invalid pccx-lab command descriptor: ${errors.join("; ")}`);
  }
  return normalized;
}

export function validatePccxLabCommandDescriptor(descriptor = {}) {
  try {
    return {
      ok: true,
      descriptor: normalizePccxLabCommandDescriptor(descriptor),
      errors: [],
    };
  } catch (error) {
    return {
      ok: false,
      descriptor: null,
      errors: error.message.replace(/^invalid pccx-lab command descriptor: /, "").split("; "),
    };
  }
}

export function listPccxLabCommandDescriptors() {
  return DEFAULT_DESCRIPTORS.map((descriptor) => normalizePccxLabCommandDescriptor(descriptor));
}

export function createPccxLabCommandDescriptorStatus() {
  return {
    version: PCCX_LAB_COMMAND_DESCRIPTOR_VERSION,
    schemaVersion: PCCX_LAB_COMMAND_DESCRIPTOR_SCHEMA_VERSION,
    descriptorOnly: true,
    executes: false,
    backendCommandExecuted: false,
    providerCalls: false,
    runtimeCalls: false,
    launcherCalls: false,
    mcpCalls: false,
    descriptors: listPccxLabCommandDescriptors(),
  };
}

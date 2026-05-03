export const CONTEXT_BUNDLE_AUDIT_VERSION = "pccx.contextBundleAudit.v0";

function serializedLength(value) {
  try {
    return JSON.stringify(value ?? {}).length;
  } catch {
    return 0;
  }
}

function countTruncatedItems(value) {
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countTruncatedItems(item), 0);
  }
  if (!value || typeof value !== "object") {
    return 0;
  }
  return (value.truncated === true ? 1 : 0) +
    Object.values(value).reduce((count, item) => count + countTruncatedItems(item), 0);
}

function textContainsRedaction(value) {
  if (typeof value === "string") {
    return value.includes("[redacted]") || value.includes("[home]");
  }
  if (Array.isArray(value)) {
    return value.some(textContainsRedaction);
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return value.redactionApplied === true || Object.values(value).some(textContainsRedaction);
}

function validationSummaryCount(bundle) {
  const historyCount = Array.isArray(bundle?.validation?.recentHistory)
    ? bundle.validation.recentHistory.length
    : 0;
  if (historyCount > 0) {
    return historyCount;
  }
  return bundle?.validation?.recent ? 1 : 0;
}

export function createContextBundleAudit(bundle = {}) {
  const excludedCategories = [
    ...(Array.isArray(bundle.excludedPathSegments) ? bundle.excludedPathSegments : []),
    ...(Array.isArray(bundle.excludedPathPatterns) ? bundle.excludedPathPatterns : []),
  ];
  const audit = {
    version: CONTEXT_BUNDLE_AUDIT_VERSION,
    contextBundleVersion: bundle?.version ?? "",
    approximateCharacterCount: serializedLength(bundle),
    diagnosticCount: Array.isArray(bundle?.diagnostics) ? bundle.diagnostics.length : 0,
    selectedSymbolSnippetCount: bundle?.symbols?.selectedContext ? 1 : 0,
    snippetCount: Array.isArray(bundle?.snippets) ? bundle.snippets.length : 0,
    validationSummaryCount: validationSummaryCount(bundle),
    launcherStatusEntryCount: bundle?.launcher ? 1 : 0,
    labStatusEntryCount: Array.isArray(bundle?.pccxLab?.outputs) ? bundle.pccxLab.outputs.length : 0,
    diagnosticsHandoffEntryCount: bundle?.diagnosticsHandoff?.summaryAvailable === true ? 1 : 0,
    redactionApplied: textContainsRedaction(bundle),
    truncationApplied: countTruncatedItems(bundle) > 0,
    truncatedItemCount: countTruncatedItems(bundle),
    excludedCategories,
    safety: {
      summaryOnly: true,
      fullLogsExcluded: true,
      privatePathsExcluded: true,
      providerCalls: false,
      networkCalls: false,
      mcpCalls: false,
      diagnosticsHandoffReadOnly: bundle?.diagnosticsHandoff?.safety?.readOnly === true,
    },
  };
  return audit;
}

export function formatContextBundleAudit(audit) {
  return [
    "Context Bundle Audit",
    `approximateCharacterCount: ${audit.approximateCharacterCount}`,
    `diagnostics: ${audit.diagnosticCount}`,
    `selectedSymbolSnippets: ${audit.selectedSymbolSnippetCount}`,
    `snippets: ${audit.snippetCount}`,
    `validationSummaries: ${audit.validationSummaryCount}`,
    `launcherStatusEntries: ${audit.launcherStatusEntryCount}`,
    `labStatusEntries: ${audit.labStatusEntryCount}`,
    `diagnosticsHandoffEntries: ${audit.diagnosticsHandoffEntryCount}`,
    `redactionApplied: ${audit.redactionApplied ? "yes" : "no"}`,
    `truncationApplied: ${audit.truncationApplied ? "yes" : "no"}`,
    `excludedCategories: ${audit.excludedCategories.join(", ")}`,
  ].join("\n");
}

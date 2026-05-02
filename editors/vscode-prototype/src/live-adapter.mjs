import {
  declarationsPayloadToNavigationItems,
  locatePayloadToNavigationItems,
  problemsPayloadToDiagnostics,
} from "./adapter.mjs";
import {
  runDeclarationsPayload,
  runLocateDeclarationPayload,
  runProblemsFromCheckPayload,
  runProblemsFromXsimLogPayload,
} from "./cli-runner.mjs";

function withDiagnostics(result) {
  return {
    ...result,
    diagnostics: result.json ? problemsPayloadToDiagnostics(result.json) : [],
  };
}

function withDeclarationNavigation(result) {
  return {
    ...result,
    navigationItems: result.json ? declarationsPayloadToNavigationItems(result.json) : [],
  };
}

function withLocateNavigation(result) {
  return {
    ...result,
    navigationItems: result.json ? locatePayloadToNavigationItems(result.json) : [],
  };
}

export async function getProblemsFromCheck(filePath, options = {}) {
  return withDiagnostics(await runProblemsFromCheckPayload(filePath, options));
}

export async function getProblemsFromXsimLog(logPath, options = {}) {
  return withDiagnostics(await runProblemsFromXsimLogPayload(logPath, options));
}

export async function getDeclarations(path, options = {}) {
  return withDeclarationNavigation(await runDeclarationsPayload(path, options));
}

export async function locateDeclaration(path, name, kind = "module", options = {}) {
  return withLocateNavigation(
    await runLocateDeclarationPayload(path, name, kind, options),
  );
}

export const THEME_TOKEN_CONTRACT = Object.freeze({
  kind: "theme-token-contract",
  currentPolicy: "host-theme-first",
  tokenSources: Object.freeze([
    "host-theme-token",
    "user-override-token",
  ]),
  futurePresentationPresets: Object.freeze([
    "VS Code",
    "Xcode",
    "JetBrains",
  ]),
  completedCustomThemeSystem: false,
});

const FORBIDDEN_PRESENTATION_KEYS = new Set([
  "background",
  "backgroundColor",
  "border",
  "borderColor",
  "className",
  "color",
  "css",
  "font",
  "foreground",
  "foregroundColor",
  "style",
  "styles",
  "theme",
  "themePreset",
  "themeToken",
  "themeTokens",
]);

function assertThemeNeutralRecord(value, path) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertThemeNeutralRecord(item, `${path}[${index}]`));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PRESENTATION_KEYS.has(key)) {
      throw new Error(`theme-neutral presentation record must not define ${path}.${key}`);
    }
    assertThemeNeutralRecord(child, `${path}.${key}`);
  }
}

export function assertThemeNeutralPresentation(presentation) {
  assertThemeNeutralRecord(presentation, "$");
  return presentation;
}

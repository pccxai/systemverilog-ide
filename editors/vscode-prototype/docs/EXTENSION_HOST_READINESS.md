# Extension Host Readiness

## Current Status

This is a local experimental VS Code extension scaffold.  It is not
published, not marketplace-ready, not LSP, and not a stable ABI/API.

## Tested Today

- Configuration helper defaults and validation.
- Known facade argument arrays.
- Command handlers and UI action models.
- Presenter behavior with mocked VS Code-like dependencies.
- Checked editor bridge examples.
- Live CLI runner for known local JSON flows.

## Not Tested Today

- Real VS Code Extension Host.
- Real `DiagnosticCollection`.
- Real QuickPick.
- Packaging.
- `vsce`.
- Marketplace install.

## Next Gates

1. Add a `vscode` dev dependency only if an Extension Host smoke needs it.
2. Add an isolated Extension Host smoke only if it stays cheap and local.
3. Keep the facade boundary.
4. Do not call `pccx_ide_cli` directly from activation.
5. Do not make a marketplace or stable API claim.

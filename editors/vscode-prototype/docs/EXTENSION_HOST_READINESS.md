# Extension Host Readiness

## Current Status

This is a local experimental VS Code extension scaffold.  It is not
published, not marketplace-ready, not LSP, and not a stable ABI/API.

Feasibility decision for this phase: Option B.  Real Extension Host smoke
is not enabled yet because the repository currently has no npm install
path, no lockfile, no VS Code test dependency, and CI is intentionally
limited to deterministic static/mock smoke coverage.

## Tested Today

- Configuration helper defaults and validation.
- Known facade argument arrays.
- Command handlers and UI action models.
- Presenter behavior with mocked VS Code-like dependencies.
- Checked editor bridge examples.
- Live CLI runner for known local JSON flows.
- Guard behavior for the local-only Extension Host smoke scaffold.

## Not Tested Today

- Real VS Code Extension Host.
- Real `DiagnosticCollection`.
- Real QuickPick.
- Packaging.
- `vsce`.
- Marketplace install.

No real VS Code Extension Host coverage is claimed by this scaffold.

## Guarded Local Scaffold

`scripts/vscode-extension-host-smoke.sh` is a guarded local-only scaffold.
By default it exits with a not-enabled message, prints the exact next
gate, and does not download VS Code, Electron, or npm dependencies.

`PCCX_RUN_EXTENSION_HOST_SMOKE=1` is reserved for a future isolated runner
under `editors/vscode-prototype/test/extension-host/` after a pinned
`@vscode/test-electron` dependency, lockfile impact, and CI policy are
explicitly reviewed.  The guarded script is not run by CI today.

## Next Gates

1. Add a pinned VS Code test dependency only if an Extension Host smoke is
   approved.
2. Add an isolated Extension Host runner only if it stays cheap and local.
3. Keep the facade boundary.
4. Do not call `pccx_ide_cli` directly from activation.
5. Do not add `vsce`, publisher metadata, packaging scripts, LSP, or
   marketplace flow.
6. Do not make a marketplace, published-extension, or stable API claim.

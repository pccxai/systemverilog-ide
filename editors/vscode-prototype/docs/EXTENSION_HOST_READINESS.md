# Extension Host Readiness

## Current Status

This is a local experimental VS Code extension scaffold.  It is not
published, has no marketplace packaging, is not LSP, and is not a stable ABI/API.

Feasibility decision for this phase: Option A, local-only.  A limited
Extension Host runtime smoke is enabled behind
`PCCX_RUN_EXTENSION_HOST_SMOKE=1` after adding the exact dev dependency
`@vscode/test-electron@2.5.2` and the generated prototype package
lockfile.  CI remains limited to deterministic static/mock smoke coverage
because the runtime path downloads VS Code/Electron on first use and
should earn CI promotion separately.

## Tested Today

- Configuration helper defaults and validation.
- Explicit live workspace configuration guard:
  `checkedExample` remains the default, and live workspace commands
  require both `mode=liveWorkspace` and `liveWorkspace.enabled=true`.
- Known facade argument arrays.
- Command handlers and UI action models.
- AI assistant status/context commands and token-saving context bundle
  unit tests.  The current AI assistant work is boundary-only.
- Presenter behavior with mocked VS Code-like dependencies.
- Real VS Code `DiagnosticCollection` population for the checked-example
  diagnostics command when the local runtime smoke is explicitly enabled.
- Command-first navigation for
  `pccxSystemVerilog.showCheckedExampleNavigation`, returning checked
  example declaration records as VS Code `Uri`/`Range`/`Location`-style
  data when the local runtime smoke is explicitly enabled.
- Minimal VS Code-native `DefinitionProvider` registration for
  SystemVerilog-like file documents.  The provider uses checked-example
  navigation by default through the existing facade boundary and returns
  VS Code `Location` results in the opt-in runtime smoke.
- Checked editor bridge examples.
- Live CLI runner for known local JSON flows.
- Controlled live workspace fixture diagnostics in the opt-in Extension
  Host runtime smoke.
- AI assistant status and context bundle command smoke with provider and
  runtime calls reported as unimplemented.
- Guard behavior for the local-only Extension Host runtime smoke.
- Pinned Extension Host activation and command-registration smoke when
  explicitly enabled locally.

## Not Tested Today

- Real QuickPick.
- Complete semantic cursor/symbol resolution.
- LSP provider registration.
- Packaging.
- `vsce`.
- Marketplace install.
- Enabled live workspace scanning, watchers, check-on-save, or arbitrary
  project indexing.
- AI provider calls, pccx-llm-launcher runtime calls, chat backend
  calls, or MCP server implementation.

The runtime smoke is limited coverage for the activation, command facade,
controlled fixture, context bundle, and VS Code-native provider boundary
only.  It is not a product claim and does not imply a published extension,
marketplace packaging, LSP support, complete semantic navigation, or a
stable ABI/API.

## Guarded Local Scaffold

`scripts/vscode-extension-host-smoke.sh` is a guarded local-only runtime
smoke.  By default it exits 2 with a not-enabled message and does not
download VS Code or Electron.

To run it locally:

```bash
npm ci --prefix editors/vscode-prototype
PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts/vscode-extension-host-smoke.sh
```

The runner lives under `editors/vscode-prototype/test/extension-host/`.
It uses `@vscode/test-electron@2.5.2`, pins VS Code to `1.90.2`, opens
`test/fixtures/live-workspace`, loads the local extension package,
verifies the expected command IDs, checks that live diagnostics and
navigation fail clearly while live workspace is disabled, and executes
the checked-example diagnostics/navigation command paths.  The
diagnostics command uses checked example diagnostics by default, goes
through the facade boundary, and verifies that VS Code receives at least
one diagnostic with URI, range, severity, message, and source fields.
The navigation command uses checked example mode by default through
`navigation --mode example --source declarations`; it returns
Location-style records with URI, range, symbol, target kind, and source
fields.  The same smoke opens a fixture SystemVerilog document and
executes `vscode.executeDefinitionProvider` to verify that the
experimental VS Code-native `DefinitionProvider` returns at least one
`Location` with sane URI and range fields.  The provider currently reuses
the checked-example declaration result and does not complete semantic
cursor/symbol resolution.

The enabled live path is limited to the controlled fixture.  The smoke
explicitly sets `mode=liveWorkspace` and `liveWorkspace.enabled=true`,
runs `pccxSystemVerilog.publishLiveWorkspaceDiagnostics` against
`broken_missing_endmodule.sv`, and asserts the returned diagnostics came
from that fixture rather than checked examples.  It also executes
`pccxSystemVerilog.showAIAssistantStatus` and
`pccxSystemVerilog.buildAIContextBundle`, verifying disabled/backend
`none` status, proposal-only actions, bounded active-file context, and no
provider/runtime calls.  This is not LSP, and there is no LSP provider
yet.

## AI Assistant Boundary

The prototype has a future AI-assisted SystemVerilog development workflow
boundary, not a model integration.  pccx-llm-launcher is a future local LLM/chat backend candidate, and any later integration must use a reviewed
contract.  The current extension code makes no AI provider calls, no
pccx-llm-launcher runtime calls, and implements no MCP server.  AI
actions are modeled as proposals, including command proposal and
validation proposal shapes, rather than direct execution.  User approval
is still required before applying patches, running validation commands,
or committing changes.

The guarded script is not run by CI today.

## Theme Boundary

The current presentation boundary is intentionally small and
theme-neutral.  Diagnostic records and command output do not carry
hardcoded editor colors or styles; VS Code diagnostics use native
severity and `DiagnosticCollection` APIs.  Future UI or webview surfaces
should use host theme tokens first, with explicit user-provided theme
tokens as the customization path.

VS Code, Xcode, and JetBrains are future presentation preset families.
They are not implemented skins and do not imply a completed custom theme
system.

## Dependency and CI Policy

- The prototype package has one exact dev dependency:
  `@vscode/test-electron@2.5.2`.
- `editors/vscode-prototype/package-lock.json` is generated by npm and
  keeps the runtime smoke dependency graph reviewable.
- There is no root lockfile, publisher metadata, `vsce`, packaging
  script, marketplace flow, LSP server, or stable ABI/API claim.
- CI keeps running the static/mock VS Code adapter smoke only.
- CI promotion for the runtime smoke requires a separate stability review
  because the first enabled run downloads VS Code/Electron.
- Theme handling remains host theme first.  Future visual presets can be
  added through host theme tokens or explicit user-provided theme tokens;
  the current work is not a completed custom theme system or custom theme
  engine.

## Next Gates

1. Keep the facade boundary.
2. Do not call `pccx_ide_cli` directly from activation.
3. Keep runtime live CLI coverage limited to the controlled fixture until
   broader live workspace behavior has separate evidence.
4. Keep the VS Code-native `DefinitionProvider` separate from any LSP
   implementation.
5. Promote the runtime smoke to CI only after separate stability evidence.
6. Do not add `vsce`, publisher metadata, packaging scripts, LSP, or
   marketplace flow.
7. Do not make a marketplace, published-extension, or stable API claim.
8. Do not make live workspace mode the default.
9. Do not add AI provider calls, pccx-llm-launcher runtime calls, or MCP
   server implementation without a separate contract review.

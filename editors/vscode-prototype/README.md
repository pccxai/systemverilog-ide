# VS Code Prototype Adapter

This directory is an experimental local VS Code prototype for translating
pre-stable editor bridge JSON into VS Code-style data records and for
hosting a minimal local VS Code extension package scaffold.

The extension scaffold is not published, is not marketplace-ready, has no
LSP, and does not define a stable ABI/API.  It can consume the checked
examples under `docs/examples/editor-bridge` and can also run limited
live JSON flows from this source tree through the local command facade.
The default tests are mostly static/mock tests, not VS Code GUI
integration tests, and they run without npm install, Vivado, xsim, or
hardware.  A limited opt-in Extension Host runtime smoke exists for local
dependency-policy review; it is not a product claim.

## Boundary Roles

`systemverilog-ide` is the editor cockpit: it owns VS Code command
registration, presentation mapping, opt-in workspace command shape, and
future context construction for editor users.  It does not become a
separate analysis backend.

`pccx-lab` is the CLI-first verification/tooling backend.  Reusable
analysis, diagnostics, declaration lookup, validation status, and log
handoff should flow through the existing facade and CLI/core boundary
rather than being duplicated inside this extension scaffold.

`pccx-llm-launcher` is a future local LLM/chat/model backend candidate.
This prototype only adds an AI assistant boundary/stub and context bundle
contract.  There are no AI provider calls, no pccx-llm-launcher runtime
calls, and no MCP server implementation in this scaffold.

## Data Mapping

Problem payloads become diagnostic-like records:

- `error` -> `Error`
- `warning` -> `Warning`
- `info` or unknown severities -> `Information`
- CLI 1-based `line` / `column` values become 0-based
  `range.start.line` / `range.start.character`
- missing locations safely fall back to line `0`, character `0`

Declaration and locate payloads become navigation items that preserve
`name`, `kind`, `file`, `line`, and `column`, with additional 0-based
position fields for editor consumers.

## Live CLI Runner

`src/cli-runner.mjs` is the only subprocess layer.  It uses Node built-ins,
honors the facade process `PCCX_IDE_PYTHON` executable when set, otherwise
prefers `python` and falls back to `python3`, sets `PYTHONPATH=src`, runs
from the repository root, and passes arguments as arrays instead of shell
strings.  It only exposes helpers for known `pccx_ide_cli` JSON flows:

- `problems from-check <file> --format json`
- `problems from-xsim-log <log> --format json`
- `declarations <path> --format json`
- `locate <path> <name> --kind <kind> --format json`

`src/live-adapter.mjs` calls those known flows and translates successful
JSON payloads through the same adapter functions used by the checked
example path.  Failures return structured `ok`, `exitCode`, `stdout`,
`stderr`, and `error` fields for callers to surface.

## Live Workspace Opt-In

Checked-example remains the default.  Live workspace behavior requires
both `pccxSystemVerilog.mode=liveWorkspace` and
`pccxSystemVerilog.liveWorkspace.enabled=true`; setting only one of those
values is not enough.  Live workspace commands do not silently fall back
to checked examples, do not start background workspace scanning, do not
add file watchers, do not check on save, and do not run arbitrary shell
commands.

The live workspace command shape is limited to known facade argument
arrays.  `pccxSystemVerilog.publishLiveWorkspaceDiagnostics` maps to the
known diagnostics facade flow for the configured default source, and
`pccxSystemVerilog.showLiveWorkspaceNavigation` maps to the known locate
flow for the configured default module/kind.  The older
`runDiagnosticsLive` and `runNavigationLive` command IDs remain
experimental opt-in aliases for now.

## Command Facade

`bin/pccx-vscode-prototype.mjs` is a local command facade for the same
prototype translation layer.  It emits JSON only and requires callers to
choose an explicit mode:

```bash
node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics \
  --mode example --source check-missing-endmodule

node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics \
  --mode live --from-check fixtures/missing_endmodule.sv

node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation \
  --mode example --source declarations

node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs navigation \
  --mode live --locate fixtures/modules pkg_defs --kind package
```

The facade supports checked-example mode and live CLI mode for known
flows only.  It does not silently fall back between modes, does not use
shell interpolation, and does not accept arbitrary command strings.

## Extension Package Scaffold

`package.json`, `src/extension.cjs`, and `src/extension.mjs` define a
minimal experimental local
VS Code extension scaffold.  The package is `private`, has version
`0.0.0`, and intentionally has no publisher, runtime dependencies,
bundler, `vsce`, or marketplace publishing script.  The only npm
dependency is the exact dev dependency `@vscode/test-electron@2.5.2` for
the guarded local Extension Host smoke.  `src/extension.cjs` is only the
VS Code manifest wrapper; the implementation stays in `src/extension.mjs`.

The contributed commands are:

- `pccxSystemVerilog.publishCheckedExampleDiagnostics`
- `pccxSystemVerilog.showCheckedExampleNavigation`
- `pccxSystemVerilog.publishLiveWorkspaceDiagnostics`
- `pccxSystemVerilog.showLiveWorkspaceNavigation`
- `pccxSystemVerilog.showDiagnosticsExample`
- `pccxSystemVerilog.showNavigationExample`
- `pccxSystemVerilog.runDiagnosticsLive`
- `pccxSystemVerilog.runNavigationLive`

The prototype-only settings are:

- `pccxSystemVerilog.mode`, default `checkedExample`
- `pccxSystemVerilog.liveWorkspace.enabled`, default `false`
- `pccxSystemVerilog.pccxLab.command`, default `pccx_ide_cli`
- `pccxSystemVerilog.aiAssistant.enabled`, default `false`
- `pccxSystemVerilog.aiAssistant.backend`, default `none`
- `pccxSystemVerilog.pythonPath`, default `python3`
- `pccxSystemVerilog.defaultSource`, default `fixtures/missing_endmodule.sv`
- `pccxSystemVerilog.defaultLog`, default `fixtures/xsim/mixed.log`
- `pccxSystemVerilog.defaultModule`, default `simple_mod`
- `pccxSystemVerilog.defaultDeclarationKind`, default `module`

The default diagnostics publishing command is
`pccxSystemVerilog.publishCheckedExampleDiagnostics`.  It is experimental
and always uses the checked `check-missing-endmodule` example through the
facade boundary.  The checked-example navigation command is
`pccxSystemVerilog.showCheckedExampleNavigation`.  It is experimental,
command-first navigation, and always uses
`navigation --mode example --source declarations` through the facade
boundary.  It maps the checked declaration records into VS Code
`Uri`/`Range`/`Location`-style records and returns them to callers; it
has no LSP provider yet.  The explicit example commands always build
checked-example facade arguments, and the explicit live commands always
build known live facade arguments.  Live diagnostics uses
`--from-check <defaultSource>`.  Live navigation uses
`--locate fixtures/modules <defaultModule> --kind <defaultDeclarationKind>`.
Live mode remains separate and explicit; the extension does not silently
fall back between live and checked-example modes.

The command handlers are thin wrappers around the local facade.  They
normalize the prototype-only settings, build known facade argument arrays,
and run `bin/pccx-vscode-prototype.mjs`; they do not call `pccx_ide_cli`
directly from the extension entry point, do not invoke raw shell command
strings, and do not accept arbitrary command execution.  Live mode calls
only known facade flows.  Live paths are still prototype-only and are
passed to known facade flows as argument-array entries.

`src/command-handlers.mjs` is the experimental local command-handler
scaffold.  It maps command ID -> normalized prototype settings -> known
facade argument array -> facade JSON result -> testable UI action model.
Diagnostics facade payloads become `{ kind: "diagnostics", diagnostics,
summary }` actions, and navigation facade payloads become
`{ kind: "navigation", items, summary }` actions.  Tests use injected and
mocked VS Code-like dependencies such as `runFacade`, `updateDiagnostics`,
and `showNavigationItems` for static coverage.

`src/definition-provider.mjs` is the first experimental VS Code-native
provider smoke.  It registers a minimal `DefinitionProvider` for
SystemVerilog-like file documents and reuses the same checked-example
navigation facade boundary used by
`pccxSystemVerilog.showCheckedExampleNavigation`.  The provider returns
VS Code `Location` results mapped from
`navigation --mode example --source declarations`; it does not implement
LSP, does not scan the live workspace by default, and does not silently
switch modes.  It also does not call AI providers, pccx-llm-launcher, or
chat services.  Semantic cursor and symbol resolution are not complete
in this phase, so the provider may ignore the cursor position and return
the checked-example declaration location.  Live navigation remains an
explicit and separate command path.

`src/presenter.mjs` is the experimental local presenter scaffold.  It
consumes command-handler UI actions and maps diagnostics/navigation
actions to mocked VS Code-like APIs.  Diagnostics presentation groups
records by file for a `DiagnosticCollection`-like dependency, and
navigation presentation creates deterministic QuickPick-like items.
The opt-in Extension Host runtime smoke additionally verifies that the
checked-example diagnostics command publishes at least one real VS Code
diagnostic with URI, range, severity, message, and source fields through
a `DiagnosticCollection`, and that the checked-example navigation
command returns at least one Location-style record with URI, range,
symbol, target kind, and source fields.  The same opt-in smoke also
opens a temporary SystemVerilog-like document and executes
`vscode.executeDefinitionProvider` to verify that the experimental
VS Code-native `DefinitionProvider` returns at least one `Location` with
sane URI and range fields.  A guarded local-only Extension Host runtime
smoke now exists at
`scripts/vscode-extension-host-smoke.sh`, but it exits 2 by default and
only runs when `PCCX_RUN_EXTENSION_HOST_SMOKE=1` is set.  The runtime
smoke loads the local extension package, verifies activation/command
registration, confirms the live workspace diagnostics command fails
clearly while disabled by default, and executes the checked-example
diagnostics publishing command plus the checked-example navigation
command and provider smoke.  It does not run an enabled live CLI path,
package the extension, add an LSP
provider, or install from the marketplace.  Extension Host gates are
tracked in
[`docs/EXTENSION_HOST_READINESS.md`](./docs/EXTENSION_HOST_READINESS.md).

## AI Assistant Boundary and Context Bundle

`src/ai-assistant-boundary.mjs` models a future local coding-assistant
mode as proposals only.  Allowed proposal kinds include explaining
diagnostics, proposing a patch, proposing a validation command,
summarizing xsim/log output, asking for more context, opening a related
symbol, and proposing a pccx-lab tool call through a controlled tool
boundary.  Direct file writes, git commits, pushes, release/tag actions,
ruleset/settings/secrets changes, staging/private repo access, and
arbitrary shell commands are disallowed by default.

`src/context-bundle.mjs` is a token-saving context bundle stub for future
AI-assisted SystemVerilog development workflow experiments.  It prefers
the current file, selected range/symbol, active diagnostics, declaration
references, recent validation summaries, pccx-lab output summaries, and
small bounded snippets.  It references files by path/range instead of
including whole workspaces, excludes `node_modules`, `.vscode-test`,
binary-like content, and private worker instruction paths, and redacts
secret-like assignments.  This is a JSON contract/stub only: no AI
provider calls, no pccx-llm-launcher runtime calls yet, no MCP server
implementation, no direct file modification, and no stable API claim.
The boundary notes are tracked in
[`docs/LIVE_WORKSPACE_AND_AI_BOUNDARY.md`](./docs/LIVE_WORKSPACE_AND_AI_BOUNDARY.md).

## Theme-Neutral Presentation Boundary

`src/presentation-boundary.mjs` defines the first theme-neutral
presentation boundary for editor-facing records.  Diagnostics and command
output carry semantic fields such as file, range, severity, message, and
source; they do not carry editor colors or style constants.  The VS Code
path uses native `DiagnosticSeverity` and `DiagnosticCollection` APIs.

The current policy is host theme first.  Future UI or webview surfaces
should use host theme tokens or explicit user-provided theme tokens.
VS Code, Xcode, and JetBrains are future presentation preset families,
not implemented skins and not completion claims.  This is not a completed
custom theme system, and the current work is not a custom theme engine.

This scaffold is not LSP, not a full IDE replacement, not a stable
ABI/API, and not a marketplace-ready or published extension.
CI does not run the real Extension Host runtime smoke yet.

## Local Smoke

```bash
node editors/vscode-prototype/test/adapter.test.mjs
node editors/vscode-prototype/test/cli-runner.test.mjs
node editors/vscode-prototype/test/facade.test.mjs
node editors/vscode-prototype/test/extension-manifest.test.mjs
node editors/vscode-prototype/test/extension-config.test.mjs
node editors/vscode-prototype/test/context-bundle.test.mjs
node editors/vscode-prototype/test/ai-assistant-boundary.test.mjs
node editors/vscode-prototype/test/static-boundary.test.mjs
node editors/vscode-prototype/test/extension-entrypoint.test.mjs
node editors/vscode-prototype/test/command-handlers.test.mjs
node editors/vscode-prototype/test/presenter.test.mjs
node editors/vscode-prototype/test/presentation-boundary.test.mjs
node editors/vscode-prototype/test/extension-host-readiness.test.mjs
bash scripts/vscode-adapter-smoke.sh
```

`scripts/vscode-extension-host-smoke.sh` is intentionally guarded.  By
default it exits with a clear not-enabled message and does not download
VS Code or Electron.  The enabled local path uses pinned
`@vscode/test-electron@2.5.2` and VS Code `1.90.2`; the first enabled run
downloads that VS Code build into `editors/vscode-prototype/.vscode-test`.

```bash
# Expected exit 2 unless the local runtime smoke is explicitly enabled.
bash scripts/vscode-extension-host-smoke.sh

# Opt-in local Extension Host runtime smoke.
npm ci --prefix editors/vscode-prototype
PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts/vscode-extension-host-smoke.sh
```

The adapter can also print translated examples:

```bash
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json

node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json
```

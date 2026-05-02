# VS Code Prototype Adapter

This directory is an experimental local VS Code prototype for translating
pre-stable editor bridge JSON into VS Code-style data records and for
hosting a minimal local VS Code extension package scaffold.

The extension scaffold is not published, is not marketplace-ready, has no
LSP, and does not define a stable ABI/API.  It can consume the checked
examples under `docs/examples/editor-bridge` and can also run limited
live JSON flows from this source tree through the local command facade.
The current tests are mostly static/mock tests, not VS Code GUI
integration tests, and they run without npm install, Vivado, xsim, or
hardware.

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

`package.json` and `src/extension.mjs` define a minimal experimental local
VS Code extension scaffold.  The package is `private`, has version
`0.0.0`, and intentionally has no publisher, npm dependencies, VS Code
test runner, bundler, `vsce`, or marketplace publishing script.

The contributed commands are:

- `pccxSystemVerilog.showDiagnosticsExample`
- `pccxSystemVerilog.showNavigationExample`
- `pccxSystemVerilog.runDiagnosticsLive`
- `pccxSystemVerilog.runNavigationLive`

The prototype-only settings are:

- `pccxSystemVerilog.mode`, default `example`
- `pccxSystemVerilog.pythonPath`, default `python3`
- `pccxSystemVerilog.defaultSource`, default `fixtures/missing_endmodule.sv`
- `pccxSystemVerilog.defaultLog`, default `fixtures/xsim/mixed.log`
- `pccxSystemVerilog.defaultModule`, default `simple_mod`
- `pccxSystemVerilog.defaultDeclarationKind`, default `module`

The default mode is checked-example mode.  The explicit example commands
always build checked-example facade arguments, and the explicit live
commands always build known live facade arguments.  Live diagnostics uses
`--from-check <defaultSource>`.  Live navigation uses
`--locate fixtures/modules <defaultModule> --kind <defaultDeclarationKind>`.

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
and `showNavigationItems`; they do not use a real `DiagnosticCollection`,
quick pick, or VS Code GUI integration test.

`src/presenter.mjs` is the experimental local presenter scaffold.  It
consumes command-handler UI actions and maps diagnostics/navigation
actions to mocked VS Code-like APIs.  Diagnostics presentation groups
records by file for a `DiagnosticCollection`-like dependency, and
navigation presentation creates deterministic QuickPick-like items.
These behaviors are tested through mocks only.  A guarded local-only
Extension Host smoke scaffold now exists at
`scripts/vscode-extension-host-smoke.sh`, but it exits as not enabled by
default and no real VS Code Extension Host coverage is claimed yet.
Extension Host gates are tracked in
[`docs/EXTENSION_HOST_READINESS.md`](./docs/EXTENSION_HOST_READINESS.md).

This scaffold is not LSP, not a full IDE replacement, not a stable
ABI/API, and not a marketplace-ready or published extension.
There are no enabled VS Code GUI or Extension Host integration tests yet.

## Local Smoke

```bash
node editors/vscode-prototype/test/adapter.test.mjs
node editors/vscode-prototype/test/cli-runner.test.mjs
node editors/vscode-prototype/test/facade.test.mjs
node editors/vscode-prototype/test/extension-manifest.test.mjs
node editors/vscode-prototype/test/extension-config.test.mjs
node editors/vscode-prototype/test/extension-entrypoint.test.mjs
node editors/vscode-prototype/test/command-handlers.test.mjs
node editors/vscode-prototype/test/presenter.test.mjs
node editors/vscode-prototype/test/extension-host-readiness.test.mjs
bash scripts/vscode-adapter-smoke.sh
```

`scripts/vscode-extension-host-smoke.sh` is intentionally guarded.  By
default it exits with a clear not-enabled message and does not download
VS Code, Electron, or npm dependencies.  `PCCX_RUN_EXTENSION_HOST_SMOKE=1`
is reserved for a future pinned `@vscode/test-electron` runner after the
dependency and CI policy are explicitly reviewed.

```bash
# Expected exit 2 until a real Extension Host runner is explicitly enabled.
bash scripts/vscode-extension-host-smoke.sh
```

The adapter can also print translated examples:

```bash
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json

node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json
```

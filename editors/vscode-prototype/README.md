# VS Code Prototype Adapter

This directory is an experimental local prototype for translating
pre-stable editor bridge JSON into VS Code-style data records.

It is not a VS Code extension, is not published to the marketplace, does
not implement LSP, and does not define a stable ABI/API.  It can consume
the checked examples under `docs/examples/editor-bridge` and can also run
limited live `pccx_ide_cli` JSON flows from this source tree.  Both paths
are tested without a VS Code GUI, npm install, Vivado, xsim, or hardware.

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
This is still not a VS Code extension package, not LSP, not a stable
ABI/API, and not a marketplace publishing path.

## Local Smoke

```bash
node editors/vscode-prototype/test/adapter.test.mjs
node editors/vscode-prototype/test/cli-runner.test.mjs
node editors/vscode-prototype/test/facade.test.mjs
bash scripts/vscode-adapter-smoke.sh
```

The adapter can also print translated examples:

```bash
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json

node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json
```

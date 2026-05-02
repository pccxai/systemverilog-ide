# VS Code Prototype Adapter

This directory is an experimental local prototype for translating the
pre-stable editor bridge JSON examples into VS Code-style data records.

It is not a VS Code extension, is not published to the marketplace, does
not implement LSP, and does not define a stable ABI/API.  It consumes the
checked examples under `docs/examples/editor-bridge` so the adapter layer
can be tested without a VS Code GUI, npm install, Vivado, xsim, or hardware.

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

## Local Smoke

```bash
node editors/vscode-prototype/test/adapter.test.mjs
bash scripts/vscode-adapter-smoke.sh
```

The adapter can also print translated examples:

```bash
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json

node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json
```

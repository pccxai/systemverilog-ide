# Editor Bridge Contract

## Status

This is an early, pre-stable CLI contract for external editor bridges.
It is not an LSP server, a published VS Code extension, a JetBrains
plugin, or a stable ABI/API.  Treat all JSON shapes as subject to change
while the `pccx-lab` boundary and IDE surface mature.

## Intended Consumers

- The experimental local VS Code extension scaffold.
- Future VS Code extension work.
- Future JetBrains or other editor bridges.
- Local scripts that need deterministic JSON.
- CI or headless checks that need diagnostics, problem lists, or module
  navigation records.

## Core Flows

For tool integrations, prefer JSON output:

```bash
# File diagnostics as editor problems
python -m pccx_ide_cli problems from-check <sv-file> --format json

# Existing xsim-style log diagnostics as editor problems
python -m pccx_ide_cli problems from-xsim-log <log-file> --format json

# Declaration index for project/file navigation
python -m pccx_ide_cli index <path> --format json

# Direct declaration export for editor navigation
python -m pccx_ide_cli declarations <path> --format json

# Locate one declaration by exact name
python -m pccx_ide_cli locate <path> <name> --kind module --format json
python -m pccx_ide_cli locate <path> <name> --kind package --format json
python -m pccx_ide_cli locate <path> <name> --kind interface --format json
python -m pccx_ide_cli locate <path> <name> --kind any --format json

# Opt-in pccx-lab diagnostics backend
python -m pccx_ide_cli check <sv-file> --backend pccx-lab --format json
```

## Output Handling Guidance

- Consume JSON for tools; text output is for humans.
- Preserve process exit codes.  For example, `locate` uses non-zero
  exits for no match or ambiguous matches.
- Do not silently fall back when an explicit backend is requested.  If
  `--backend pccx-lab` is configured and the binary is missing or
  returns invalid output, surface that failure.
- Treat all output shapes as pre-stable.  Bridge code should keep its
  adapter layer small and easy to update.

## Checked Examples

The pre-stable contract examples are checked in under
`docs/examples/editor-bridge`.  They are generated from synthetic
fixtures and are intended as adapter guidance, not a stable ABI/API.
The example drift check is:

```bash
bash scripts/check-editor-bridge-examples.sh
```

The module locate example uses the single-file fixture so the sample is
unambiguous; the full fixture directory intentionally contains duplicate
module names for ambiguity tests.

## Experimental Adapter Prototype

`editors/vscode-prototype` contains a local VS Code-style adapter
prototype that consumes the checked JSON examples or limited live
`pccx_ide_cli` JSON flows and translates them into diagnostic and
navigation records.  Its local command facade requires explicit
checked-example or live mode selection and emits VS Code-style JSON for
known flows only.

The VS Code prototype is the editor cockpit over this contract.  It owns
command registration, presentation mapping, and the opt-in live workspace
command boundary.  It is not a second analysis backend, does not
duplicate pccx-lab internals, and does not implement LSP.  pccx-lab
remains the CLI-first verification/tooling backend for reusable analysis
and validation behavior.

Checked-example remains the default.  Live workspace mode is explicit
opt-in and requires both `pccxSystemVerilog.mode=liveWorkspace` and
`pccxSystemVerilog.liveWorkspace.enabled=true`; disabled live workspace
commands fail clearly instead of falling back to examples.  The current
AI-assisted SystemVerilog development workflow work is boundary-only:
AI assistant status and context bundle commands expose local status,
bounded context, selected-symbol context, validation command proposal
data, disabled-by-default approved validation runner status/result data,
summary-only validation cache status, and proposal actions, with no AI
provider calls, no pccx-llm-launcher runtime calls yet, and no MCP server
implementation.

The same directory now includes an experimental local VS Code extension
scaffold.  Its command handlers are thin wrappers around the local facade:
VS Code command -> prototype settings -> extension wrapper -> facade ->
JSON -> diagnostics/navigation records.  The prototype settings are
validated before command wiring and route only into known facade flows.
The command-handler scaffold converts facade JSON into testable UI action
models for diagnostics and navigation behind injected VS Code-like
dependencies.
The presenter scaffold maps those UI action models to mockable
DiagnosticCollection-like and QuickPick-like APIs without requiring real
VS Code GUI tests.  A limited opt-in Extension Host runtime smoke exists,
but it is disabled by default, remains local-only, and is not a product
claim.  When explicitly enabled, it opens the controlled
`editors/vscode-prototype/test/fixtures/live-workspace` fixture and runs
live diagnostics and live navigation only against that tiny fixture path.
Live navigation verifies `live_top` through the explicit live workspace
opt-in command path without falling back to checked examples.
The scaffold is not published, has no marketplace packaging, has no LSP,
and is not a stable ABI/API.  Current coverage is mostly static/mock
tests and smoke tests; CI does not run the real Extension Host runtime
smoke yet.
The prototype documents the 1-based CLI position to 0-based editor
position conversion expected by editor adapters.

## Data Movement

The intended data path is explicit:

```text
SystemVerilog source or existing log file
  -> pccx_ide_cli command
  -> JSON output
  -> editor problem list or navigation entry

VS Code command
  -> prototype settings
  -> experimental extension wrapper
  -> local pccx-vscode-prototype facade
  -> JSON output
  -> testable diagnostics/navigation UI action
  -> mockable VS Code-like presenter
  -> diagnostics/navigation records
```

Future local coding-assistant mode should use the same controlled data
path.  Context bundle records should carry selected file/range,
bounded lexical selected-symbol context, diagnostics, declaration
references, recent command status, current mode, validation summaries, and
bounded snippets by path/range instead of whole workspaces.  Any command
proposal or validation proposal must remain proposal-only until an
editor/user-controlled executor accepts an allowlisted proposal ID.
Approved validation execution must use fixed argument arrays, bounded
output, an explicit user-approved command invocation, and no shell
interpolation.  pccx-lab command execution remains future/prepared in
this prototype.

`problems` converts local diagnostics and log records into editor-friendly
problem records.  `index` provides scanner-based module/package/interface
declaration records.  `declarations` exports those records directly, and
`locate` resolves exact declaration names by requested kind.

## Limitations

- Scanner-based scaffolds, not full SystemVerilog parsing.
- No LSP server in this repository today.
- No published editor extension or marketplace packaging is implemented
  here.
- No VS Code GUI integration test in this repository today.
- No stable schema yet.
- No real xsim or Vivado execution.
- No hardware access or hardware correctness claim.
- No AI provider calls or local chat backend integration in this repo
  today.
- No MCP server implementation in this repo today.
- No pccx-llm-launcher runtime call yet; future integration requires an
  explicit reviewed contract.

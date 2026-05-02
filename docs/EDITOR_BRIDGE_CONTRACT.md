# Editor Bridge Contract

## Status

This is an early, pre-stable CLI contract for external editor bridges.
It is not an LSP server, a VS Code extension, a JetBrains plugin, or a
stable ABI/API.  Treat all JSON shapes as subject to change while the
`pccx-lab` boundary and IDE surface mature.

## Intended Consumers

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

# Locate one module by exact name
python -m pccx_ide_cli locate <path> <module-name> --format json

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

## Data Movement

The intended data path is explicit:

```text
SystemVerilog source or existing log file
  -> pccx_ide_cli command
  -> JSON output
  -> editor problem list or navigation entry
```

`problems` converts local diagnostics and log records into
editor-friendly problem records.  `index` provides scanner-based
module/package/interface declaration records.  `locate` remains
module-oriented.

## Limitations

- Scanner-based scaffolds, not full SystemVerilog parsing.
- No LSP server in this repository today.
- No editor extension is implemented here.
- No stable schema yet.
- No real xsim or Vivado execution.
- No hardware access or hardware correctness claim.

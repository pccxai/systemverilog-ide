# Diagnostics Handoff Consumer

This document describes the VS Code prototype boundary for launcher
diagnostics handoff JSON. It is an experimental, read-only data consumer.
It parses a local `pccx.diagnosticsHandoff.v0`-style JSON document and
returns a deterministic summary for future UI surfaces.

The implementation lives in:

- `src/diagnostics-handoff-consumer.mjs`
- `src/diagnostics-handoff-status-surface.mjs`
- `test/diagnostics-handoff-consumer.test.mjs`
- `test/diagnostics-handoff-status-surface.test.mjs`
- `../../docs/examples/diagnostics-handoff/launcher-diagnostics-handoff.example.json`

## What It Does

The consumer validates:

- required handoff fields
- diagnostic severity and category values
- launcher, model, and runtime descriptor references
- read-only local artifact references
- JSON file, stdout JSON, and read-only local artifact transport sketches
- no telemetry, no automatic upload, and no write-back flags
- no launcher execution, no pccx-lab execution, no shell execution, no
  provider calls, no runtime calls, no MCP calls, no LSP implementation,
  and no marketplace flow flags

The summary records diagnostic counts by severity and category, descriptor
references, transport kinds, limitations, and safety flags. The output is
deterministic JSON and is suitable for a later UI panel or context bundle
entry.

`pccxSystemVerilog.showDiagnosticsHandoffSummary` is the first small
status surface over that summary. It consumes the adapter output as data
and writes a deterministic text summary to the prototype output channel.
It is experimental and local-only. It does not read raw handoff JSON in
the UI layer, does not execute launcher or pccx-lab, and does not invoke
the pccx-lab validator command.

`pccxSystemVerilog.buildAIContextBundle` can include a bounded
`diagnosticsHandoff` section from the same status surface. That context
section is summary-only: schema ID, handoff ID, diagnostic counts,
descriptor references, transport kinds, and read-only safety flags.
Missing or invalid handoff data is represented as unavailable/invalid
context instead of executing a backend command.

## What It Does Not Do

This boundary does not:

- execute `pccx-llm-launcher`
- execute `pccx-lab`
- invoke `pccx-lab diagnostics-handoff validate`
- spawn shell commands
- call network APIs or model providers
- touch hardware or model weights
- implement MCP
- implement LSP
- upload telemetry
- write back to launcher or lab state
- commit to API or ABI stability

The pccx-lab validator remains a separate CLI/core boundary. The IDE
consumer reads local JSON as data and should not bypass pccx-lab or
launcher boundaries.

## Fixture Sync

The checked fixture is copied from the launcher/lab handoff shape and is
manual for now. It is sanitized: no raw full logs, prompts, source code,
private paths, secrets, tokens, provider configuration, generated blobs,
hardware dumps, or model weight paths.

Future work may add UI presentation for this summary. That presentation
should stay above this adapter layer and should keep pccx-lab as the
verification/tooling backend.

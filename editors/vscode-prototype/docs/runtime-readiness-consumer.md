# Runtime Readiness Consumer

This document describes the VS Code prototype boundary for launcher
runtime readiness JSON. It is an experimental, read-only data consumer.
It parses a local `pccx.runtimeReadiness.v0`-style JSON document and
returns a deterministic bounded summary for future status and context
surfaces.

The implementation lives in:

- `src/runtime-readiness-consumer.mjs`
- `src/runtime-readiness-status-surface.mjs`
- `test/runtime-readiness-consumer.test.mjs`
- `test/runtime-readiness-status-surface.test.mjs`
- `../../docs/examples/runtime-readiness/launcher-runtime-readiness.gemma3n-e4b-kv260.example.json`

## What It Does

The consumer validates the checked Gemma 3N E4B plus KV260 readiness
fixture shape from `pccx-llm-launcher` PR #21. The current launcher
answer is `blocked_not_yet_evidence_backed`.

Coordination is tracked in `pccxai/systemverilog-ide#58`. The launcher
status summary used by this boundary is referenced from
`pccxai/pccx-llm-launcher#22`.

The summary records:

- readiness and evidence states
- target model and target device
- timing, bitstream, implementation, KV260 smoke, runtime evidence, and
  throughput states
- bounded blocker count and blocker list
- read-only safety flags

The current fixture represents xsim and Vivado synthesis evidence as
non-runtime evidence, while timing, implementation, bitstream, KV260
smoke, runtime evidence, and measured throughput remain unavailable or
blocked. Throughput stays target-only.

`src/runtime-readiness-status-surface.mjs` exposes that consumer summary
as local status data. `src/context-bundle.mjs` can include the same
summary as bounded read-only context when a status surface or consumer
summary is supplied. Missing or invalid readiness data is represented as
unavailable or invalid context and does not trigger execution.

## What It Does Not Do

This boundary does not:

- execute `pccx-llm-launcher`
- execute `pccx-lab`
- invoke the pccx-lab validator
- access the FPGA repository
- execute KV260 runtime code
- load, copy, or reference model weights by path
- call providers or network APIs
- implement MCP
- implement LSP
- package for marketplace distribution
- upload telemetry
- write back to launcher, lab, FPGA, or IDE state
- commit to API or ABI stability
- report KV260 runtime success
- report Gemma 3N E4B KV260 runtime success
- claim a measured throughput result

The IDE consumer is for future presentation and context use only. Runtime
readiness evidence remains owned by the launcher, lab, FPGA, and hardware
boundaries that produce it.

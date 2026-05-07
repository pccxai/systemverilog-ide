# Test Taxonomy

This taxonomy names the test layers for `systemverilog-ide` while the
repository remains a pre-stable editor cockpit over pccx-lab and launcher
data boundaries. It is a planning and review aid: new tests should make
their owning layer clear, keep fixture scope narrow, and avoid broadening
runtime ownership by accident.

## Goals

- Keep Python CLI, editor bridge, VS Code prototype, and boundary-safety
  evidence separated.
- Make PR review easier by showing which command exercises which layer.
- Preserve the current checked-fixture and no-shell/no-runtime boundaries.
- Keep cross-repo integration tests out of this repository unless a later
  PR explicitly adds a reviewed boundary for them.

## Layers

| Layer | Name | Owner surface | Primary evidence | Typical command |
|---|---|---|---|---|
| T0 | Repository hygiene | repo policy, claims, source headers | CI claim scan, required-file checks, source header guard | `python3 scripts/check-source-headers.py` |
| T1 | Python unit and contract tests | `src/pccx_ide_cli` modules and schemas | deterministic pytest coverage for envelopes, scanners, exports, and backend adapters | `python -m pytest -q` |
| T2 | CLI scaffold smoke | public `python -m pccx_ide_cli` command shapes | JSON kind checks, text-output checks, expected non-zero exits | `bash scripts/editor-bridge-smoke.sh` |
| T3 | Checked example drift | files under `docs/examples/**` | regenerated output matches checked JSON examples | `bash scripts/check-editor-bridge-examples.sh` |
| T4 | VS Code prototype adapter tests | `editors/vscode-prototype/src` and facade | Node tests for adapter, facade, command handlers, presentation, context, proposal, and cache records | `bash scripts/vscode-adapter-smoke.sh` |
| T5 | Boundary-safety tests | live workspace, command descriptors, approved runner, local workflow context | static and unit checks for no shell interpolation, bounded output, disabled-by-default execution, and data-only handoffs | included in `bash scripts/vscode-adapter-smoke.sh` |
| T6 | Optional extension-host smoke | local VS Code extension host harness | guarded runtime smoke for extension entrypoint behavior in the fixture workspace | `bash scripts/vscode-extension-host-smoke.sh` |
| T7 | Manual review evidence | docs and cross-repo planning boundaries | reviewer-readable notes for out-of-scope runtime, hardware, provider, MCP, LSP, and marketplace claims | PR summary and linked docs |

## Classification Rules

### T0: Repository Hygiene

Use T0 for repository-wide rules that should fail before behavior tests
matter. This includes source header checks for code files, required-file
checks, and wording guards that keep documentation from making unsupported
claims.

T0 tests should not parse SystemVerilog, run pccx-lab, invoke launcher
tools, start providers, call hardware, or inspect user workspaces.

### T1: Python Unit and Contract Tests

Use T1 for deterministic Python behavior owned by this repository:

- diagnostics envelope construction and schema validation
- scanner-based module, package, and interface declaration indexing
- locate output records
- module organization summaries
- xsim log parsing from checked local log fixtures
- editor problem export shape
- pccx-lab backend adapter behavior using fakes, missing-binary checks, or
  captured fixture output

T1 tests should use local fixtures and direct Python APIs where possible.
They may assert command-facing JSON fields when that is the narrowest way
to pin a contract, but broad CLI command coverage belongs in T2.

### T2: CLI Scaffold Smoke

Use T2 to prove the public CLI facade still accepts the documented command
shapes and emits parseable JSON or expected text. These tests should cover
happy paths, expected diagnostic exits, and known missing-input failures.

T2 should stay shallow: it should not duplicate every T1 assertion, and it
should not become a semantic SystemVerilog verification suite.

### T3: Checked Example Drift

Use T3 for checked examples consumed by docs, the editor bridge, or the VS
Code prototype. A T3 failure means a fixture output changed and the checked
example needs either regeneration with review or a code fix.

Checked examples are data-contract evidence. They are not runtime evidence
for pccx-lab, launcher, Vivado, xsim execution, providers, MCP, LSP, or
hardware.

### T4: VS Code Prototype Adapter Tests

Use T4 for Node-based prototype behavior that maps checked or live CLI data
into editor-shaped records. This includes adapter mapping, facade argument
construction, command-handler configuration, presentation records, context
bundles, proposal data, result summaries, and local cache behavior.

T4 tests should run without npm install beyond the checked lockfile state
used by the optional extension-host smoke. Default adapter and facade tests
should use Node built-ins and checked local fixtures.

### T5: Boundary-Safety Tests

Use T5 for tests whose main purpose is protecting boundaries rather than
checking business output. Examples:

- live workspace commands require explicit opt-in configuration
- command runners use argument arrays rather than shell strings
- approved validation runner is disabled by default
- allowlisted commands are fixed and bounded
- launcher, pccx-lab, provider, MCP, LSP, telemetry, upload, and write-back
  paths remain absent unless a later reviewed boundary adds them
- context bundles summarize data instead of embedding raw logs or arbitrary
  workspace content

T5 can live in pytest, Node tests, or shell smoke scripts depending on the
surface it protects. Name assertions and test descriptions so reviewers can
tell that the test is a boundary guard.

### T6: Optional Extension-Host Smoke

Use T6 only for the guarded local VS Code Extension Host path. It is useful
for entrypoint and manifest readiness, but it is heavier than the default
static/mock tests and should remain optional unless CI policy changes.

T6 should stay fixture-bound and should not scan a user workspace or claim
product readiness.

### T7: Manual Review Evidence

Use T7 when the right evidence is a reviewed boundary note rather than an
automated test. This applies to cross-repo ownership, future pccx-lab
validation ownership, launcher handoff ownership, hardware claims, provider
claims, release policy, and marketplace packaging policy.

Manual review evidence should name what changed, what was intentionally
left out of scope, and which lower test layers were run.

## PR Evidence Guide

For each PR, include the highest-signal commands that match the touched
surface:

| Change type | Minimum local evidence |
|---|---|
| Docs only | Link/claim sanity via CI; note if no local command was needed |
| Python CLI behavior | `python -m pytest -q` and any relevant CLI smoke |
| Checked JSON examples | `bash scripts/check-editor-bridge-examples.sh` |
| CLI command surface | `bash scripts/editor-bridge-smoke.sh` |
| VS Code prototype adapters or commands | `bash scripts/vscode-adapter-smoke.sh` |
| Extension host entrypoint | `bash scripts/vscode-extension-host-smoke.sh` when dependencies are available |
| Boundary or safety behavior | the owning pytest or Node test plus the smoke script that includes it |

When a command is skipped, record the reason. Common acceptable reasons are
missing optional Extension Host dependencies, docs-only changes, or a
change that is intentionally limited to checked examples already covered by
the example drift script.

## Test Data Rules

- Prefer small fixtures under `fixtures/**` for Python CLI behavior.
- Prefer checked example JSON under `docs/examples/**` for editor bridge
  data contracts.
- Keep xsim inputs as existing local log fixtures; do not run xsim from
  this repository.
- Keep launcher and runtime readiness inputs as checked local JSON; do not
  invoke launcher tools.
- Keep pccx-lab backend tests fake-driven or missing-binary driven unless
  a later PR adds an explicit reviewed integration boundary.
- Do not use real user workspaces, hardware paths, provider credentials,
  telemetry endpoints, or upload targets as test data.

## CI Mapping

Current CI maps the taxonomy this way:

- `claim-scan`: T0 wording guard.
- `link-sanity`: T0 required-file and sibling-repo link checks.
- `scaffold-smoke / pytest`: T1.
- `scaffold-smoke / cli smoke`: T2.
- `scaffold-smoke / editor bridge example drift check`: T3.
- `scaffold-smoke / VS Code adapter prototype smoke`: T4 and T5.

The optional Extension Host smoke is tracked by script but is not required
by the default CI workflow at the time this taxonomy was written.

## Out Of Scope For This Repository

- Vivado or xsim execution tests.
- Hardware/KV260 runtime tests.
- Provider or model runtime tests.
- Launcher execution tests.
- pccx-lab end-to-end execution tests.
- MCP server/runtime tests.
- Full LSP conformance tests.
- Marketplace packaging or publication tests.
- Tests that require telemetry, upload, write-back, release, or tag flows.

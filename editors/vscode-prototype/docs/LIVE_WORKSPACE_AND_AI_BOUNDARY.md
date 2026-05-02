# Live Workspace and AI Boundary

## Status

This is experimental boundary documentation for the local VS Code
prototype.  It is not a production promise, not a stable API/ABI, not
LSP, has no marketplace packaging, and the AI surface is status/context
only.

Checked-example remains the default.  Live workspace mode is opt-in and
requires both:

- `pccxSystemVerilog.mode=liveWorkspace`
- `pccxSystemVerilog.liveWorkspace.enabled=true`

AI assistant behavior is disabled by default:

- `pccxSystemVerilog.aiAssistant.enabled=false`
- `pccxSystemVerilog.aiAssistant.backend=none`

## Roles

```text
VS Code editor cockpit
  -> extension command/config boundary
  -> local pccx-vscode-prototype facade
  -> pccx_ide_cli JSON contract
  -> pccx-lab CLI/core boundary where configured

Future local coding-assistant mode
  -> bounded context bundle
  -> command proposal / validation proposal
  -> controlled tool boundary
  -> pccx-lab or future pccx-llm-launcher contract
```

`systemverilog-ide` owns editor presentation, command registration,
context-bundle construction, and proposal display.  It should not copy
reusable analysis or verification behavior from pccx-lab.

`pccx-lab` is the CLI-first verification/tooling backend.  Analysis,
diagnostics, declaration lookup, validation status, and log handoff
should flow through the facade or CLI/core boundary.

`pccx-llm-launcher` is a future local LLM/chat/model backend candidate.
There are no pccx-llm-launcher runtime calls in this prototype.  A later
integration needs an explicit contract for request shape, response shape,
local process/session behavior, failure handling, and user approval
boundaries.

## Live Workspace Commands

The current command shape is intentionally narrow:

- `pccxSystemVerilog.publishLiveWorkspaceDiagnostics`
- `pccxSystemVerilog.showLiveWorkspaceNavigation`

The older `pccxSystemVerilog.runDiagnosticsLive` and
`pccxSystemVerilog.runNavigationLive` command IDs remain experimental
opt-in aliases.  Live commands build fixed facade argument arrays for
known flows only.  They do not accept arbitrary shell commands, do not
use shell interpolation, do not silently fall back to checked-example
mode, and do not start background scanning.

The controlled fixture workspace is
`editors/vscode-prototype/test/fixtures/live-workspace`.  The opt-in
Extension Host runtime smoke opens that fixture, explicitly enables live
workspace mode, runs live diagnostics against the tiny broken fixture
file, and asserts the result did not come from checked examples.  This
does not make live mode a production promise.

## AI Assistant Proposal Boundary

The current AI assistant boundary is a proposal model only.
`pccxSystemVerilog.showAIAssistantStatus` returns local status and
proposal boundaries.  `pccxSystemVerilog.buildAIContextBundle` returns a
bounded context bundle for the active editor state.  There are no AI
provider calls, no external API keys, no pccx-llm-launcher runtime calls
yet, and no MCP server implementation.

Allowed proposal kinds:

- `explainDiagnostics`
- `proposePatch`
- `proposeValidationCommand`
- `summarizeLog`
- `askForMoreContext`
- `openRelatedSymbol`

Disallowed by default:

- `writeFile`
- `commit`
- `push`
- `merge`
- `release`
- `tag`
- `changeRuleset`
- `accessSecrets`
- `accessStaging`

Patch, validation, and commit execution stay outside these commands and
require explicit user approval.

## Context Bundle Contract

The context bundle is a token-saving JSON contract.  It prefers:

- selected file path and selected range
- selected symbol and recent declaration references
- active diagnostics around the selected range
- current mode/configuration
- recent command status
- recent validation status
- pccx-lab command output summaries
- bounded snippets for explicit selections with path/range references
- summarized logs, not full logs

Limits are enforced by `src/context-bundle.mjs`:

- max files
- max diagnostics
- max declarations
- max snippet lines
- max log summary lines
- max text characters

The builder excludes binary-like content, `node_modules`, `.vscode-test`,
`.git`, `AGENTS.md`, `package-lock.json`, secret-like path names, and
private worker instruction paths.  It redacts secret-like assignment
lines, emits redaction/exclusion metadata, keeps deterministic ordering,
and avoids absolute home-path leakage when a workspace root is known.

## Daily-Driver Roadmap

Now:

- checked-example diagnostics/navigation/definition
- explicit live workspace boundary
- context bundle command

Next:

- fixture-backed live diagnostics/navigation coverage
- selected symbol context
- validation command proposal
- pccx-lab command palette integration

Later:

- pccx-llm-launcher local assistant backend
- MCP controlled tool boundary
- richer editor UI/panels
- optional theme presets via tokens

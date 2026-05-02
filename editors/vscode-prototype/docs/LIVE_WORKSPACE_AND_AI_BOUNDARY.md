# Live Workspace and AI Boundary

## Status

This is experimental boundary documentation for the local VS Code
prototype.  It is not production-ready, not a stable API/ABI, not LSP,
not marketplace packaging, and not a complete AI integration.

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

## AI Assistant Proposal Boundary

The current AI assistant boundary is a proposal model only.  There are
no AI provider calls, no external API keys, no pccx-llm-launcher runtime
calls yet, and no MCP server implementation.

Allowed proposal kinds:

- explain diagnostics
- propose patch
- propose validation command
- summarize xsim/log output
- ask for more context
- open related symbol
- call pccx-lab tool through a controlled boundary

Disallowed by default:

- direct file write
- direct git commit
- direct push
- direct release/tag
- direct ruleset/settings/secrets change
- staging/private repo access
- arbitrary shell command

## Context Bundle Contract

The context bundle is a token-saving JSON contract stub.  It prefers:

- selected file path and selected range
- selected symbol and declaration references
- active diagnostics around the selected range
- recent validation status
- pccx-lab command output summaries
- bounded snippets with path/range references
- summarized logs, not full logs

Limits are enforced by `src/context-bundle.mjs`:

- max files
- max diagnostics
- max declarations
- max snippet lines
- max log summary lines
- max text characters

The builder excludes binary-like content, `node_modules`, `.vscode-test`,
`.git`, secret-like path names, and private worker instruction paths.  It
redacts secret-like assignment lines and keeps deterministic ordering for
reviewable tests.

# Live Workspace and AI Boundary

## Status

This is experimental boundary documentation for the local VS Code
prototype.  It is not a production promise, not a stable API/ABI, not
LSP, has no marketplace packaging, and the AI surface is status/context
and proposal data only.

Checked-example remains the default.  Live workspace mode is opt-in and
requires both:

- `pccxSystemVerilog.mode=liveWorkspace`
- `pccxSystemVerilog.liveWorkspace.enabled=true`

AI assistant behavior is disabled by default:

- `pccxSystemVerilog.aiAssistant.enabled=false`
- `pccxSystemVerilog.aiAssistant.backend=none`

Approved validation execution is disabled by default:

- `pccxSystemVerilog.validationRunner.enabled=false`
- `pccxSystemVerilog.validationRunner.mode=disabled`

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
file, runs live navigation for `live_top`, and asserts the results did
not come from checked examples.  Live navigation returns structured
Location-style records in the smoke path and avoids QuickPick/UI prompts.
This does not make live mode a production promise.

## AI Assistant Proposal Boundary

The current AI assistant boundary is a proposal model only.
`pccxSystemVerilog.showAIAssistantStatus` returns local status and
proposal boundaries.  `pccxSystemVerilog.buildAIContextBundle` returns a
bounded context bundle for the active editor state.
`pccxSystemVerilog.proposeValidationCommand` returns allowlisted
validation command proposals as data and does not execute them.
`pccxSystemVerilog.runApprovedValidationCommand` is a separate approved
validation runner command.  It only runs after explicit configuration and
only accepts allowlisted proposal IDs, not raw command strings.
`pccxSystemVerilog.showPccxLabBackendStatus` reports the configured
pccx-lab command boundary and future controlled operations without
running pccx-lab.  There are no AI provider calls, no external API keys,
no pccx-llm-launcher runtime calls yet, and no MCP server implementation.

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
- selected-symbol context and recent declaration references
- active diagnostics around the selected range
- current mode/configuration
- recent command status
- recent validation result summary
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
`.git`, lockfiles, agent instruction files, secret-like path names, and
internal instruction paths.  It redacts secret-like assignment
lines, emits redaction/exclusion metadata, keeps deterministic ordering,
and avoids absolute home-path leakage when a workspace root is known.

Selected-symbol context is lexical and bounded.  It may include the symbol
text under the cursor or selected text, current line, a nearby simple
declaration such as `module`, `package`, `interface`, `typedef`,
`parameter`, `localparam`, `function`, or `task`, diagnostics near the
selection, and recent navigation references.  It is not full semantic
SystemVerilog resolution.

Validation command proposals use allowlisted templates such as the VS Code
adapter smoke, editor bridge smoke, example drift check, pytest baseline,
and the opt-in Extension Host smoke.  They include reasons, risk levels,
and a required user approval marker.  The command returns JSON data only:
it does not spawn a process, call pccx-lab, call an AI provider, write
files, or run git commands.

The approved validation runner re-resolves proposal IDs through an
internal allowlist.  Runnable initial IDs are `vscodeAdapterSmoke`,
`editorBridgeSmoke`, `exampleDriftCheck`, and `pytestBaseline`.
`extensionHostSmokeOptIn` stays proposal-only inside the runner.  Runner
execution uses fixed executable/argument arrays, `shell=false`, bounded
stdout/stderr, a timeout, and JSON-serializable status.  It blocks
unknown IDs, raw command strings, destructive command patterns, git write
operations, release/tag/settings/secrets commands, patch proposals,
provider calls, pccx-llm-launcher runtime calls, MCP server operations,
and pccx-lab execution.  The runner does not add a UI approval prompt in
this prototype; callers should invoke it only after a user-approved
validation proposal.

When a validation run is attempted, the extension keeps a small
in-memory validation-result cache.  The cache is local-only,
summary-only, and newest-first; it stores bounded/redacted summaries with
proposal ID, status, allowlist label, exit code, duration/timestamps,
working-directory kind, command kind, bounded stdout/stderr summaries,
truncation/redaction flags, and safety metadata.  It does not persist to
disk and does not store full logs, raw shell command strings, secrets,
tokens, private home paths, generated blobs, model paths, or pccx-lab
outputs.  The cache UX exposes recent entries and cache status through
VS Code-native surfaces and a summary-only validation output channel.

The context bundle can carry the latest cached validation summary and a
small bounded recent validation history.  It does not include full logs,
raw absolute private paths, generated artifacts, launcher calls, AI
provider calls, MCP, LSP, marketplace packaging, release/tag flow, or
real pccx-lab execution.

Patch proposals are contract-only in this prototype.  The checked
contract accepts repository-relative paths and bounded hunk previews for
future user review, rejects private paths, secrets, shell commands,
generated artifacts, raw provider output, and auto-apply fields, and does
not apply changes.  The preview command shows checked proposal IDs only
through VS Code-native output and the clear command removes only the
in-memory preview result.

## Prototype Daily-Driver Loop

1. Inspect diagnostics and navigation.
2. Build a selected-symbol AI context bundle.
3. Propose a validation command.
4. User approves an allowlisted validation command.
5. The runner executes bounded validation after explicit enablement.
6. The validation-result cache summary flows back into the context bundle.
7. Future AI-assisted SystemVerilog development workflow can propose a patch or next validation, but does not execute directly.

## Daily-Driver Roadmap

Now:

- checked-example diagnostics/navigation/definition
- explicit live workspace boundary
- live fixture diagnostics/navigation smoke
- context bundle command
- selected-symbol context
- validation command proposal
- patch proposal contract
- approved validation runner boundary
- validation summary in the context bundle
- validation cache status command
- pccx-lab backend status

Next:

- selected-symbol to declaration context through live navigation
- diagnostics-aware prompt builder
- patch proposal format
- pccx-lab command palette execution with allowlisted commands

Later:

- pccx-llm-launcher local assistant backend
- MCP controlled tool boundary
- richer editor UI/panels
- optional theme presets via tokens

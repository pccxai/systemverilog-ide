# SystemVerilog Workflow Boundary

This document is a planning boundary for the future SystemVerilog workflow
hosted by `systemverilog-ide`. The
IDE remains an editor cockpit over controlled data and command contracts;
reusable analysis, validation, and simulation behavior stays behind the
`pccx-lab` CLI/core boundary.

This is not a model integration, not an MCP runtime implementation, not
an LSP implementation, and not a stable API/ABI. It is a workflow shape
for reviewed proposals, explicit user approval, and bounded local
validation.

## Related Boundaries

- [`ROADMAP.md`](./ROADMAP.md) tracks the repository Now / Next / Later
  direction.
- [`EDITOR_BRIDGE_CONTRACT.md`](./EDITOR_BRIDGE_CONTRACT.md) describes
  the pre-stable editor JSON surfaces.
- [`HANDOFF.md`](./HANDOFF.md) records cross-repo handoff paths.
- [`EVOLUTIONARY_LOOP_PLAN.md`](./EVOLUTIONARY_LOOP_PLAN.md) sketches the
  deferred generate / simulate / evaluate / refine loop.
- [`pccx-lab#22`](https://github.com/pccxai/pccx-lab/issues/22) tracks
  the controlled tool interface that future automation should use.

## Roles

- User: reviews context, approves writes, approves validation, and owns
  any public repository action.
- IDE: gathers bounded context, presents diagnostics/navigation/status,
  renders proposals, and records local validation summaries.
- pccx-lab: owns reusable analysis, verification, trace/report handling,
  and any future controlled tool execution boundary.
- pccx-llm-launcher: remains a future local runtime/backend candidate;
  this repository does not call it today.

## Workflow

1. Read project context.
   The IDE builds bounded context from selected files, diagnostics,
   declarations, recent validation summaries, and checked handoff/status
   surfaces. Context excludes secret-like data, private paths where a
   workspace root is known, full logs, artifact blobs, model paths, and
   repository-wide dumps.

2. Propose a change.
   Workflow tooling may return a proposal object with repository-
   relative paths, bounded hunk previews, rationale, affected symbols,
   and suggested validation. The proposal is data only. It does not write
   files, apply patches, run commands, or create commits.

3. Run analysis.
   Current analysis surfaces are local diagnostics, declaration
   navigation, editor problem exports, checked handoff summaries, and
   explicitly configured approved validation commands. Any future
   pccx-lab-backed analysis must use reviewed CLI/core contracts.

4. Run simulation or validation.
   Simulation remains a pccx-lab-owned or tool-owned execution path. The
   IDE may propose allowlisted validation commands and may show local
   summaries after explicit approval. It must not run raw shell commands,
   silently start xsim/Vivado, invoke pccx-lab outside a reviewed
   boundary, or bypass the controlled tool interface.

5. Summarize result.
   The IDE may summarize diagnostics, pass/fail status, bounded output,
   and next proposal context. Summaries stay local unless the user chooses
   to publish or commit them.

## Permission Boundary

| Action | Default | Boundary |
|---|---:|---|
| Read selected context | Allowed | Bounded context builder only |
| Read full workspace | Blocked | Requires a narrower explicit selection |
| Propose patch | Allowed | Data-only proposal, bounded preview |
| Apply patch | Blocked | User-approved edit path required |
| Run validation | Blocked | Explicit allowlisted runner approval required |
| Run pccx-lab | Blocked | Future reviewed CLI/core boundary only |
| Run xsim or Vivado | Blocked | Future reviewed validation boundary only |
| Call pccx-llm-launcher | Blocked | Future reviewed launcher contract only |
| Call provider/runtime services | Blocked | Outside this repository's current scope |
| Implement MCP runtime | Blocked | Tracked separately by pccx-lab #22 |
| Commit, push, merge, release, or tag | Blocked | User-owned repository action |
| Access secrets or staging notes | Blocked | Never part of the IDE workflow |

## Implementation Notes

- Keep checked-example mode as the safe default.
- Keep live workspace behavior opt-in and explicitly configured.
- Keep proposal objects deterministic and bounded.
- Keep validation command execution behind fixed argument arrays,
  `shell=false`, bounded output, timeouts, and proposal IDs.
- Keep patch previews and validation summaries local and summary-only.
- Keep pccx-lab command descriptors as data until the owning repo exposes
  a reviewed CLI/core command map.
- Keep controlled tool integration as a future pccx-lab-owned boundary rather
  than an IDE-owned back channel.

## Non-Goals

- No provider-specific naming in public user-facing docs.
- No autonomous merge, push, release, or tag flow.
- No automatic file writes from proposal data.
- No raw shell execution.
- No pccx-lab execution from this repository today.
- No xsim/Vivado execution from this repository today.
- No provider calls, launcher runtime calls, hardware access, model
  loading, telemetry, upload, or write-back flow.
- No production-ready, stable API/ABI, stable plugin ABI, LSP,
  marketplace-ready, runtime, timing, or performance claim.

## Issue Alignment

This document addresses
[`systemverilog-ide#4`](https://github.com/pccxai/systemverilog-ide/issues/4)
by recording the workflow steps, stating the permission boundary, and
linking the future controlled tool boundary in `pccx-lab#22`.

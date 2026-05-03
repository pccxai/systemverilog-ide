# Evolutionary Loop Plan

This document sketches a future generate / simulate / evaluate / refine
loop for SystemVerilog exploration in `systemverilog-ide`. The loop is a
planning boundary only. It does not add command execution, pccx-lab
execution, xsim/Vivado execution, MCP runtime behavior, provider calls,
or automatic repository changes.

The IDE remains the editor cockpit. `pccx-lab` remains the owner of
reusable analysis, verification, trace handling, and any future reviewed
simulation/tool execution boundary.

## Related Boundaries

- [`AI_ASSISTED_SYSTEMVERILOG_WORKFLOW.md`](./AI_ASSISTED_SYSTEMVERILOG_WORKFLOW.md)
  defines the proposal and permission model.
- [`ROADMAP.md`](./ROADMAP.md) records the repository roadmap.
- [`HANDOFF.md`](./HANDOFF.md) records the pccx-lab handoff boundaries.
- [`pccx-lab#22`](https://github.com/pccxai/pccx-lab/issues/22) tracks
  the controlled MCP/tool interface that any future automation should use.

## Loop Architecture

```text
bounded editor context
  -> candidate proposal
  -> user review
  -> allowlisted validation request
  -> pccx-lab-owned analysis or simulation boundary
  -> bounded result summary
  -> next proposal context
```

### Generate

The generate step proposes candidate edits as data:

- repository-relative file paths
- bounded hunk previews
- rationale and expected impact
- affected module/package/interface names
- proposed validation plan
- known risk notes

The proposal does not write files, apply patches, run tools, create
commits, push branches, or publish results.

### Simulate

The simulate step is a future reviewed boundary, not an IDE-owned
execution path. The IDE may request an allowlisted validation proposal,
but reusable command execution belongs behind pccx-lab or tool-specific
contracts.

The safe default is read-only status and checked examples. Any later
simulation path must keep:

- fixed executable and argument shapes
- no shell interpolation
- explicit user approval
- bounded stdout/stderr summaries
- timeouts and cancellation behavior
- no hardware or KV260 runtime side effects
- no raw log upload or telemetry

### Evaluate

The evaluate step scores candidate results using bounded, reviewable
signals. Candidate fitness can combine:

- parse/check status
- diagnostic count by severity
- expected module/declaration changes
- test or smoke status where an allowlisted validation ran
- xsim/Vivado log summaries where an approved boundary produced them
- waveform or trace delta summaries, if pccx-lab later exposes a checked
  report shape
- resource or timing-report status as reported evidence, without turning
  a target into an achieved claim
- reviewer notes and manual risk flags

The IDE should present these as summary data. It should not infer hardware
correctness, timing closure, runtime readiness, or performance success.

### Refine

The refine step creates the next bounded proposal context from:

- the prior candidate summary
- diagnostics near changed regions
- validation-result summaries
- reviewer-selected notes
- explicit follow-up constraints

Refinement does not auto-apply patches, re-run validation, push branches,
merge PRs, or publish reports.

## Safety Boundary

| Boundary | Rule |
|---|---|
| Evaluation mode | Read-only by default |
| Candidate promotion | Manual review and explicit user action |
| Patch application | Outside this planning loop until user-approved |
| Validation execution | Allowlisted runner or future pccx-lab boundary only |
| Simulation execution | Future reviewed pccx-lab/tool boundary only |
| Public reporting | User-reviewed PR, issue, or docs text only |
| Repository actions | No automatic commit, push, merge, release, or tag |
| Hardware/runtime | No KV260 runtime, model loading, provider calls, or hardware access |
| Secrets/private data | Excluded from context and public output |

## Issue Alignment

This document addresses
[`systemverilog-ide#5`](https://github.com/pccxai/systemverilog-ide/issues/5)
by recording the loop architecture, fitness criteria, and safety boundary
for read-only evaluation with manual promotion.

# SystemVerilog IDE Roadmap

This roadmap keeps `systemverilog-ide` aligned with the PCCX tooling
stack while the editor surface is still pre-stable. The repository is an
editor cockpit spun out of `pccx-lab`; reusable analysis and validation
behavior stays behind the `pccx-lab` CLI/core boundary.

Direction and safety rules remain pinned in
[`PROJECT_DIRECTION_AND_STYLE.md`](./PROJECT_DIRECTION_AND_STYLE.md).
The external editor bridge shape is documented in
[`EDITOR_BRIDGE_CONTRACT.md`](./EDITOR_BRIDGE_CONTRACT.md), and the
cross-repo handoff notes live in [`HANDOFF.md`](./HANDOFF.md).

## Now

- Keep the Python CLI scaffold focused on diagnostics, declaration
  indexing, declaration lookup, and editor problem export.
- Keep the VS Code prototype in checked-example mode by default, with
  live workspace commands gated by explicit local configuration.
- Surface pccx-lab and launcher data only through checked, read-only
  adapter boundaries:
  - diagnostics handoff summaries
  - runtime readiness summaries
  - device/session status summaries
  - existing xsim problem summaries
- Preserve the fixed-command, no-shell, bounded-output model for approved
  validation runner work.
- Keep documentation explicit that current JSON shapes are pre-stable and
  may change while the lab boundary matures.

## Next

- Expand project-aware navigation without claiming full semantic
  SystemVerilog parsing or LSP coverage. The module organization workflow
  for scanner-based boundary spans, hierarchy seeds, and proposal-only
  refactoring inputs is tracked in
  [`MODULE_ORGANIZATION_WORKFLOW.md`](./MODULE_ORGANIZATION_WORKFLOW.md).
- Continue diagnostics/xsim handoff planning through existing local JSON
  and text surfaces; reusable xsim execution remains owned by pccx-lab.
- Add editor-facing workflow notes for validation proposal preflight,
  result summary, and reviewed patch handoff. The workflow-boundary workflow
  planning boundary is tracked in
  [`SYSTEMVERILOG_WORKFLOW_BOUNDARY.md`](./SYSTEMVERILOG_WORKFLOW_BOUNDARY.md).
- Cross-link IDE workflow planning to the pccx-lab roadmap items:
  - [`pccx-lab#21`](https://github.com/pccxai/pccx-lab/issues/21) for the
    future plugin-system boundary
  - [`pccx-lab#22`](https://github.com/pccxai/pccx-lab/issues/22) for the
    controlled MCP/tool boundary
- Keep external editor planning separate from any stable extension API or
  marketplace packaging claim.

## Later

- Plan a local workflow mode that uses bounded context,
  reviewed proposals, and user-approved validation steps.
- Plan an evolutionary generate / simulate / evaluate / refine loop on top
  of the pccx-lab CLI/core boundary. The loop architecture and
  fitness-criteria sketch are tracked in
  [`EVOLUTIONARY_LOOP_PLAN.md`](./EVOLUTIONARY_LOOP_PLAN.md).
- Sketch external editor bridges beyond the local VS Code prototype only
  after the shared data contracts are clearer. The later-track bridge plan
  is tracked in
  [`EXTERNAL_EDITOR_INTEGRATION_PLAN.md`](./EXTERNAL_EDITOR_INTEGRATION_PLAN.md).
- Evaluate future plugin and MCP/tool integration through pccx-lab-owned
  boundaries before adding editor presentation.

## Out Of Scope

- No Vivado replacement claim.
- No full LSP implementation claim.
- No stable API/ABI or stable plugin ABI claim.
- No published VS Code extension or marketplace-ready claim.
- No launcher execution from this repository.
- No pccx-lab execution from this repository unless a later PR explicitly
  extends an allowlisted, reviewed boundary.
- No MCP runtime implementation in this repository.
- No provider/runtime integration.
- No KV260 runtime integration, hardware access, model loading, or
  throughput/performance claim.
- No automatic merge, public push, release, tag, upload, telemetry, or
  write-back flow.

## Issue Alignment

This document addresses
[`systemverilog-ide#1`](https://github.com/pccxai/systemverilog-ide/issues/1)
by recording a Now / Next / Later roadmap, linking the pccx-lab plugin and
MCP/tool roadmap items, and keeping the current status language bounded to
pre-stable editor and data-contract work.

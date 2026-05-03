# External Editor Integration Plan

This document sketches the later-track plan for bringing
`systemverilog-ide` data surfaces to VS Code and other editors without
making this repository VS Code-only. The current repository remains
pre-stable: it has an experimental local VS Code prototype and checked
editor-bridge examples, but it does not publish an extension, implement
LSP, or claim a stable extension API.

## Integration Principle

External editors should consume the same small JSON contracts that the
local CLI and prototype already use. Editor-specific code should map
those contracts into native UI records without duplicating analysis,
validation, or simulation logic.

```text
pccx_ide_cli JSON output
  -> editor bridge adapter
  -> editor-native diagnostics, navigation, status, and proposal UI
```

Reusable analysis and verification behavior stays behind the pccx-lab
CLI/core boundary. The IDE may present pccx-lab and launcher status data
through checked read-only adapters, but it must not invoke those tools
outside a reviewed allowlisted boundary.

## Target Editor Families

### VS Code

VS Code remains the local prototype path:

- checked examples are the default
- live workspace mode is explicit opt-in
- Extension Host runtime smoke remains opt-in and local-only
- command handlers remain thin wrappers over the facade
- presenter behavior stays mockable and testable without GUI automation

This is not a published extension or marketplace package.

### JetBrains And Other Editors

Future JetBrains or other editor bridges should start with adapter
contracts, not IDE-specific logic:

- consume diagnostics/problem JSON
- consume declaration/index/locate JSON
- consume bounded status/context summaries
- map data to editor-native diagnostics, navigation, and panel models
- keep writes and validation behind explicit user approval

No editor bridge should receive a privileged back channel into pccx-lab,
pccx-llm-launcher, hardware, provider calls, or private repository state.

## Contract Surfaces

Initial bridge surfaces are:

- `pccx_ide_cli check`
- `pccx_ide_cli problems from-check`
- `pccx_ide_cli problems from-xsim-log`
- `pccx_ide_cli index`
- `pccx_ide_cli declarations`
- `pccx_ide_cli locate`
- checked launcher/lab handoff status summaries consumed by the VS Code
  prototype
- proposal and validation-result summaries where they remain data only

All shapes remain pre-stable. Consumers should keep adapter layers small
and treat schema drift as a normal development concern until the
pccx-lab boundary is formal enough to bind to.

## Safety Boundary

- No stable extension API claim.
- No LSP implementation claim.
- No marketplace-ready claim.
- No pccx-lab execution from editor adapters.
- No launcher execution from editor adapters.
- No xsim/Vivado execution from editor adapters.
- No provider calls, telemetry, upload, or write-back flow.
- No hardware access, KV260 runtime, model loading, or performance claim.
- No automatic commit, push, merge, release, or tag action.

## Issue Alignment

This document addresses
[`systemverilog-ide#9`](https://github.com/pccxai/systemverilog-ide/issues/9)
by recording the VS Code, JetBrains/other editor, and generic data-bridge
direction while keeping extension APIs pre-stable and dependent on the
pccx-lab CLI/core boundary maturing first.

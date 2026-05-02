# pccx-lab Command Boundary

This document defines a pccx-lab command descriptor contract for the
experimental local VS Code prototype.  It is data-only and does not execute
pccx-lab, spawn a process, call a launcher, call a provider, implement MCP,
or implement LSP.

## Descriptor Shape

```json
{
  "version": 1,
  "descriptorId": "labStatus",
  "label": "pccx-lab backend status",
  "category": "status",
  "executionState": "future",
  "args": [],
  "workingDirectoryPolicy": "repo-root",
  "outputPolicy": {
    "maxLines": 120,
    "redactSecrets": true,
    "dropPrivatePaths": true
  },
  "requiresExplicitApproval": true
}
```

## Rules

- `category` is `status`, `diagnostics`, `trace`, or `verification`.
- `executionState` is `future`, `disabled`, or `allowlisted`.
- `workingDirectoryPolicy` is `repo-root`, `workspace-root`, or `configured`.
- `requiresExplicitApproval` must be `true`.
- `args` are fixed argument items only and must not include raw shell command
  text, shell control syntax, secrets, or private home paths.
- `outputPolicy.redactSecrets` and `outputPolicy.dropPrivatePaths` must both
  be `true`.
- The descriptor has no executable, raw command string, environment variable,
  or runtime output fields.

## Current Status

The checked descriptor is `labStatus` with `executionState: "future"`.
It is preparation for a reviewed pccx-lab CLI/core boundary and is not a
runtime integration.  Any later execution path must be disabled by default,
allowlisted, fixed-argument, explicitly approved, bounded, and reviewed in a
separate PR.

## Validation

`src/pccx-lab-command-descriptor.mjs` implements the contract and
`test/pccx-lab-command-descriptor.test.mjs` covers safe descriptor data,
unsafe field rejection, output policy bounds, and no-execution status.

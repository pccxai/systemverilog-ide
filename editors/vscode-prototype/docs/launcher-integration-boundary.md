# Launcher Integration Boundary

This document defines a status-only contract for future pccx-llm-launcher
integration.  The current VS Code prototype does not call the launcher, does
not communicate with devices, does not load models, does not include model
paths or board logs, and makes no board inference or performance claim.

## Status Shape

```json
{
  "version": 1,
  "launcherStatus": "future",
  "deviceStatus": "unknown",
  "sessionStatus": "none",
  "modelStatus": "unknown",
  "backendKind": "future",
  "capabilities": [
    "future bounded context consumer",
    "future local status bridge"
  ],
  "limitations": [
    "no launcher runtime calls in this prototype",
    "no device communication in this prototype",
    "no model or board performance claims"
  ],
  "lastUpdatedAt": "1970-01-01T00:00:00.000Z"
}
```

## Rules

- `launcherStatus` is `unavailable`, `available`, `future`, or `disabled`.
- `deviceStatus` is `unknown`, `not-connected`, `connected`, or `future`.
- `sessionStatus` is `none`, `starting`, `running`, `stopped`, or `future`.
- `modelStatus` is `unknown`, `not-loaded`, `loaded`, or `future`.
- `backendKind` is `local`, `external`, `future`, or `unknown`.
- Capabilities and limitations are bounded strings.
- Status text must not include secrets, private home paths, model artifacts,
  board logs, or board performance claims.
- Unknown fields such as model paths or runtime output are rejected.

## Current Status

The checked default is fixture-only and future-state.  It is suitable for
context bundle metadata and documentation, but it is not a runtime launcher
integration.

## Validation

`src/launcher-status-contract.mjs` implements the contract and
`test/launcher-status-contract.test.mjs` covers deterministic defaults,
safe fixture status, invalid enum rejection, unsafe text rejection, and
no-runtime-call safety flags.

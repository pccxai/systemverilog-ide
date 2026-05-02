# Validation Patch Handoff

This document describes the deterministic handoff from a validation summary
to a patch proposal context seed.  It is contract-only: it does not generate
patches, apply patches, write files, call pccx-lab, call pccx-llm-launcher,
call a provider, implement MCP, or implement LSP.

## Seed Shape

```json
{
  "version": "pccx.validationPatchHandoff.v0",
  "kind": "validation-patch-context-seed",
  "validationProposalId": "vscodeAdapterSmoke",
  "validationStatus": "failed",
  "boundedFailureSummary": "VS Code adapter smoke failed (exit 1)",
  "relatedDiagnostics": [
    {
      "path": "rtl/top.sv",
      "range": {
        "start": { "line": 0, "character": 0 },
        "end": { "line": 0, "character": 6 }
      },
      "severity": "Error",
      "message": "missing endmodule",
      "source": "pccx_ide_cli",
      "code": "PCCX-SCAFFOLD-003"
    }
  ],
  "candidateFiles": ["rtl/top.sv"],
  "suggestedValidationPlan": [
    "Re-run vscodeAdapterSmoke through the approved validation proposal after user-reviewed changes."
  ],
  "safety": {
    "summaryOnly": true,
    "fullLogsExcluded": true,
    "generatesPatch": false,
    "appliesPatch": false,
    "writesFiles": false,
    "providerCalls": false,
    "runtimeCalls": false,
    "launcherCalls": false,
    "pccxLabExecution": false
  }
}
```

## Rules

- Failed or blocked validation summaries may produce a bounded context seed.
- Passing validation summaries produce no seed.
- Full stdout/stderr logs are not included.
- Private home paths and secret-like assignment lines are redacted.
- Candidate files are repository-relative and come only from explicit
  context or bounded diagnostics.
- Dependency caches, private instruction paths, generated outputs,
  lockfiles, and secret-like paths are excluded.
- The handoff suggests validation only through approved validation proposal
  wording; it does not embed shell commands.

## Implementation

`src/validation-patch-handoff.mjs` implements the helper and
`test/validation-patch-handoff.test.mjs` covers failure seeds, passing
validation behavior, redaction, bounds, and contract-only safety flags.

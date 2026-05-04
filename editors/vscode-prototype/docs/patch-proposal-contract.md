# Patch Proposal Contract

This is a provider-free, proposal-only patch contract for the experimental
local VS Code prototype.  It describes possible edits for user review; it
does not apply patches, write files, call pccx-lab, call pccx-llm-launcher,
call provider/runtime services, implement MCP, or implement LSP.

## Shape

```json
{
  "version": 1,
  "proposalId": "missingEndmoduleFix",
  "source": "local-prototype",
  "title": "Add missing endmodule",
  "summary": "Proposes a small SystemVerilog syntax fix for review.",
  "riskLevel": "low",
  "files": [
    {
      "path": "fixtures/missing_endmodule.sv",
      "changeKind": "modify",
      "reason": "The checked fixture is missing a closing declaration.",
      "hunks": [
        {
          "oldStart": 1,
          "oldLines": 3,
          "newStart": 1,
          "newLines": 4,
          "preview": "@@\n module missing_endmodule;\n+endmodule"
        }
      ]
    }
  ],
  "validationPlan": [
    "Run the VS Code adapter smoke through the approved validation proposal."
  ],
  "nonGoals": [
    "Do not apply the patch automatically."
  ],
  "requiresUserReview": true
}
```

## Rules

- `source` is `local-prototype`.
- `riskLevel` is `low`, `medium`, or `high`.
- `changeKind` is `modify`, `add`, `delete`, or `rename`.
- `requiresUserReview` must be `true`.
- Paths must be repository-relative and single-line.
- Paths must not target private instruction locations, dependency caches,
  build outputs, lockfiles, model files, bitstreams, binary archives, or
  secret-like names.
- Text fields are bounded and must not include secret-like assignments,
  private home paths, or shell commands.
- Hunk previews are bounded and are previews only, not full file dumps.
- Unknown keys such as raw commands, auto-apply flags, provider output, or
  runtime output are rejected by the validator.

## Non-Goals

- No patch application.
- No file writes.
- No shell command execution.
- No raw provider output.
- No launcher runtime call.
- No pccx-lab execution.
- No MCP, LSP, marketplace packaging, release, or tag flow.

## Validation

The contract is implemented in `src/patch-proposal-contract.mjs` and tested
by `test/patch-proposal-contract.test.mjs`.  The module is data-only and
safe to use as a future handoff shape for user-reviewed patch previews.

`pccxSystemVerilog.showPatchProposalPreview` previews checked proposal IDs
through VS Code-native output without applying patches or writing files.
`pccxSystemVerilog.clearPatchProposalPreview` clears only the in-memory
preview result.  The preview path is implemented in
`src/patch-proposal-preview.mjs` and tested by
`test/patch-proposal-preview.test.mjs`.

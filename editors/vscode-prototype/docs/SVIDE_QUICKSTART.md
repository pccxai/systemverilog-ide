# SV-IDE Quickstart

This quickstart exercises the local VS Code prototype.  The extension is
not published to the marketplace and does not provide a stable API, LSP,
provider/runtime integration, pccx-lab execution, launcher execution,
Vivado/xsim launching, or hardware access.

## 1. Install The Local Prototype

From the repository root:

```bash
npm ci --prefix editors/vscode-prototype
code \
  --extensionDevelopmentPath="$PWD/editors/vscode-prototype" \
  "$PWD/editors/vscode-prototype/test/fixtures/live-workspace"
```

This opens a VS Code Extension Development Host with the prototype loaded
against the controlled fixture workspace.

## 2. Open The Panel

In the Extension Development Host, open the Command Palette and run:

```text
Developer: Show Running Extensions
```

Confirm `PCCX SystemVerilog IDE Prototype` is listed.  Then open
`View: Toggle Output` and select the `PCCX SystemVerilog IDE Prototype`
channel.  Validation summaries use the separate
`PCCX SystemVerilog Validation Results` output channel.

## 3. Run Preflight

Open the Command Palette and run:

```text
PCCX SystemVerilog: Audit Validation Proposal Preflight (Experimental)
```

Select `VS Code adapter smoke`.  The preflight verifies the selected
proposal is allowlisted, fixed-argument, summary-only, and blocked from
launcher/provider/runtime paths before any approved validation runner is
used.  It does not execute validation.

## 4. See Status

Open the Command Palette and run:

```text
PCCX SystemVerilog: Show Local Workflow Status (Experimental)
```

Review the `PCCX SystemVerilog IDE Prototype` output channel.  The status
summarizes the current prototype mode, live-workspace gate, validation
runner state, recent validation cache state, pccx-lab descriptor state,
launcher fixture state, and bounded context counts.

## 5. Export JSON

For a deterministic editor-problem export from the same repository
boundary, run from the repository root:

```bash
node editors/vscode-prototype/bin/pccx-vscode-prototype.mjs diagnostics \
  --mode live \
  --from-check fixtures/missing_endmodule.sv \
  > /tmp/svide-problems.json
```

The export is pre-stable JSON for editor bridge consumers.  It is a local
facade conversion path only; it does not run Vivado/xsim, execute
pccx-lab, call the launcher, upload data, or write back to the workspace.

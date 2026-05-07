# Changelog

All notable changes to this project are documented in this file.

The format follows Keep a Changelog. Entries here describe repository changes
under review and do not claim a published extension, marketplace package, tag,
release, or stable API/ABI.

## [Unreleased]

The 2026-05-07 v002.1 PR ramp is grouped below.

### Status Surface

- Added local read-only KV260 status readers, example JSON fixtures, CLI output,
  documentation, and a VS Code prototype panel for launcher NPU status and lab
  trace manifest data. [#124](https://github.com/pccxai/systemverilog-ide/pull/124)

### UI Theme

- Integrated copied pccx aperture logo assets, a prototype extension icon, the
  pccx SystemVerilog Light color theme, and a copied-asset notice. [#125](https://github.com/pccxai/systemverilog-ide/pull/125)

### Preflight Binding

- Extended the read-only launcher status data with serial preflight snapshot
  fields and surfaced tty, kernel, XRT, and timestamp values with missing-data
  defaults. [#126](https://github.com/pccxai/systemverilog-ide/pull/126)

### Polish

- Rendered readiness details in a no-script VS Code webview with status pills,
  evidence-path details, and maintainer empty states while retaining the
  output-channel fallback. [#127](https://github.com/pccxai/systemverilog-ide/pull/127)

### Palette

- Added v002.1 command-palette navigation for the status panel, runbook, project
  board, and trace help through the read-only panel or VS Code external URL
  opening. [#128](https://github.com/pccxai/systemverilog-ide/pull/128)

### Docs

- Added the v002.1 readiness panel developer guide covering local enablement,
  launcher-side data environment names, panel pill semantics, feedback routing,
  and command-palette entries. [#129](https://github.com/pccxai/systemverilog-ide/pull/129)

### Guardrails

- This changelog summarizes the #124-#129 PR stack only; it does not add or
  claim launcher execution, pccx-lab execution, serial writes, SSH, board
  commands, provider calls, telemetry, uploads, write-back, packaging, tags, or
  release flow.
- This changelog makes no marketplace flow claim and no stable API/ABI claim.

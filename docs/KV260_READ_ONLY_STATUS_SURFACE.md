# KV260 Read-Only Status Surface

This page documents the local IDE status surface for KV260 data. The surface
parses existing JSON data and renders a checklist before a future run path is
considered. It does not open SSH, run board commands, invoke the launcher,
invoke pccx-lab, load a bitstream, access AXI, scan networks, mutate files, or
write back status.

## Inputs

- `LauncherStatusReader` consumes the launcher `NPUStatus` shape from
  `pccxai/pccx-llm-launcher#70`: `bitstream_loaded`, `bitstream_uuid`,
  `axi_base_addr`, `axi_stat_register_value`, and `last_error`.
- The same reader accepts the launcher serial preflight snapshot from
  `pccxai/pccx-llm-launcher#72`: selected tty port, login result, truncated
  kernel uname display, XRT presence, and last preflight timestamp. When the
  snapshot is absent, blocked, or has no tty/login data, the panel reports
  `preflight not run` instead of reading environment variables or opening a
  port.
- `LabTraceReader` parses the lab `TraceManifest` JSON shape from
  `pccxai/pccx-lab#160` for file-replay trace manifests.

The launcher type is mirrored locally because this repository does not import
the launcher contract package.

## Rendered Surface

`Kv260StatusPanel` renders launcher status, lab manifest metadata, and a
`PreflightProposal` checklist:

- serial tty port
- serial login
- XRT present
- serial preflight timestamp

The checklist is display-only. A blocked item is evidence that the IDE should
keep any future KV260 run path gated until lower layers provide reviewed data.
The IDE surface does not run the launcher serial backend, SSH, shell commands,
or board commands; it only renders JSON already produced by the launcher side.

## CLI

```bash
sv-ide kv260-status
```

The command reads the bundled tiny fixtures by default and prints the same
status panel as text. Optional local JSON paths can be supplied with
`--launcher-status` and `--trace-manifest`.

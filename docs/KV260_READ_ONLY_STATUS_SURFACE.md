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
- `LabTraceReader` parses the lab `TraceManifest` JSON shape from
  `pccxai/pccx-lab#160` for file-replay trace manifests.

The launcher type is mirrored locally because this repository does not import
the launcher contract package.

## Rendered Surface

`Kv260StatusPanel` renders launcher status, lab manifest metadata, and a
`PreflightProposal` checklist:

- bitstream loaded
- AXI reachable
- manifest available

The checklist is display-only. A blocked item is evidence that the IDE should
keep any future KV260 run path gated until lower layers provide reviewed data.

## CLI

```bash
sv-ide kv260-status
```

The command reads the bundled tiny fixtures by default and prints the same
status panel as text. Optional local JSON paths can be supplied with
`--launcher-status` and `--trace-manifest`.

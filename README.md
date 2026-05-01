# pccx-systemverilog-ide

SystemVerilog IDE layer for the PCCX tooling stack.

## Status

This repository is the **planned IDE spin-out from [pccx-lab][pccx-lab]**.
Work has begun inside pccx-lab; this repo will hold the IDE code once the
boundary is stabilized. Until then, expect the public surface to evolve.

The IDE is expected to stay tightly connected to pccx-lab for trace
analysis, diagnostics, verification workflows, and future AI-assisted
development flows.

## Integration model

The IDE integrates with pccx-lab through the **CLI / core boundary
first**, not by duplicating analysis logic. The same boundary should
support future VS Code extensions and MCP-controlled workflows.

Development order is fixed:

1. CLI / core boundary first (in pccx-lab)
2. IDE GUI surface second
3. VS Code extension and MCP integrations on top

## Planned features

- SystemVerilog navigation
- diagnostics and project-aware analysis
- xsim / log integration
- pccx trace and verification workflow integration
- pccx-lab plugin integration
- controlled MCP-backed analysis actions
- future VS Code extension path
- AI-assisted SystemVerilog development workflow
- evolutionary generate / simulate / evaluate / refine loop
- CLI-backed IDE actions
- shared command boundary with pccx-lab
- VS Code extension compatibility path

## Non-goals

- not a Vivado replacement
- not claiming complete LSP support yet
- not production-ready
- no autonomous hardware design claim
- no automatic merge / release actions

## Related

- [pccxai/pccx][pccx] — spec / docs / roadmap / release coordination
- [pccxai/pccx-lab][pccx-lab] — verification lab + plugin host + analysis backend
- [pccxai/pccx-FPGA-NPU-LLM-kv260][pccx-fpga] — RTL / Sail / KV260 / hardware evidence
- [pccxai/pccx-llm-launcher][pccx-launcher] — user-facing local LLM launcher

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

[pccx]: https://github.com/pccxai/pccx
[pccx-lab]: https://github.com/pccxai/pccx-lab
[pccx-fpga]: https://github.com/pccxai/pccx-FPGA-NPU-LLM-kv260
[pccx-launcher]: https://github.com/pccxai/pccx-llm-launcher

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$ROOT/editors/vscode-prototype/test/extension-host/run-extension-host-smoke.mjs"

cat_guard_message() {
  cat >&2 <<'EOF'
VS Code Extension Host smoke is not enabled yet.

Current coverage remains static/mock-only; no real VS Code Extension Host coverage is claimed.

Next gate, when explicitly approved:
- add a pinned @vscode/test-electron dev dependency
- add an isolated runner at editors/vscode-prototype/test/extension-host/run-extension-host-smoke.mjs
- keep the smoke local-only until CI stability is reviewed
- do not add vsce, packaging, publisher metadata, LSP, or marketplace flow

Set PCCX_RUN_EXTENSION_HOST_SMOKE=1 only after that runner and dependency policy are in place.
EOF
}

if [[ "${PCCX_RUN_EXTENSION_HOST_SMOKE:-}" != "1" ]]; then
  cat_guard_message
  exit 2
fi

if [[ ! -f "$RUNNER" ]]; then
  cat_guard_message
  echo "error: enabled by environment, but runner is missing: $RUNNER" >&2
  exit 2
fi

exec node "$RUNNER"

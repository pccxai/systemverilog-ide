#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$ROOT/editors/vscode-prototype/test/extension-host/run-extension-host-smoke.mjs"
NODE_DEPS="$ROOT/editors/vscode-prototype/node_modules/@vscode/test-electron"

cat_guard_message() {
  cat >&2 <<'EOF'
VS Code Extension Host smoke is available but not enabled by default.

Default coverage remains static/mock-only.  The real Extension Host smoke is an opt-in local runtime check and is not a product, marketplace, LSP, or stable API claim.

To run the pinned local smoke:
  npm ci --prefix editors/vscode-prototype
  PCCX_RUN_EXTENSION_HOST_SMOKE=1 bash scripts/vscode-extension-host-smoke.sh

The first enabled run downloads VS Code 1.90.2 through @vscode/test-electron into editors/vscode-prototype/.vscode-test.
CI does not run this runtime smoke yet; do not add vsce, packaging, publisher metadata, LSP, or marketplace flow.
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

if [[ ! -d "$NODE_DEPS" ]]; then
  echo "error: @vscode/test-electron is not installed." >&2
  echo "run: npm ci --prefix editors/vscode-prototype" >&2
  exit 127
fi

cd "$ROOT"

if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" && -x "$(command -v xvfb-run || true)" ]]; then
  exec xvfb-run -a node "$RUNNER"
fi

exec node "$RUNNER"

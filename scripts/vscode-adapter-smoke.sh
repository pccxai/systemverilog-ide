#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required for the VS Code adapter prototype smoke" >&2
  exit 127
fi

node editors/vscode-prototype/test/adapter.test.mjs
node editors/vscode-prototype/src/adapter.mjs diagnostics \
  docs/examples/editor-bridge/problems-xsim-mixed.example.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const d=JSON.parse(s);if(!Array.isArray(d)||d.length===0)process.exit(1);})"
node editors/vscode-prototype/src/adapter.mjs navigation \
  docs/examples/editor-bridge/declarations.example.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const d=JSON.parse(s);if(!Array.isArray(d)||!d.some(x=>x.kind==='package'))process.exit(1);})"

echo "vscode adapter prototype smoke ok"

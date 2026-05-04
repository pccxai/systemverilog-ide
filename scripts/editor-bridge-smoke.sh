#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v python >/dev/null 2>&1; then
  PY=python
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  echo "error: python or python3 is required" >&2
  exit 127
fi

export PYTHONPATH="$ROOT/src${PYTHONPATH:+:$PYTHONPATH}"
cd "$ROOT"

run_json() {
  local expected_kind="$1"
  shift
  "$PY" -m pccx_ide_cli "$@" \
    | "$PY" -c "import json,sys; d=json.load(sys.stdin); assert d.get('kind') == '$expected_kind', d"
}

run_json editor-problems problems from-check fixtures/ok_module.sv --format json
run_json editor-problems problems from-check fixtures/missing_endmodule.sv --format json
run_json editor-problems problems from-xsim-log fixtures/xsim/mixed.log --format json
run_json module-index index fixtures/modules --format json
run_json declarations declarations fixtures/modules --format json
run_json locate locate fixtures/modules/simple_module.sv simple_mod --format json
run_json module-hierarchy-view hierarchy fixtures/organization/hierarchy_top.sv --format json
run_json module-dependency-view dependencies fixtures/organization/hierarchy_top.sv --format json
run_json module-summary-view module-summary fixtures/organization/hierarchy_top.sv --format json
run_json module-port-usage-view port-usage fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
run_json module-refactor-impact-view refactor-impact fixtures/organization/hierarchy_top.sv --module leaf_mod --format json
run_json module-refactor-proposal refactor-plan fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
run_json module-refactor-validation-plan validation-plan fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
run_json module-refactor-review-packet refactor-review fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
run_json module-refactor-approval-decision refactor-approval fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
run_json module-refactor-application-request refactor-application fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
run_json module-refactor-application-result refactor-result fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json
run_json module-refactor-handoff-summary refactor-handoff fixtures/organization/hierarchy_top.sv --action rename-module --module top_mod --new-name top_mod_next --format json

bash scripts/check-editor-bridge-examples.sh

echo "editor bridge smoke ok"

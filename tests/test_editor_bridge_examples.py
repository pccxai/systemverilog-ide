from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXAMPLES_DIR = REPO_ROOT / "docs" / "examples" / "editor-bridge"
CONTRACT_DOC = REPO_ROOT / "docs" / "EDITOR_BRIDGE_CONTRACT.md"

EXPECTED_KINDS = {
    "problems-check-ok.example.json": "editor-problems",
    "problems-check-missing-endmodule.example.json": "editor-problems",
    "problems-xsim-mixed.example.json": "editor-problems",
    "index-modules.example.json": "module-index",
    "declarations.example.json": "declarations",
    "locate-module.example.json": "locate",
    "locate-package.example.json": "locate",
    "locate-interface.example.json": "locate",
}


def test_editor_bridge_examples_are_valid_json_with_expected_kinds():
    actual_files = {path.name for path in EXAMPLES_DIR.glob("*.example.json")}
    assert actual_files == set(EXPECTED_KINDS)

    for filename, expected_kind in EXPECTED_KINDS.items():
        payload = json.loads((EXAMPLES_DIR / filename).read_text(encoding="utf-8"))
        assert payload["kind"] == expected_kind


def test_editor_bridge_example_check_script_exits_zero():
    result = subprocess.run(
        ["bash", "scripts/check-editor-bridge-examples.sh"],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(REPO_ROOT / "src"),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "editor bridge examples ok" in result.stdout


def test_contract_doc_mentions_checked_examples():
    text = CONTRACT_DOC.read_text(encoding="utf-8")
    assert "docs/examples/editor-bridge" in text
    assert "pre-stable contract examples" in text
    assert "not a stable ABI/API" in text

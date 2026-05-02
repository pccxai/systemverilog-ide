from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "src"
CONTRACT_DOC = REPO_ROOT / "docs" / "EDITOR_BRIDGE_CONTRACT.md"


def _run_cli(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "pccx_ide_cli", *args],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(SRC),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )


def _json_stdout(result: subprocess.CompletedProcess) -> dict:
    assert result.stdout.strip(), result.stderr
    return json.loads(result.stdout)


def test_contract_problems_from_check_ok_module():
    result = _run_cli(
        "problems",
        "from-check",
        "fixtures/ok_module.sv",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr

    payload = _json_stdout(result)
    assert payload["kind"] == "editor-problems"
    assert payload["source_kind"] == "check"
    assert payload["source"] == "fixtures/ok_module.sv"
    assert payload["problems"] == []


def test_contract_problems_from_check_missing_endmodule():
    result = _run_cli(
        "problems",
        "from-check",
        "fixtures/missing_endmodule.sv",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr

    payload = _json_stdout(result)
    assert payload["kind"] == "editor-problems"
    assert payload["source_kind"] == "check"
    assert payload["source"] == "fixtures/missing_endmodule.sv"
    assert payload["problems"]

    problem = payload["problems"][0]
    assert problem["severity"] == "error"
    assert problem["message"]
    assert problem["file"] == "fixtures/missing_endmodule.sv"
    assert problem["line"] == 1
    assert problem["column"] == 1
    assert problem["code"] == "PCCX-SCAFFOLD-003"


def test_contract_problems_from_xsim_log_mixed():
    result = _run_cli(
        "problems",
        "from-xsim-log",
        "fixtures/xsim/mixed.log",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr

    payload = _json_stdout(result)
    assert payload["kind"] == "editor-problems"
    assert payload["source_kind"] == "xsim-log"
    assert payload["source"] == "fixtures/xsim/mixed.log"
    assert payload["problems"]

    codes = {problem.get("code") for problem in payload["problems"]}
    assert "VRFC 10-1234" in codes
    assert "XSIM 43-9999" in codes


def test_contract_index_modules_json():
    result = _run_cli("index", "fixtures/modules", "--format", "json")
    assert result.returncode == 0, result.stderr

    payload = _json_stdout(result)
    assert payload["kind"] == "module-index"
    assert isinstance(payload["modules"], list)
    assert payload["modules"]
    assert isinstance(payload["declarations"], list)
    assert payload["declarations"]


def test_contract_declarations_json():
    result = _run_cli("declarations", "fixtures/modules", "--format", "json")
    assert result.returncode == 0, result.stderr

    payload = _json_stdout(result)
    assert payload["kind"] == "declarations"
    assert payload["source"] == "fixtures/modules"
    assert isinstance(payload["declarations"], list)
    assert payload["declarations"]
    kinds = {declaration["kind"] for declaration in payload["declarations"]}
    assert {"module", "package", "interface"} <= kinds


def test_contract_locate_simple_module_json():
    result = _run_cli(
        "locate",
        "fixtures/modules/simple_module.sv",
        "simple_mod",
        "--format",
        "json",
    )
    assert result.returncode == 0, result.stderr

    payload = _json_stdout(result)
    assert payload["kind"] == "locate"
    assert payload["source"] == "line-scanner"
    assert payload["query"] == "simple_mod"
    assert isinstance(payload["matches"], list)
    assert len(payload["matches"]) == 1

    match = payload["matches"][0]
    assert match["module"] == "simple_mod"
    assert match["kind"] == "module"
    assert match["name"] == "simple_mod"
    assert match["file"] == "fixtures/modules/simple_module.sv"
    assert match["line"] == 1
    assert match["column"] == 1


def test_contract_smoke_script_exits_zero():
    result = subprocess.run(
        ["bash", "scripts/editor-bridge-smoke.sh"],
        cwd=REPO_ROOT,
        env={
            "PYTHONPATH": str(SRC),
            "PATH": os.environ.get("PATH", ""),
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "editor bridge smoke ok" in result.stdout


def test_contract_invalid_problems_format_fails_clearly():
    result = _run_cli(
        "problems",
        "from-check",
        "fixtures/ok_module.sv",
        "--format",
        "xml",
    )
    assert result.returncode != 0
    assert "invalid choice" in result.stderr


def test_contract_missing_problems_input_fails_clearly():
    result = _run_cli(
        "problems",
        "from-check",
        "fixtures/does_not_exist.sv",
        "--format",
        "json",
    )
    assert result.returncode != 0
    assert "does not exist" in result.stderr


def test_contract_doc_mentions_core_flows_and_limitations():
    text = CONTRACT_DOC.read_text(encoding="utf-8")
    lowered = text.lower()

    assert "problems from-check" in text
    assert "problems from-xsim-log" in text
    assert "index <path>" in text
    assert "declarations <path>" in text
    assert "locate <path> <name>" in text
    assert "--kind package" in text
    assert "--kind interface" in text
    assert "--backend pccx-lab" in text
    assert "not an lsp server" in lowered
    assert "stable abi/api" in lowered
    assert "no real xsim or vivado execution" in lowered

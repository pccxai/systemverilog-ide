# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DIRECTION_DOC = REPO_ROOT / "docs" / "PROJECT_DIRECTION_AND_STYLE.md"
README = REPO_ROOT / "README.md"
HANDOFF = REPO_ROOT / "docs" / "HANDOFF.md"

POSITIVE_CLAIM = re.compile(
    r"\b(?:production[- ]ready|marketplace[- ]ready|"
    r"(?<!pre-)stable\s+(?:plugin\s+)?(?:API|ABI|LSP)|"
    r"(?<!pre-)stable\s+diagnostics\s+envelope|"
    r"MCP\s+ready|provider/runtime\s+ready|"
    r"KV260\s+inference\s+(?:works|works\s+now|is\s+working|is\s+functional)|"
    r"Gemma\s+3N\s+E4B\s+runs\s+on\s+KV260|"
    r"20\s*tok/s\s+achieved|timing[- ]closed|"
    r"timing\s+closure\s+(?:achieved|closed|complete|met)|"
    r"stable\s+release|"
    r"unreviewed\s+automation\s+product|unreviewed\s+coding|"
    r"external\s+(?:tool|runtime)\s+directly\s+controls|"
    r"complete\s+provider\s+integration|fully\s+(?:validated|verified)|"
    r"CI-covered|approved\s+runner\s+proves|"
    r"(?:launcher/lab|launcher|lab)\s+execution\s+island)\b",
    re.IGNORECASE,
)
NEGATION = re.compile(
    r"\b(?:no|not|never|without|does not|is not|are not|avoid|do not|"
    r"forbidden|unsupported)\b",
    re.IGNORECASE,
)


def public_wording_files() -> list[Path]:
    roots = [
        README,
        HANDOFF,
        REPO_ROOT / "docs",
        REPO_ROOT / "editors" / "vscode-prototype" / "README.md",
        REPO_ROOT / "editors" / "vscode-prototype" / "docs",
    ]
    files = []
    for root in roots:
        if root.is_file():
            files.append(root)
        else:
            files.extend(root.glob("*.md"))
    return sorted(set(files))


def test_source_header_policy_guard_passes():
    result = subprocess.run(
        [sys.executable, "scripts/check-source-headers.py"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "source header policy ok" in result.stdout


def test_direction_style_doc_pins_current_role_and_boundaries():
    text = DIRECTION_DOC.read_text(encoding="utf-8")

    required_phrases = [
        "data-boundary-first editor cockpit",
        "pccx-lab spin-out",
        "must not become a launcher/lab execution island",
        "CLI/core/data boundary first",
        "No launcher execution.",
        "No pccx-lab execution from this repository.",
        "No pccx-lab diagnostics handoff validator invocation.",
        "No KV260 runtime integration.",
        "No production-ready claim.",
        "No stable API/ABI claim.",
        "No marketplace-ready claim.",
        "No KV260 inference works claim.",
        "No Gemma 3N E4B on KV260 claim.",
        "No 20 tok/s achieved claim.",
        "No timing closure claim.",
        "target-first design",
        "deep modules with simple external contracts",
        "evidence over optimism",
        "readable code for ordinary engineers",
        "validation-driven changes",
        "no shallow module churn",
        "no broad rewrite without tests",
        "preserve physical/verification/runtime evidence boundaries",
        "do not hide architecture risk behind polished UI",
        "input logic IN_*",
        "output logic OUT_*",
        "// ===| Section |===",
        "do not mass-rename signals",
        "do not introduce software-style OOP patterns into synthesizable RTL examples",
        "deterministic JSON output style",
        "bounded output patterns",
        "no-shell/no-runtime/no-provider boundary checks",
    ]

    for phrase in required_phrases:
        assert phrase in text


def test_existing_docs_link_direction_style_policy():
    for path in [README, HANDOFF]:
        text = path.read_text(encoding="utf-8")
        assert "PROJECT_DIRECTION_AND_STYLE.md" in text


def test_public_wording_avoids_unsupported_readiness_claims():
    violations = []
    for path in public_wording_files():
        lines = path.read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines):
            context = " ".join(
                lines[i]
                for i in range(max(0, index - 2), min(len(lines), index + 2))
            )
            if POSITIVE_CLAIM.search(line) and not NEGATION.search(context):
                violations.append(f"{path.relative_to(REPO_ROOT)}:{index + 1}: {line}")

    assert violations == []

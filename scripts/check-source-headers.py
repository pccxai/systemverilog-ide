# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 pccxai

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BASELINE_PATH = REPO_ROOT / "scripts" / "source-header-legacy-baseline.json"

CODE_EXTENSIONS = {
    ".cjs",
    ".js",
    ".mjs",
    ".py",
    ".sh",
    ".sv",
    ".v",
}

HASH_COMMENT_EXTENSIONS = {".py", ".sh"}
SLASH_COMMENT_EXTENSIONS = {".cjs", ".js", ".mjs", ".sv", ".v"}


def run_git_ls_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", *[f"*{ext}" for ext in sorted(CODE_EXTENSIONS)]],
        cwd=REPO_ROOT,
        capture_output=True,
        check=True,
    )
    return [
        REPO_ROOT / item.decode("utf-8")
        for item in result.stdout.split(b"\0")
        if item
    ]


def comment_prefix(path: Path) -> str:
    if path.suffix in HASH_COMMENT_EXTENSIONS:
        return "#"
    if path.suffix in SLASH_COMMENT_EXTENSIONS:
        return "//"
    raise ValueError(f"unsupported code extension: {path}")


def has_required_header(path: Path, text: str) -> bool:
    lines = text.splitlines()
    offset = 1 if lines and lines[0].startswith("#!") else 0
    prefix = comment_prefix(path)
    expected = [
        f"{prefix} SPDX-License-Identifier: Apache-2.0",
        f"{prefix} Copyright 2026 pccxai",
    ]
    return lines[offset:offset + 2] == expected


def load_baseline() -> dict[str, str]:
    return json.loads(BASELINE_PATH.read_text(encoding="utf-8"))


def main() -> int:
    baseline = load_baseline()
    tracked_code_files = run_git_ls_files()
    tracked_relpaths = {
        str(path.relative_to(REPO_ROOT))
        for path in tracked_code_files
    }
    violations = []
    stale_baseline_entries = []

    for relpath in sorted(set(baseline) - tracked_relpaths):
        stale_baseline_entries.append(f"{relpath}: baseline entry is not tracked")

    for path in tracked_code_files:
        relpath = str(path.relative_to(REPO_ROOT))
        data = path.read_bytes()
        text = data.decode("utf-8")
        if has_required_header(path, text):
            if relpath in baseline:
                stale_baseline_entries.append(
                    f"{relpath}: remove baseline entry after adding header",
                )
            continue

        digest = hashlib.sha256(data).hexdigest()
        if relpath not in baseline:
            violations.append(f"{relpath}: missing required source header")
        elif baseline[relpath] != digest:
            violations.append(
                f"{relpath}: changed legacy source still needs required header",
            )

    if stale_baseline_entries:
        print("Stale source-header baseline entries:")
        for item in stale_baseline_entries:
            print(f"  {item}")

    if violations:
        print("Source header policy violations:")
        for item in violations:
            print(f"  {item}")
        return 1

    if stale_baseline_entries:
        return 1

    print("source header policy ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

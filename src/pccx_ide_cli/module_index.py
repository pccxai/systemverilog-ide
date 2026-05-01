from __future__ import annotations

import re
from pathlib import Path
from typing import Any

# Matches `module <name>` at the start of a line (optional leading whitespace).
# Conservative: handles  module foo;  /  module foo #(  /  module foo (
# Column convention: 1-based character offset of the `module` keyword.
# Limitation: column reflects the visible text after block-comment removal;
# if /* */ spans precede `module` on the same line the column is scanner-based,
# not byte-offset in the original source.
_MODULE_LINE_RE = re.compile(r"^(\s*)module\s+(\w+)")

_IGNORE_DIRS: frozenset[str] = frozenset({".git", "__pycache__", "build", "dist", "target"})
_SV_SUFFIXES: frozenset[str] = frozenset({".sv", ".v"})


def _strip_block_comments(line: str, in_comment: bool) -> tuple[str, bool]:
    """Remove /* ... */ spans from one line, tracking multi-line comment state.

    Returns (visible_text, new_in_comment).  Non-nested only; nested /* are
    treated as the same comment level (documented limitation).
    """
    out: list[str] = []
    i = 0
    n = len(line)
    while i < n:
        if in_comment:
            end = line.find("*/", i)
            if end == -1:
                return "".join(out), True
            i = end + 2
            in_comment = False
        else:
            start = line.find("/*", i)
            if start == -1:
                out.append(line[i:])
                break
            out.append(line[i:start])
            in_comment = True
            i = start + 2
    return "".join(out), in_comment


def _scan_text(text: str, source: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    in_block_comment = False
    for line_num, line in enumerate(text.splitlines(), 1):
        visible, in_block_comment = _strip_block_comments(line, in_block_comment)
        if visible.lstrip().startswith("//"):
            continue
        m = _MODULE_LINE_RE.match(visible)
        if m:
            results.append({
                "name": m.group(2),
                "file": source,
                "line": line_num,
                "column": len(m.group(1)) + 1,
            })
    return results


def scan_file(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return _scan_text(text, str(path))


def scan_path(path: Path) -> list[dict[str, Any]]:
    """Return module records for a single file or a directory tree.

    Directory scan skips _IGNORE_DIRS and collects .sv and .v files only.
    Output is sorted by (file, line, name) for determinism.
    """
    if path.is_file():
        return scan_file(path)

    sv_files = sorted(
        f
        for suffix in _SV_SUFFIXES
        for f in path.rglob(f"*{suffix}")
        if not any(part in _IGNORE_DIRS for part in f.parts)
    )
    modules: list[dict[str, Any]] = []
    for f in sv_files:
        modules.extend(scan_file(f))

    modules.sort(key=lambda m: (m["file"], m["line"], m["name"]))
    return modules


def build_index(source: str, modules: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "kind": "module-index",
        "modules": modules,
        "source": source,
        "tool": "pccx-ide-scaffold",
    }


def filter_modules(
    entries: list[dict[str, Any]], query: str
) -> list[dict[str, Any]]:
    """Return entries whose 'name' exactly matches query (case-sensitive)."""
    return [e for e in entries if e["name"] == query]


def locate_module(path: Path, name: str) -> list[dict[str, Any]]:
    """Scan path for exact case-sensitive module name matches.

    Returns a list of locate-shaped records:
      {"module": <name>, "file": <path>, "line": N, "column": C}

    Column is the same 1-based character offset as the index command.
    Sorted deterministically by (file, line).
    """
    raw = scan_path(path)
    matches = [
        {
            "module": m["name"],
            "file": m["file"],
            "line": m["line"],
            "column": m["column"],
        }
        for m in raw
        if m["name"] == name
    ]
    matches.sort(key=lambda m: (m["file"], m["line"]))
    return matches

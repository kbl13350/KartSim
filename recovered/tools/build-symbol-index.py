#!/usr/bin/env python3
"""Build a line-number index for top-level declarations in readable bundles."""

import csv
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
DECLARATION = re.compile(
    r"^(?:(?:async )?function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)\b"
)


def declarations(path):
    entries = []
    for line_number, line in enumerate(path.open(encoding="utf-8"), 1):
        match = DECLARATION.match(line)
        if match:
            keyword = line.split(None, 1)[0]
            entries.append((match.group(1), keyword, line_number))
    return entries


formatted = declarations(ROOT / "formatted" / "index.js")
heuristic = declarations(ROOT / "wakaru-fixed" / "index-DoW2rQpI.js")
heuristic_lines = {}
for name, _, line in heuristic:
    heuristic_lines.setdefault(name, []).append(line)

destination = ROOT / "analysis" / "symbols.tsv"
destination.parent.mkdir(parents=True, exist_ok=True)
with destination.open("w", encoding="utf-8", newline="") as handle:
    writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
    writer.writerow(["name", "kind", "formatted_line", "heuristic_line"])
    for name, kind, line in formatted:
        other = heuristic_lines.get(name, [])
        writer.writerow([name, kind, line, other[0] if len(other) == 1 else ""])

print(f"Indexed {len(formatted)} formatted top-level declarations; {len(heuristic)} heuristic declarations.")

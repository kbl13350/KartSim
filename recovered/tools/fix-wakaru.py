#!/usr/bin/env python3
"""Repair one Wakaru class-conversion error verified against the original bundle."""

from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
bundle = (ROOT.parent / "mirror/assets/index-DoW2rQpI.js").read_bytes()
expected_hash = "d753ab83d0007826b7275a7b4e4288d7b0f2a60662e967eac374ec3a1e0fb354"
if sha256(bundle).hexdigest() != expected_hash:
    raise SystemExit("The original bundle changed; inspect the fix before applying it")
if b"w.ArrayBuffer=function(){this.reset()},w.ArrayBuffer.prototype.append" not in bundle:
    raise SystemExit("Original constructor evidence is missing")

source = (ROOT / "wakaru/index-DoW2rQpI.js").read_text()
old = """                    static ArrayBuffer() {
                        this.reset();
                    }
                }
                w.ArrayBuffer.prototype.append"""
new = """                }
                w.ArrayBuffer = function() {
                    this.reset();
                };
                w.ArrayBuffer.prototype.append"""
if source.count(old) != 1:
    raise SystemExit("Expected exactly one Wakaru constructor error")

destination = ROOT / "wakaru-fixed/index-DoW2rQpI.js"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(source.replace(old, new))
print(destination)

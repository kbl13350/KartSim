// Deterministic JSON for the embedded economy data.
//
// version = SHA-256 (hex) of the canonical form of the document without its
// "version" field: no whitespace, strings as JSON.stringify writes them,
// integers only, and object keys in JavaScript property order after sorting:
// integer-like keys ("3", "115") ascending numerically, then the other keys
// by UTF-16 code units. server-go's economy tests recompute the same hash to
// catch hand edits.
import { createHash } from "node:crypto";

export function canonicalize(value, path = "$") {
  if (Array.isArray(value)) return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) continue;
      result[key] = canonicalize(value[key], `${path}.${key}`);
    }
    return result;
  }
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error(`${path}: only safe integers are allowed in economy JSON, got ${value}`);
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  throw new Error(`${path}: unsupported JSON value ${typeof value}`);
}

export function contentVersion(document) {
  const { version: _ignored, ...content } = document;
  return createHash("sha256").update(JSON.stringify(canonicalize(content)), "utf8").digest("hex");
}

/** Stamp the version, then lay out one top-level key (or array element) per line. */
export function formatDocument(document) {
  const stamped = canonicalize({ ...document, version: contentVersion(document) });
  const lines = Object.entries(stamped).map(([key, value]) => {
    const name = JSON.stringify(key);
    if (Array.isArray(value) && value.length > 0)
      return `  ${name}: [\n${value.map(item => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`;
    return `  ${name}: ${JSON.stringify(value)}`;
  });
  return { text: `{\n${lines.join(",\n")}\n}\n`, version: stamped.version };
}

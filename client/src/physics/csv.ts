import { BYTE_FIELDS, CSV_COLUMNS, INTEGER_FIELDS, KART_FIELDS, WORD_FIELDS,
  type KartField } from "./fields";

export interface KartSpecRow {
  source: string;
  values: Partial<Record<KartField, number>>;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let index = 0;
  while (index <= line.length) {
    let value = "";
    if (line[index] === '"') {
      index++;
      let closed = false;
      while (index < line.length) {
        const char = line[index++];
        if (char === '"') {
          if (line[index] === '"') { value += '"'; index++; }
          else { closed = true; break; }
        } else value += char;
      }
      if (!closed || (index < line.length && line[index] !== ",")) {
        throw new Error("Malformed kartspec.csv quoted field");
      }
    } else {
      while (index < line.length && line[index] !== ",") {
        if (line[index] === '"') throw new Error("Unexpected quote in kartspec.csv field");
        value += line[index++];
      }
    }
    fields.push(value);
    if (index === line.length) break;
    index++; // comma
    if (index === line.length) { fields.push(""); break; }
  }
  return fields;
}

function finiteNumber(raw: string, label: string): number {
  const value = Number(raw);
  if (!raw.trim() || !Number.isFinite(value)) {
    throw new Error(`kartspec.csv ${label}=${raw} must be finite`);
  }
  return value;
}

function integer(raw: string, label: string, min: number, max: number): number {
  const value = finiteNumber(raw, label);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`kartspec.csv ${label}=${raw} must be an integer in ${min}..${max}`);
  }
  return value;
}

export function vehicleId(raw: string): number {
  return integer(raw, "id", 1, Number.MAX_SAFE_INTEGER);
}

export function speedType(raw: number): string {
  if (!Number.isInteger(raw) || raw < 0 || raw > 255) {
    throw new Error(`Speed type ${raw} must be an integer in 0..255`);
  }
  return String(raw);
}

function parseField(field: KartField, raw: string, rowNumber: number): number {
  const label = `row ${rowNumber} ${field}`;
  if (BYTE_FIELDS.has(field)) return integer(raw, label, 0, 255);
  if (WORD_FIELDS.has(field)) return integer(raw, label, 0, 65_535);
  if (INTEGER_FIELDS.has(field)) return integer(raw, label, -2_147_483_648, 2_147_483_647);
  const value = Math.fround(finiteNumber(raw, label));
  if (!Number.isFinite(value)) throw new Error(`kartspec.csv ${label} exceeds f32 range`);
  return value;
}

/** Parse the captured CSV with the same numeric types and table constraints as `qw`. */
export function parseKartSpecCsv(csv: string): Map<string, KartSpecRow> {
  const lines = csv.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  const columns = parseCsvLine(lines[0] ?? "");
  if (columns.length !== CSV_COLUMNS.length ||
      columns.some((column, index) => column !== CSV_COLUMNS[index])) {
    throw new Error("kartspec.csv columns are missing or out of order");
  }
  const rows = new Map<string, KartSpecRow>();
  for (const [index, line] of lines.slice(1).entries()) {
    const rowNumber = index + 2;
    const cells = parseCsvLine(line);
    if (cells.length !== CSV_COLUMNS.length) throw new Error(`kartspec.csv row ${rowNumber} has ${cells.length} columns`);
    const speed = integer(cells[1] ?? "", `row ${rowNumber} speedType`, 0, 255);
    if (speed !== 4 && speed !== 7) throw new Error("kartspec.csv supports only speed types 4 and 7");
    const key = `${vehicleId(cells[0] ?? "")}:${speed}`;
    if (rows.has(key)) throw new Error(`Duplicate vehicle and speed ${key}`);
    const source = cells[2] ?? "";
    if (!source.trim()) throw new Error(`kartspec.csv row ${rowNumber} has no source`);
    const values: Partial<Record<KartField, number>> = {};
    KART_FIELDS.forEach((field, fieldIndex) => {
      const raw = cells[fieldIndex + 3] ?? "";
      if (raw.trim()) values[field] = parseField(field, raw, rowNumber);
    });
    rows.set(key, { source, values });
  }
  return rows;
}

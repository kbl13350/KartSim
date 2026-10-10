// Client-side checks of list filters the server validates strictly, so a
// bad value gets a clear message instead of a 400 INVALID_QUERY.

/** Printable ASCII without spaces, 1–max characters (the server's tokenParam). */
export function isAsciiToken(value: string, max: number): boolean {
  return value.length >= 1 && value.length <= max && /^[\x21-\x7e]+$/.test(value)
}

/** A non-negative integer of at most `digits` digits. */
export function isDigits(value: string, digits: number): boolean {
  return new RegExp(`^\\d{1,${digits}}$`).test(value)
}

/** A positive integer of at most `digits` digits. */
export function isPositiveInteger(value: string, digits: number): boolean {
  return new RegExp(`^[1-9]\\d{0,${digits - 1}}$`).test(value)
}

// Beijing time helpers. Every time in the console is shown and entered as
// Beijing wall-clock time ("YYYY-MM-DD HH:mm:ss"), whatever the browser's
// time zone; the API speaks millisecond timestamps.

const beijing = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function beijingParts(ms: number): WallClock {
  const parts: Record<string, string> = {}
  for (const part of beijing.formatToParts(new Date(ms))) parts[part.type] = part.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0')

/** "YYYY-MM-DD HH:mm:ss" in Beijing time. */
export function toBeijingString(ms: number): string {
  const p = beijingParts(ms)
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
}

/** A Beijing time for display: "—" for missing values and 0. */
export function formatTime(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '—'
  return toBeijingString(ms)
}

/** The timestamp of a Beijing wall-clock string "YYYY-MM-DD HH:mm:ss" (NaN if malformed). */
export function parseBeijing(text: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim())
  if (!match) return Number.NaN
  const [, y, mo, d, h, mi, s] = match
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h) - 8, Number(mi), Number(s ?? 0))
}

/** Midnight (Beijing) of the day containing ms. */
export function beijingDayStart(ms: number): number {
  const p = beijingParts(ms)
  return Date.UTC(p.year, p.month - 1, p.day, -8, 0, 0)
}

/**
 * A Date whose local wall clock reads like the Beijing wall clock of ms. Date
 * pickers work in local time, so their shortcuts use this to land on the same
 * "YYYY-MM-DD HH:mm:ss" string the console treats as Beijing time.
 */
export function beijingWallDate(ms: number): Date {
  const p = beijingParts(ms)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/** The far-future ban used for "永久" (2100-01-01 00:00:00 Beijing). */
export const PERMANENT_BAN = Date.UTC(2100, 0, 1, -8, 0, 0)

/** True for bans that run to 2099 or later (shown as 永久). */
export function isPermanent(ms: number | null | undefined): boolean {
  return !!ms && ms >= Date.UTC(2099, 0, 1)
}

/** "3天 4小时" / "5小时 12分" / "12分 3秒" for a duration in ms. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—'
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (days > 0) return `${days}天 ${hours}小时`
  if (hours > 0) return `${hours}小时 ${minutes}分`
  if (minutes > 0) return `${minutes}分 ${rest}秒`
  return `${rest}秒`
}

/** "12秒前" / "3分钟前" relative to the server's now. */
export function formatAgo(now: number, at: number | null | undefined): string {
  if (!at) return '—'
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 60) return `${seconds}秒前`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  return `${Math.floor(seconds / 86400)}天前`
}

/** A race time "1:23.456" from milliseconds. */
export function formatElapsed(ms: number | null | undefined): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '—'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${pad(seconds)}.${pad(Math.floor(ms % 1000), 3)}`
}

/** Date-picker shortcuts in Beijing time: today, the last 7 and 30 days. */
export function rangeShortcuts() {
  const day = 86400000
  const today = () => [beijingWallDate(beijingDayStart(Date.now())), beijingWallDate(Date.now())]
  const last = (days: number) => () => [beijingWallDate(beijingDayStart(Date.now()) - (days - 1) * day),
    beijingWallDate(Date.now())]
  return [
    { text: '今天', value: today },
    { text: '最近 7 天', value: last(7) },
    { text: '最近 30 天', value: last(30) },
  ]
}

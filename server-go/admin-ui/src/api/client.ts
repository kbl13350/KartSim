import { formatTime, isPermanent } from '../utils/time'

// The admin API client. The session token lives only in this module (no
// localStorage, sessionStorage or cookies), like the old console: reloading
// the page signs the admin out.

let token: string | null = null
let unauthorized: ((message: string) => void) | null = null

export function setToken(value: string | null): void {
  token = value
}

export function hasToken(): boolean {
  return token !== null
}

/**
 * Registers what happens when an API call answers 401, or 403
 * ADMIN_REQUIRED (the admin flag was taken away): back to login.
 */
export function onUnauthorized(handler: (message: string) => void): void {
  unauthorized = handler
}

const messages: Record<string, string> = {
  NETWORK: '无法连接数据服务',
  INVALID_CREDENTIALS: '用户名或密码错误',
  TOO_MANY_ATTEMPTS: '尝试次数过多，请稍后再试',
  LOGIN_REQUIRED: '登录已失效，请重新登录',
  SESSION_REPLACED: '该账号已在其他地方登录，请重新登录',
  ADMIN_REQUIRED: '该账号不是管理员',
  ACCOUNT_BANNED: '该账号已被封禁',
  ACCOUNT_NOT_FOUND: '账号不存在',
  INVALID_ACCOUNT_ID: '账号编号无效',
  INVALID_GRANT: '类型或数量无效（数量不能为 0，绝对值不超过 10 亿）',
  INVALID_NOTE: '请填写备注（最多 200 字）',
  INVALID_QUERY: '查询条件无效（关键字最多 64 字，排序或筛选字段不受支持）',
  INSUFFICIENT_FUNDS: '余额不足，扣除后不能为负数',
  INSUFFICIENT_EXP: '经验不足，扣除后不能为负数',
  BALANCE_LIMIT: '余额超出上限',
  REQUEST_ID_CONFLICT: '该请求编号已用于另一笔发放，请重新提交',
  INVALID_REQUEST_ID: '请求编号无效，请重新提交',
  SERVER_BUSY: '服务器繁忙，请稍后再试',
  DATA_SERVICE_UNAVAILABLE: '数据服务暂时不可用',
  INTERNAL_ERROR: '服务器内部错误',
  INVALID_ACTIVITY: '活动无效',
  INVALID_REQUEST: '设置无效（结束时间须晚于开始时间，每日道具须为已知道具，数量 1–1000，最多 8 种）',
  INVALID_GIFT: '赠送无效（道具须为已知道具，数量 1–1000000，天数 0–3650，说明最多 60 字）',
  INVALID_NOTICE: '公告无效（标题 1–40 字，内容 1–400 字，结束时间须晚于开始时间）',
  INVALID_NOTICE_ID: '公告编号无效',
  NOTICE_NOT_FOUND: '公告不存在或已删除',
  NICKNAME_TAKEN: '该昵称已被使用',
  INVALID_NICKNAME: '昵称无效（1–16 字，首尾不能是空格，不能包含 < > 和控制字符）',
  INVALID_ACCOUNT_FIELD: '账号信息无效（昵称 1–16 字，密码 8–128 位，封禁原因最多 200 字且不能包含换行或控制字符）',
  INVALID_ACCOUNT_FIELDS: '账号信息无效（昵称 1–16 字，密码 8–128 位，封禁原因最多 200 字且不能包含换行或控制字符）',
  CANNOT_MODIFY_SELF: '不能对自己执行该操作（撤销管理员、封禁或踢下线）',
  PROTECTED_ADMIN: '该账号是 KART_ADMIN_USERNAMES 指定的超级管理员，只能由本人修改',
  CLUB_NOT_FOUND: '俱乐部不存在',
  REQUEST_TOO_LARGE: '请求内容过大',
  NOT_FOUND: '接口不存在（数据服务版本可能过旧）',
  METHOD_NOT_ALLOWED: '接口不支持该请求方法',
  HTTP_401: '登录已失效，请重新登录',
  HTTP_403: '没有权限',
  HTTP_404: '接口不存在（数据服务版本可能过旧）',
  HTTP_502: '数据服务暂时不可用',
  HTTP_503: '数据服务暂时不可用',
  HTTP_504: '数据服务响应超时',
}

/** The Chinese message of an error code. */
export function describe(code: string): string {
  return messages[code] ?? `请求失败（${code}）`
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly data: Record<string, unknown> | null

  constructor(code: string, status: number, data: Record<string, unknown> | null, message = describe(code)) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.data = data
  }
}

/** The message to show for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

/** ?a=1&b=x from the set values; false, null, undefined and '' are left out, true is 1. */
export function buildQuery(query?: Query): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === false || value === '') continue
    params.set(key, value === true ? '1' : String(value))
  }
  const text = params.toString()
  return text ? '?' + text : ''
}

export interface CallOptions {
  /**
   * false: a 401 or 403 ADMIN_REQUIRED is an ordinary error and does not
   * sign the admin out (the login itself).
   */
  auth?: boolean
}

/** Ends a session the console gives up on; failures do not matter. */
function dropSession(stale: string): void {
  void fetch('/multiplayer/auth/logout', {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + stale },
    cache: 'no-store',
    credentials: 'omit',
  }).catch(() => {})
}

function bannedMessage(data: Record<string, unknown> | null): string {
  let text = describe('ACCOUNT_BANNED')
  const until = typeof data?.until === 'number' ? data.until : 0
  const reason = typeof data?.reason === 'string' ? data.reason : ''
  const details: string[] = []
  // A ban to 2099 or later is 永久, as in the account list and the game client.
  if (until) details.push(isPermanent(until) ? '永久' : '至 ' + formatTime(until))
  if (reason) details.push('原因：' + reason)
  if (details.length) text += '（' + details.join('，') + '）'
  return text
}

export async function call<T>(method: string, path: string, body?: unknown, options: CallOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
    })
  } catch {
    throw new ApiError('NETWORK', 0, null)
  }
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  if (!response.ok) {
    const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
    const code = typeof record?.error === 'string' ? record.error : 'HTTP_' + response.status
    const error = code === 'ACCOUNT_BANNED'
      ? new ApiError(code, response.status, record, bannedMessage(record))
      : new ApiError(code, response.status, record)
    // A 401 means the session is gone; a 403 ADMIN_REQUIRED means another
    // admin took this account's admin flag mid-session. Either way the
    // console goes back to login (the 403's session is still live, so it
    // is ended too).
    const revoked = response.status === 403 && code === 'ADMIN_REQUIRED'
    if ((response.status === 401 || revoked) && options.auth !== false && token) {
      if (revoked) dropSession(token)
      token = null
      unauthorized?.(error.message)
    }
    throw error
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => call<T>('GET', path + buildQuery(query)),
  post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => call<T>('PATCH', path, body),
  del: <T>(path: string) => call<T>('DELETE', path),
}

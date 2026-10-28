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
  TRANSLATION_KEY_REQUIRED: '请先填写并保存 DeepSeek API Key',
  TRANSLATION_UNAVAILABLE: '翻译服务不可用，请检查密钥、账户余额和模型，或稍后重试',
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
  INVALID_ECONOMY_SETTINGS: '数额无效（每项 0–1,000,000,000 的整数）',
  INVALID_REQUEST: '设置无效（结束时间须晚于开始时间，每日道具须为已知道具，数量 1–1000，最多 8 种）',
  INVALID_GIFT: '赠送无效（道具须为已知道具，数量 1–1000000，天数 0–3650，说明最多 60 字）',
  INVALID_NOTICE: '公告无效（标题 1–40 字，内容 1–400 字，结束时间须晚于开始时间）',
  INVALID_NOTICE_ID: '公告编号无效',
  INVALID_FEATURED: '联赛回放无效（标题 1–60 字，说明最多 200 字）',
  FEATURED_NOT_FOUND: '该联赛回放不存在或已删除',
  REPLAY_NOT_FOUND: '该排位录像不存在（可能已掉出前 10 名）',
  INVALID_TRACK: '赛道无效',
  NOTICE_NOT_FOUND: '公告不存在或已删除',
  NICKNAME_TAKEN: '该昵称已被使用',
  INVALID_NICKNAME: '昵称无效（1–16 字，首尾不能是空格，不能包含 < > 和控制字符）',
  INVALID_ACCOUNT_FIELD: '账号信息无效（昵称 1–16 字，密码 8–128 位，封禁原因最多 200 字且不能包含换行或控制字符）',
  INVALID_ACCOUNT_FIELDS: '账号信息无效（昵称 1–16 字，密码 8–128 位，封禁原因最多 200 字且不能包含换行或控制字符）',
  CANNOT_MODIFY_SELF: '不能对自己执行该操作（撤销管理员、封禁或踢下线）',
  PROTECTED_ADMIN: '该账号是 KART_ADMIN_USERNAMES 指定的超级管理员，只能由本人修改',
  CLUB_NOT_FOUND: '俱乐部不存在',
  REQUEST_TOO_LARGE: '请求内容过大',
  INVALID_NODE: '节点信息无效（名称 1–32 字；节点 ID 只能用字母、数字、- 和 _；对外地址须为 http(s)://主机[:端口]；备注最多 200 字）',
  NODE_EXISTS: '该节点 ID 已存在',
  INVALID_CITY_SERVER: '卡丁城服务器无效（请选择一个节点，或选自动）',
  NODE_NOT_FOUND: '节点不存在或已删除',
  MAP_NOT_FOUND: '地图不存在或已删除',
  INVALID_LOBBY_PROMOS: '宣传设置无效（轮播图最多 8 张且每张都要有图片，间隔 2–60 秒，链接须为 http(s):// 网址或以 / 开头的路径，标题最多 40 字）',
  INVALID_PROMO_IMAGE: '图片无效（只支持 PNG、JPEG、GIF、WebP，每边最多 4096 像素）',
  PROMO_IMAGE_TOO_LARGE: '图片过大（最大 4 MB）',
  PROMO_IMAGE_NOT_FOUND: '图片不存在或已被清理，请重新上传',
  PROMO_IMAGE_LIMIT: '图片库已满（100 张），请稍后再试',
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
  if (!response.ok) throw failure(response, data, options)
  return data as T
}

/** The error of a failed response whose body (JSON or null) is data. */
function failure(response: Response, data: unknown, options: CallOptions): ApiError {
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
  return error
}

/**
 * A picture the API serves only to an admin session (a map's card), as a
 * data: URL: an <img> cannot send the Authorization header, and the page's
 * CSP allows data: images but not blob: ones. The browser may cache the
 * answer (the server marks it private).
 */
export async function fetchPicture(path: string): Promise<string> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = 'Bearer ' + token
  let response: Response
  try {
    response = await fetch(path, { headers, credentials: 'omit' })
  } catch {
    throw new ApiError('NETWORK', 0, null)
  }
  if (!response.ok) {
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    throw failure(response, data, {})
  }
  let blob: Blob
  try {
    blob = await response.blob()
  } catch {
    throw new ApiError('NETWORK', 0, null)
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ApiError('NETWORK', 0, null))
    reader.readAsDataURL(blob)
  })
}

/**
 * POSTs a file as the request body (its own Content-Type) and reads the
 * JSON answer, like call.
 */
export async function upload<T>(path: string, file: Blob): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers['Authorization'] = 'Bearer ' + token
  headers['Content-Type'] = file.type || 'application/octet-stream'
  let response: Response
  try {
    response = await fetch(path, { method: 'POST', headers, body: file, cache: 'no-store', credentials: 'omit' })
  } catch {
    throw new ApiError('NETWORK', 0, null)
  }
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  if (!response.ok) throw failure(response, data, {})
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => call<T>('GET', path + buildQuery(query)),
  post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => call<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => call<T>('PATCH', path, body),
  del: <T>(path: string) => call<T>('DELETE', path),
}

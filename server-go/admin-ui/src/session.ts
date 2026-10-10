import { reactive } from 'vue'
import { ApiError, call, describe, onUnauthorized, setToken } from './api/client'
import type { AdminMe, LoginResult } from './api/types'

// The signed-in admin. The token itself stays in api/client.ts; this holds
// what the UI shows. Nothing is persisted: a reload means a new login.
export const session = reactive({
  admin: null as AdminMe | null,
  /** Why the console went back to the login screen (shown there once). */
  notice: '',
})

/** Whether an account id is the signed-in admin's own account. */
export function isSelf(accountId: string | null | undefined): boolean {
  return !!accountId && accountId === session.admin?.id
}

onUnauthorized((message) => {
  session.admin = null
  session.notice = message
})

async function endSession(): Promise<void> {
  await call('POST', '/multiplayer/auth/logout', undefined, { auth: false }).catch(() => {})
  setToken(null)
}

/**
 * Signs in like the old console ({username, password, console: true}: an
 * admin's console login keeps its game login), then asks /api/admin/me
 * whether the account may use the console.
 */
export async function login(username: string, password: string): Promise<void> {
  const result = await call<LoginResult>('POST', '/multiplayer/auth/login',
    { username, password, console: true }, { auth: false })
  setToken(result.token)
  try {
    const me = await call<AdminMe>('GET', '/api/admin/me', undefined, { auth: false })
    session.notice = ''
    session.admin = me
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setToken(null)
      throw error
    }
    await endSession()
    if (error instanceof ApiError && error.status === 403) throw new Error(describe('ADMIN_REQUIRED'))
    throw error
  }
}

export async function logout(): Promise<void> {
  await endSession()
  session.notice = ''
  session.admin = null
}

import { ElMessage } from 'element-plus'
import { api } from '../api/client'
import type { KickResult } from '../api/types'
import { accountLabel } from './format'
import { confirmAction, showError } from './ui'

/** Asks, then ends the account's sessions and disconnects it from its game node. */
export async function kickAccount(account: { id: string; username?: string | null; nickname?: string | null }): Promise<boolean> {
  const who = accountLabel(account.nickname, account.username)
  if (!await confirmAction(`确认将 ${who} 踢下线？该账号的所有会话将失效，并断开游戏连接。`, '踢下线',
    { danger: true, confirmText: '踢下线' })) {
    return false
  }
  try {
    const result = await api.post<KickResult>(`/api/admin/accounts/${encodeURIComponent(account.id)}/kick`)
    ElMessage.success(`已将 ${who} 踢下线：作废 ${result.sessions ?? 0} 个会话` +
      (result.game ? '，已通知游戏节点断开' : ''))
    return true
  } catch (error) {
    showError(error)
    return false
  }
}

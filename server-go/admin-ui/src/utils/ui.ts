import { ElMessage, ElMessageBox } from 'element-plus'
import { ApiError, errorMessage } from '../api/client'

/** An ElMessageBox confirmation; false when cancelled or closed. */
export async function confirmAction(message: string, title = '请确认',
  options: { type?: 'warning' | 'info' | 'error' | 'success'; confirmText?: string; danger?: boolean } = {}): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      type: options.type ?? 'warning',
      confirmButtonText: options.confirmText ?? '确定',
      cancelButtonText: '取消',
      confirmButtonClass: options.danger ? 'el-button--danger' : undefined,
      closeOnClickModal: false,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Shows an error as a message, except a 401: the console has already gone
 * back to the login screen, which explains it.
 */
export function showError(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) return
  ElMessage.error({ message: errorMessage(error), grouping: true, showClose: true })
}

/**
 * A version-4 UUID from crypto.getRandomValues, which also works on
 * plain-HTTP LAN pages (crypto.randomUUID needs a secure context).
 */
export function newRequestId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Copies text to the clipboard; false when the browser refuses (plain HTTP, permissions). */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

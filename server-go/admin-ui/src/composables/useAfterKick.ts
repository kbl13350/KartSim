import { onBeforeUnmount } from 'vue'

/**
 * How long after a kick the game node has surely dropped the player: nodes
 * heartbeat every 5 seconds, and until then the kicked account shows as
 * 断开中 (leaving).
 */
export const KICK_SETTLE_MS = 6000

/**
 * Returns a function to call after a kick: it reloads at once (the row turns
 * 断开中) and again once the node's next heartbeat has dropped the player.
 * A pending reload is cancelled when the view unmounts.
 */
export function useAfterKick(reload: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  onBeforeUnmount(() => clearTimeout(timer))
  return () => {
    reload()
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      reload()
    }, KICK_SETTLE_MS)
  }
}

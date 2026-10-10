import { computed, inject, onBeforeUnmount, onMounted, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'

// The console's tabs: which one is active (synced with location.hash) and
// what the header's 刷新 button does for each.

export interface TabDefinition {
  name: string
  label: string
}

export const TABS: TabDefinition[] = [
  { name: 'overview', label: '概览' },
  { name: 'users', label: '用户管理' },
  { name: 'logins', label: '登录记录' },
  { name: 'anti-cheat', label: '反作弊记录' },
  { name: 'online', label: '在线玩家' },
  { name: 'nodes', label: '服务器节点' },
  { name: 'ledger', label: '货币流水' },
  { name: 'grants', label: '发放记录' },
  { name: 'races', label: '比赛记录' },
  { name: 'purchases', label: '购买记录' },
  { name: 'draws', label: '抽奖与开箱' },
  { name: 'clubs', label: '俱乐部' },
  { name: 'lottery', label: '抽奖活动' },
  { name: 'reward-box', label: '奖励箱' },
  { name: 'notices', label: '公告' },
  { name: 'invites', label: '邀请码' },
]

interface TabContext {
  active: Ref<string>
  refreshers: Map<string, () => void>
}

const key: InjectionKey<TabContext> = Symbol('tabs')

function hashTab(): string {
  const name = decodeURIComponent(location.hash.replace(/^#/, ''))
  return TABS.some((tab) => tab.name === name) ? name : TABS[0]!.name
}

/** Provides the tab state to the console's views; call once in the layout. */
export function provideTabs() {
  const active = ref(hashTab())
  const refreshers = new Map<string, () => void>()
  provide(key, { active, refreshers })

  const onHash = () => {
    active.value = hashTab()
  }
  onMounted(() => window.addEventListener('hashchange', onHash))
  onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))

  function select(name: string) {
    active.value = name
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name)
  }

  function refresh() {
    refreshers.get(active.value)?.()
  }

  return { active, select, refresh }
}

/**
 * Registers a view as the tab `name`: the header's 刷新 calls refresh while
 * it is active, and `active` tells the view whether it is on screen (tabs
 * stay mounted once opened, so they keep their search state).
 */
export function useTab(name: string, refresh?: () => void): { active: ComputedRef<boolean> } {
  const context = inject(key, null)
  if (context && refresh) {
    context.refreshers.set(name, refresh)
    onBeforeUnmount(() => {
      if (context.refreshers.get(name) === refresh) context.refreshers.delete(name)
    })
  }
  return { active: computed(() => context?.active.value === name) }
}

<script setup lang="ts">
import { ref, type Component } from 'vue'
import { Refresh, SwitchButton, UserFilled } from '@element-plus/icons-vue'
import { provideTabs, TABS } from '../composables/useTabs'
import { logout, session } from '../session'
import ClubsTab from './ClubsTab.vue'
import DrawsTab from './DrawsTab.vue'
import GrantsTab from './GrantsTab.vue'
import InvitesTab from './InvitesTab.vue'
import LedgerTab from './LedgerTab.vue'
import LoginsTab from './LoginsTab.vue'
import LotteryTab from './LotteryTab.vue'
import NodesTab from './NodesTab.vue'
import NoticesTab from './NoticesTab.vue'
import OnlineTab from './OnlineTab.vue'
import OverviewTab from './OverviewTab.vue'
import PurchasesTab from './PurchasesTab.vue'
import RacesTab from './RacesTab.vue'
import RewardBoxTab from './RewardBoxTab.vue'
import UsersTab from './UsersTab.vue'

// The signed-in console: header bar and the tab menu. Tabs render the first
// time they are opened and then stay mounted, keeping their search state.

const views: Record<string, Component> = {
  overview: OverviewTab,
  users: UsersTab,
  logins: LoginsTab,
  online: OnlineTab,
  nodes: NodesTab,
  ledger: LedgerTab,
  grants: GrantsTab,
  races: RacesTab,
  purchases: PurchasesTab,
  draws: DrawsTab,
  clubs: ClubsTab,
  lottery: LotteryTab,
  'reward-box': RewardBoxTab,
  notices: NoticesTab,
  invites: InvitesTab,
}

const { active, select, refresh } = provideTabs()
const leaving = ref(false)

function onTabChange(name: string | number) {
  select(String(name))
}

async function signOut() {
  leaving.value = true
  try {
    await logout()
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <div class="console">
    <header class="topbar">
      <div class="brand">跑跑卡丁车 管理后台</div>
      <div class="who">
        <el-icon><UserFilled /></el-icon>
        <span class="who-name">{{ session.admin?.nickname }}（{{ session.admin?.username }}）</span>
        <el-button :icon="Refresh" @click="refresh">刷新</el-button>
        <el-button :icon="SwitchButton" :loading="leaving" @click="signOut">退出</el-button>
      </div>
    </header>
    <main class="content">
      <el-tabs :model-value="active" type="card" class="console-tabs" @update:model-value="onTabChange">
        <el-tab-pane v-for="tab in TABS" :key="tab.name" :label="tab.label" :name="tab.name" lazy>
          <component :is="views[tab.name]" />
        </el-tab-pane>
      </el-tabs>
    </main>
  </div>
</template>

<style scoped>
.console {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 10px 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: var(--el-box-shadow-lighter);
}
.brand {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
}
.who .el-button + .el-button {
  margin-left: 0;
}
.who-name {
  margin-right: 8px;
}
.content {
  flex: 1;
  padding: 16px 20px 24px;
  min-width: 0;
}
.console-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
  background: var(--el-bg-color);
}
/* Tighter tabs so all 15 fit on one row from about 1280px. */
.console-tabs :deep(.el-tabs__header .el-tabs__item) {
  padding: 0 13px !important;
}
@media (max-width: 640px) {
  .topbar {
    padding: 8px 12px;
  }
  .content {
    padding: 12px 12px 20px;
  }
  .who-name {
    display: none;
  }
}
</style>

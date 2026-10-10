<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AccountRow, AntiCheatRow } from '../api/types'
import AccountDrawer from '../components/AccountDrawer.vue'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import EditAccountDialog from '../components/EditAccountDialog.vue'
import GrantDialog from '../components/GrantDialog.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { useAfterKick } from '../composables/useAfterKick'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { kickAccount } from '../utils/accounts'
import { isAsciiToken } from '../utils/filters'
import {
  antiCheatAction, antiCheatActionOptions, antiCheatCheck, antiCheatCheckOptions, gameplayName, text,
} from '../utils/format'
import { formatTime } from '../utils/time'

// 反作弊记录: GET /api/admin/anti-cheat (q: 当时昵称/账号/昵称/详情, and the
// player, room and race IDs; code: the check; action kick|log; account;
// node (exact); from/to). An account opens its detail, where 编辑 can ban it.

const table = usePagedTable<AntiCheatRow, { code: string; action: string; account: string; node: string }>(
  '/api/admin/anti-cheat', {
    filters: { code: '', action: '', account: '', node: '' },
    validate: ({ node }) => (node && !isAsciiToken(node, 64) ? '节点 ID 无效（英文字符，不含空格）' : ''),
  })
useTab('anti-cheat', () => table.load())
onMounted(() => table.load())

const drawerOpen = ref(false)
const drawerId = ref<string | null>(null)
const drawer = ref<InstanceType<typeof AccountDrawer>>()
const editOpen = ref(false)
const editing = ref<AccountRow | null>(null)
const grantOpen = ref(false)
const grantTarget = ref<AccountRow | null>(null)

function showAccount(row: AntiCheatRow) {
  drawerId.value = row.accountId
  drawerOpen.value = true
}

function edit(account: AccountRow) {
  editing.value = account
  editOpen.value = true
}

function grant(account: AccountRow) {
  grantTarget.value = account
  grantOpen.value = true
}

function afterChange() {
  if (drawerOpen.value) drawer.value?.reload()
}

const afterKick = useAfterKick(afterChange)

async function kick(account: AccountRow) {
  if (await kickAccount(account)) afterKick()
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="昵称 / 账号 / 详情 / ID" range="时间">
      <el-form-item label="账号">
        <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" @clear="table.search()" />
      </el-form-item>
      <el-form-item label="检测项">
        <el-select v-model="table.filters.code" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option v-for="option in antiCheatCheckOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="处理">
        <el-select v-model="table.filters.action" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option v-for="option in antiCheatActionOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="节点">
        <el-input v-model="table.filters.node" maxlength="64" clearable placeholder="节点 ID" class="filter-input" @clear="table.search()" />
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="id">
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="检测项" width="140">
        <template #default="{ row }">
          <el-tooltip :content="row.code" placement="top" :show-after="300">
            <span>{{ antiCheatCheck(row.code) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="处理" width="90">
        <template #default="{ row }">
          <el-tag :type="antiCheatAction(row.action).type" disable-transitions>{{ antiCheatAction(row.action).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }">
          <el-link v-if="row.accountId" type="primary" underline="never" @click="showAccount(row)">
            <AccountName :nickname="row.nickname" :username="row.username" />
          </el-link>
          <span v-else class="muted">游客</span>
        </template>
      </el-table-column>
      <el-table-column label="当时昵称" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ text(row.name) }}</template>
      </el-table-column>
      <el-table-column label="详情" min-width="280" show-overflow-tooltip>
        <template #default="{ row }">{{ text(row.detail) }}</template>
      </el-table-column>
      <el-table-column label="赛道" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.trackName || text(row.trackId) }}
          <span v-if="row.trackName && row.trackId" class="muted mono">{{ row.trackId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="玩法" width="80">
        <template #default="{ row }"><el-tag type="info" disable-transitions>{{ gameplayName(row.gameplay) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="节点" min-width="110" show-overflow-tooltip>
        <template #default="{ row }"><span class="mono">{{ text(row.nodeId) }}</span></template>
      </el-table-column>
      <el-table-column label="比赛" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tooltip :content="`房间 ${row.roomId || '—'}；比赛 ${row.raceId || '—'}；玩家 ${row.playerId}`" placement="top" :show-after="300">
            <span class="mono">{{ text(row.raceId) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </DataTable>

    <AccountDrawer ref="drawer" v-model="drawerOpen" :account-id="drawerId" @edit="edit" @grant="grant" @kick="kick" />
    <EditAccountDialog v-model="editOpen" :account="editing" @saved="afterKick" />
    <GrantDialog v-model="grantOpen" :username="grantTarget?.username" :account="grantTarget" @done="afterChange" />
  </el-card>
</template>

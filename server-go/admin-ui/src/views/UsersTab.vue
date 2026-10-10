<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Coin } from '@element-plus/icons-vue'
import type { AccountRow } from '../api/types'
import AccountDrawer from '../components/AccountDrawer.vue'
import DataTable from '../components/DataTable.vue'
import EditAccountDialog from '../components/EditAccountDialog.vue'
import GrantDialog from '../components/GrantDialog.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useNarrow } from '../composables/useNarrow'
import { useTab } from '../composables/useTabs'
import { isSelf } from '../session'
import { kickAccount } from '../utils/accounts'
import { formatNumber, text } from '../utils/format'
import { formatTime, isPermanent } from '../utils/time'

// 用户管理: GET /api/admin/accounts (q: 账号/昵称/IP; online/banned/admin
// filters; sort createdAt/lastLoginAt/level/coupon/lucci/koin; from/to on
// the registration time).

const table = usePagedTable<AccountRow, { online: boolean; banned: boolean; admin: boolean }>(
  '/api/admin/accounts', { filters: { online: false, banned: false, admin: false } })
useTab('users', () => table.load())
const narrow = useNarrow()
onMounted(() => table.load())

const drawerOpen = ref(false)
const drawerId = ref<string | null>(null)
const drawer = ref<InstanceType<typeof AccountDrawer>>()

const editOpen = ref(false)
const editing = ref<AccountRow | null>(null)

const grantOpen = ref(false)
const grantTarget = ref<AccountRow | null>(null)

function showDetail(row: AccountRow) {
  drawerId.value = row.id
  drawerOpen.value = true
}

function edit(row: AccountRow) {
  editing.value = row
  editOpen.value = true
}

function grant(row: AccountRow | null) {
  grantTarget.value = row
  grantOpen.value = true
}

async function kick(row: AccountRow) {
  if (await kickAccount(row)) afterChange()
}

/** Refreshes the list and the open drawer after an edit, grant or kick. */
function afterChange() {
  void table.load({ silent: true })
  if (drawerOpen.value) drawer.value?.reload()
}

function banLabel(row: AccountRow) {
  return isPermanent(row.bannedUntil) ? '永久封禁' : `封禁至 ${formatTime(row.bannedUntil)}`
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="账号 / 昵称 / IP" range="注册时间">
      <el-form-item>
        <el-checkbox v-model="table.filters.online" border @change="table.search()">在线</el-checkbox>
        <el-checkbox v-model="table.filters.banned" border @change="table.search()">已封禁</el-checkbox>
        <el-checkbox v-model="table.filters.admin" border @change="table.search()">管理员</el-checkbox>
      </el-form-item>
      <template #actions>
        <el-button type="success" plain :icon="Coin" @click="grant(null)">按用户名发放/扣除</el-button>
      </template>
    </TableToolbar>
    <DataTable :table="table" row-key="id">
      <el-table-column prop="username" label="账号" min-width="130" :fixed="narrow ? false : 'left'" show-overflow-tooltip>
        <template #default="{ row }">
          <el-link type="primary" underline="never" @click="showDetail(row)">{{ row.username }}</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="nickname" label="昵称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="level" label="等级" width="80" align="right" sortable="custom">
        <template #default="{ row }">Lv.{{ row.level }}</template>
      </el-table-column>
      <el-table-column label="经验" width="110" align="right">
        <template #default="{ row }">{{ formatNumber(row.exp) }}</template>
      </el-table-column>
      <el-table-column prop="coupon" label="点券" width="110" align="right" sortable="custom">
        <template #default="{ row }">{{ formatNumber(row.coupon) }}</template>
      </el-table-column>
      <el-table-column prop="lucci" label="金币" width="120" align="right" sortable="custom">
        <template #default="{ row }">{{ formatNumber(row.lucci) }}</template>
      </el-table-column>
      <el-table-column prop="koin" label="K币" width="100" align="right" sortable="custom">
        <template #default="{ row }">{{ formatNumber(row.koin) }}</template>
      </el-table-column>
      <el-table-column label="物品数" width="80" align="right">
        <template #default="{ row }">{{ formatNumber(row.inventoryCount) }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="注册 IP" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ text(row.registerIp) }}</template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.lastLoginAt) }}</template>
      </el-table-column>
      <el-table-column label="最后登录 IP" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ text(row.lastLoginIp) }}</template>
      </el-table-column>
      <el-table-column label="在线" min-width="110">
        <template #default="{ row }">
          <el-tag v-if="row.online" type="success" disable-transitions>{{ row.online.nodeName || row.online.nodeId }}</el-tag>
          <span v-else class="muted">离线</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" min-width="150">
        <template #default="{ row }">
          <div class="tags">
            <el-tag v-if="row.admin" type="warning" disable-transitions>管理员</el-tag>
            <el-tooltip v-if="row.banned" :content="row.banReason ? `原因：${row.banReason}` : '未填写原因'" placement="top">
              <el-tag type="danger" disable-transitions>{{ banLabel(row) }}</el-tag>
            </el-tooltip>
            <el-tag v-if="!row.onboarded" type="info" disable-transitions>未领新手礼包</el-tag>
            <span v-if="!row.admin && !row.banned && row.onboarded" class="muted">正常</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" :fixed="narrow ? false : 'right'">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">详情</el-button>
          <el-button link type="primary" @click="edit(row)">编辑</el-button>
          <el-button link type="success" @click="grant(row)">赠送</el-button>
          <el-button link type="danger" :disabled="isSelf(row.id)" :title="isSelf(row.id) ? '不能把自己踢下线' : undefined" @click="kick(row)">踢下线</el-button>
        </template>
      </el-table-column>
    </DataTable>

    <AccountDrawer
      ref="drawer"
      v-model="drawerOpen"
      :account-id="drawerId"
      @edit="edit"
      @grant="grant"
      @kick="kick"
    />
    <EditAccountDialog v-model="editOpen" :account="editing" @saved="afterChange" />
    <GrantDialog v-model="grantOpen" :username="grantTarget?.username" :account="grantTarget" @done="afterChange" />
  </el-card>
</template>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>

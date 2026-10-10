<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Coin, Edit, Refresh, SwitchButton } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { AccountDetail, AccountRow, InventoryRow, LedgerRow } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { usePagedTable } from '../composables/usePagedTable'
import { isSelf } from '../session'
import { isDigits } from '../utils/filters'
import {
  clubGradeName, currencyOptions, formatNumber, gameplayName, loginKindName, reasonName, sourceName, text,
  userAgentSummary,
} from '../utils/format'
import { formatElapsed, formatTime, isPermanent } from '../utils/time'
import { showError } from '../utils/ui'
import CurrencyTag from './CurrencyTag.vue'
import DataTable from './DataTable.vue'
import SignedNumber from './SignedNumber.vue'
import TableToolbar from './TableToolbar.vue'

// 账号详情: GET /api/admin/accounts/{id} (account, club, sessions, the last
// 20 logins and races) plus the paged inventory and ledger of the account.

const props = defineProps<{ accountId: string | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  edit: [account: AccountRow]
  grant: [account: AccountRow]
  kick: [account: AccountRow]
}>()
const narrow = useNarrow(1000)

const detail = ref<AccountDetail | null>(null)
const loading = ref(false)
const failure = ref('')
const tab = ref('inventory')
const account = computed(() => detail.value?.account ?? null)

// Inventory: q matches the item name or id, category is a category number;
// sort updatedAt/createdAt/expiresAt/category/quantity.
const inventory = usePagedTable<InventoryRow, { category: string }>(
  () => `/api/admin/accounts/${encodeURIComponent(props.accountId ?? '')}/inventory`,
  {
    filters: { category: '' },
    validate: ({ category }) => (category && !isDigits(category, 6) ? '类别编号须为非负整数' : ''),
  })
const ledger = usePagedTable<LedgerRow, { currency: string }>('/api/admin/ledger', {
  filters: { currency: '' },
  fixed: () => ({ account: account.value?.username ?? '' }),
})
// Which account each lazily loaded inner list currently shows.
const shown = { inventory: '', ledger: '' }

async function reload() {
  const id = props.accountId
  if (!id) return
  loading.value = true
  failure.value = ''
  try {
    const result = await api.get<AccountDetail>(`/api/admin/accounts/${encodeURIComponent(id)}`)
    if (id !== props.accountId) return
    detail.value = result
  } catch (error) {
    if (id !== props.accountId) return
    failure.value = errorMessage(error)
    showError(error)
  } finally {
    loading.value = false
  }
}

function loadInner() {
  const id = props.accountId
  if (!id || !open.value) return
  if (tab.value === 'inventory' && shown.inventory !== id) {
    shown.inventory = id
    inventory.reset()
  } else if (tab.value === 'ledger' && shown.ledger !== id && account.value?.id === id) {
    shown.ledger = id
    ledger.reset()
  }
}

/** Reloads the account and whichever inner list is open. */
function refresh() {
  void reload().then(() => {
    if (tab.value === 'inventory') void inventory.load()
    else if (tab.value === 'ledger') void ledger.load()
  })
}

watch([open, () => props.accountId], ([isOpen, id], [, previous]) => {
  if (!isOpen || !id) return
  if (id !== previous || !detail.value || detail.value.account.id !== id) {
    detail.value = null
    tab.value = 'inventory'
    shown.inventory = ''
    shown.ledger = ''
    void reload().then(loadInner)
    return
  }
  void reload()
})
watch(tab, loadInner)

defineExpose({ reload: refresh })

const banText = computed(() => {
  const value = account.value
  if (!value?.banned) return '未封禁'
  return isPermanent(value.bannedUntil) ? '永久封禁' : `封禁至 ${formatTime(value.bannedUntil)}`
})
</script>

<template>
  <el-drawer
    v-model="open"
    :size="narrow ? '100%' : '1000px'"
    :title="account ? `账号详情 · ${account.nickname}（${account.username}）` : '账号详情'"
    append-to-body
    class="account-drawer"
  >
    <div v-loading="loading && !detail" class="drawer-body">
      <el-result v-if="failure && !detail" icon="error" title="加载失败" :sub-title="failure">
        <template #extra><el-button type="primary" @click="reload">重试</el-button></template>
      </el-result>
      <template v-if="account && detail">
        <div class="actions">
          <el-button :icon="Refresh" :loading="loading" @click="refresh">刷新</el-button>
          <el-button type="primary" :icon="Edit" @click="emit('edit', account)">编辑</el-button>
          <el-button type="success" :icon="Coin" @click="emit('grant', account)">赠送</el-button>
          <el-button
            type="danger"
            plain
            :icon="SwitchButton"
            :disabled="isSelf(account.id)"
            :title="isSelf(account.id) ? '不能把自己踢下线' : undefined"
            @click="emit('kick', account)"
          >踢下线</el-button>
        </div>

        <el-descriptions :column="narrow ? 1 : 3" border size="small" class="block">
          <el-descriptions-item label="账号">{{ account.username }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ account.nickname }}</el-descriptions-item>
          <el-descriptions-item label="账号 ID"><span class="mono">{{ account.id }}</span></el-descriptions-item>
          <el-descriptions-item label="等级">Lv.{{ account.level }}（经验 {{ formatNumber(account.exp) }}）</el-descriptions-item>
          <el-descriptions-item label="物品数">{{ formatNumber(account.inventoryCount) }}</el-descriptions-item>
          <el-descriptions-item label="新手礼包">{{ account.onboarded ? '已领取' : '未领取' }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ formatTime(account.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="注册 IP">{{ text(account.registerIp) }}</el-descriptions-item>
          <el-descriptions-item label="有效会话">{{ formatNumber(detail.sessions) }}</el-descriptions-item>
          <el-descriptions-item label="最后登录">{{ formatTime(account.lastLoginAt) }}</el-descriptions-item>
          <el-descriptions-item label="最后登录 IP">{{ text(account.lastLoginIp) }}</el-descriptions-item>
          <el-descriptions-item label="在线">
            <el-tag v-if="account.online" type="success" disable-transitions>{{ account.online.nodeName || account.online.nodeId }}</el-tag>
            <span v-else>离线</span>
          </el-descriptions-item>
          <el-descriptions-item label="俱乐部">
            <template v-if="detail.club">{{ detail.club.name }}（{{ clubGradeName(detail.club.grade) }}）</template>
            <template v-else>—</template>
          </el-descriptions-item>
          <el-descriptions-item label="管理员">
            <el-tag v-if="account.admin" type="warning" disable-transitions>管理员</el-tag>
            <span v-else>否</span>
          </el-descriptions-item>
          <el-descriptions-item label="封禁">
            <el-tag v-if="account.banned" type="danger" disable-transitions>{{ banText }}</el-tag>
            <span v-else>未封禁</span>
            <div v-if="account.banReason" class="muted">原因：{{ account.banReason }}</div>
          </el-descriptions-item>
        </el-descriptions>

        <div class="wallet block">
          <el-card shadow="never"><el-statistic title="点券" :value="account.coupon" /></el-card>
          <el-card shadow="never"><el-statistic title="金币" :value="account.lucci" /></el-card>
          <el-card shadow="never"><el-statistic title="K币" :value="account.koin" /></el-card>
          <el-card shadow="never"><el-statistic title="经验" :value="account.exp" /></el-card>
        </div>

        <el-tabs v-model="tab">
          <el-tab-pane label="物品" name="inventory">
            <TableToolbar :table="inventory" keyword="物品名称 / 物品编号">
              <el-form-item label="类别编号">
                <el-input v-model="inventory.filters.category" maxlength="6" inputmode="numeric" clearable placeholder="数字" class="narrow-input" />
              </el-form-item>
            </TableToolbar>
            <DataTable :table="inventory" size="small" row-key="id">
              <el-table-column prop="category" label="类别" min-width="120" sortable="custom">
                <template #default="{ row }">{{ row.categoryName || '—' }} <span class="muted">({{ row.category }})</span></template>
              </el-table-column>
              <el-table-column prop="itemId" label="编号" width="90" />
              <el-table-column label="名称" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">{{ row.name || row.systemKey || '—' }}</template>
              </el-table-column>
              <el-table-column prop="quantity" label="数量" width="90" align="right" sortable="custom">
                <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
              </el-table-column>
              <el-table-column prop="expiresAt" label="到期" width="170" sortable="custom">
                <template #default="{ row }">{{ row.expiresAt ? formatTime(row.expiresAt) : '永久' }}</template>
              </el-table-column>
              <el-table-column label="来源" width="110">
                <template #default="{ row }">{{ sourceName(row.source) }}</template>
              </el-table-column>
              <el-table-column prop="createdAt" label="获得时间" width="170" sortable="custom">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column prop="updatedAt" label="更新时间" width="170" sortable="custom">
                <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
              </el-table-column>
            </DataTable>
          </el-tab-pane>

          <el-tab-pane label="货币流水" name="ledger">
            <TableToolbar :table="ledger" range="时间">
              <el-form-item label="货币">
                <el-select v-model="ledger.filters.currency" clearable placeholder="全部" class="narrow-input" @change="ledger.search()">
                  <el-option v-for="option in currencyOptions" :key="option.value" :value="option.value" :label="option.label" />
                </el-select>
              </el-form-item>
            </TableToolbar>
            <DataTable :table="ledger" size="small" row-key="id">
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.at) }}</template>
              </el-table-column>
              <el-table-column label="货币" width="80">
                <template #default="{ row }"><CurrencyTag :currency="row.currency" /></template>
              </el-table-column>
              <el-table-column label="变化" width="120" align="right">
                <template #default="{ row }"><SignedNumber :value="row.delta" /></template>
              </el-table-column>
              <el-table-column label="余额" width="130" align="right">
                <template #default="{ row }">{{ formatNumber(row.balanceAfter) }}</template>
              </el-table-column>
              <el-table-column label="原因" width="120">
                <template #default="{ row }">{{ reasonName(row.reason) }}</template>
              </el-table-column>
              <el-table-column label="关联" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">{{ text(row.refId) }}</template>
              </el-table-column>
              <el-table-column label="备注" min-width="140" show-overflow-tooltip>
                <template #default="{ row }">{{ text(row.note) }}</template>
              </el-table-column>
            </DataTable>
          </el-tab-pane>

          <el-tab-pane :label="`登录记录（最近 ${detail.logins?.length ?? 0} 条）`" name="logins">
            <el-table :data="detail.logins ?? []" border stripe size="small" empty-text="暂无记录">
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.at) }}</template>
              </el-table-column>
              <el-table-column label="类型" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.kind === 'register' ? 'success' : 'info'" disable-transitions>{{ loginKindName(row.kind) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="IP" width="150">
                <template #default="{ row }">{{ text(row.ip) }}</template>
              </el-table-column>
              <el-table-column label="浏览器" min-width="200">
                <template #default="{ row }">
                  <el-tooltip :content="row.userAgent || '—'" placement="top" :show-after="300">
                    <span>{{ userAgentSummary(row.userAgent) }}</span>
                  </el-tooltip>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`比赛记录（最近 ${detail.races?.length ?? 0} 场）`" name="races">
            <el-table :data="detail.races ?? []" border stripe size="small" empty-text="暂无记录">
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.at) }}</template>
              </el-table-column>
              <el-table-column label="玩法" width="80">
                <template #default="{ row }">{{ gameplayName(row.gameplay) }}</template>
              </el-table-column>
              <el-table-column label="赛道" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.trackName || text(row.trackId) }}
                  <span v-if="row.trackName && row.trackId" class="muted">{{ row.trackId }}</span>
                </template>
              </el-table-column>
              <el-table-column label="名次" width="70" align="right">
                <template #default="{ row }">{{ text(row.rank) }}</template>
              </el-table-column>
              <el-table-column label="成绩" width="110" align="right">
                <template #default="{ row }">{{ formatElapsed(row.elapsedMs) }}</template>
              </el-table-column>
              <el-table-column label="积分" width="80" align="right">
                <template #default="{ row }">{{ formatNumber(row.points) }}</template>
              </el-table-column>
              <el-table-column label="经验" width="90" align="right">
                <template #default="{ row }">{{ formatNumber(row.exp) }}</template>
              </el-table-column>
              <el-table-column label="金币" width="90" align="right">
                <template #default="{ row }">{{ formatNumber(row.lucci) }}</template>
              </el-table-column>
              <el-table-column label="比赛 ID" min-width="160" show-overflow-tooltip>
                <template #default="{ row }"><span class="mono">{{ row.raceId }}</span></template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-body {
  min-height: 200px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.actions .el-button + .el-button {
  margin-left: 0;
}
.block {
  margin-bottom: 16px;
}
.wallet {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.narrow-input {
  width: 120px;
}
</style>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api, describe, errorMessage } from '../api/client'
import type { Currency, RewardBoxEntry, RewardBoxGift, RewardBoxRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { useNarrow } from '../composables/useNarrow'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import {
  formatNumber, rewardBoxSource, rewardBoxSourceOptions, rewardBoxState, rewardBoxStateOptions, text,
} from '../utils/format'
import { formatTime } from '../utils/time'
import { confirmAction } from '../utils/ui'

// 奖励箱赠送 (MENUS.md 1): POST /api/admin/reward-box. The gift waits in the
// rider's 奖励箱 for 30 days. An item is "分类:编号" with days (0 = permanent);
// currencies are 金币, 酷币 and 点券. Below it, GET /api/admin/reward-box
// lists every account's entries (q: 账号/昵称/物品名; source, state,
// account; from/to bound the arrival time; sort createdAt).

type Kind = Currency | 'item'

const kinds: { value: Kind; label: string }[] = [
  { value: 'lucci', label: '金币' },
  { value: 'koin', label: '酷币' },
  { value: 'coupon', label: '点券' },
  { value: 'item', label: '道具' },
]
const kindNames: Record<string, string> = { lucci: '金币', koin: '酷币', coupon: '点券' }

const form = reactive({
  username: '',
  kind: 'lucci' as Kind,
  item: '',
  count: 1 as number | undefined,
  days: 0 as number | undefined,
  message: '',
})
const submitting = ref(false)
// From the first click until the gift settles, the confirm box included.
const busy = ref(false)
const narrow = useNarrow()
const outcome = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const table = usePagedTable<RewardBoxRow, { source: string; state: string; account: string }>(
  '/api/admin/reward-box', { filters: { source: '', state: '', account: '' } })
useTab('reward-box', () => table.load())
onMounted(() => table.load())

async function submit() {
  if (busy.value) return
  busy.value = true
  try {
    await send()
  } finally {
    busy.value = false
  }
}

async function send() {
  outcome.value = null
  const username = form.username.trim()
  if (!username) {
    outcome.value = { type: 'error', text: '请填写用户名' }
    return
  }
  const count = Number(form.count)
  const body: RewardBoxGift = { username, count, message: form.message.trim() }
  let what = `${formatNumber(count)} ${kindNames[form.kind] ?? ''}`
  if (form.kind === 'item') {
    const match = /^(\d+)\s*:\s*(\d+)$/.exec(form.item.trim())
    if (!match) {
      outcome.value = { type: 'error', text: '道具请填“分类:编号”' }
      return
    }
    body.category = Number(match[1])
    body.itemId = Number(match[2])
    body.days = Number(form.days) || 0
    what = `道具 ${body.category}:${body.itemId} ×${formatNumber(count)}${body.days ? `（${body.days}天）` : ''}`
  } else {
    body.currency = form.kind
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    outcome.value = { type: 'error', text: describe('INVALID_GIFT') }
    return
  }
  if (!await confirmAction(`确认向 ${username} 的奖励箱赠送 ${what}？`, '奖励箱赠送', { type: 'info' })) return
  submitting.value = true
  try {
    const result = await api.post<{ ok: boolean; entry: RewardBoxEntry }>('/api/admin/reward-box', body)
    outcome.value = { type: 'success',
      text: `已放入 ${username} 的奖励箱：${result.entry.name} ×${formatNumber(result.entry.count)}，30 天内可领取。` }
    void table.load({ silent: true })
  } catch (error) {
    outcome.value = { type: 'error', text: errorMessage(error) }
  } finally {
    submitting.value = false
  }
}

/** 内容: a currency amount, or an item with its count and rental days. */
function content(row: RewardBoxRow) {
  const name = row.name || (row.currency ? kindNames[row.currency] ?? row.currency : `${row.category}:${row.itemId}`)
  return `${name} ×${formatNumber(row.count)}` + (!row.currency && row.days ? `（${row.days}天）` : '')
}
</script>

<template>
  <div>
    <el-card shadow="never" class="page-card">
      <template #header>赠送</template>
      <p class="page-note">赠送放入玩家的奖励箱，保管 30 天，由玩家在游戏内领取。道具填“分类:编号”（如 24:862），天数 0 为永久。</p>
      <el-form label-width="96px" :label-position="narrow ? 'top' : 'right'" class="gift-form" @submit.prevent="submit">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" maxlength="24" clearable placeholder="账号用户名" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-radio-group v-model="form.kind">
            <el-radio-button v-for="kind in kinds" :key="kind.value" :value="kind.value">{{ kind.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.kind === 'item'" label="道具" required>
          <el-input v-model="form.item" maxlength="24" placeholder="分类:编号，如 24:862" class="short" />
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input-number v-model="form.count" :min="1" :max="1000000" :step="1" :precision="0" step-strictly class="short" />
        </el-form-item>
        <el-form-item v-if="form.kind === 'item'" label="天数">
          <el-input-number v-model="form.days" :min="0" :max="3650" :step="1" :precision="0" step-strictly class="short" />
          <span class="muted unit">0 为永久</span>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.message" maxlength="60" show-word-limit placeholder="最多 60 字，留空为“管理员赠送”" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="submitting" :disabled="busy && !submitting">赠送</el-button>
        </el-form-item>
        <el-alert v-if="outcome" :type="outcome.type" :title="outcome.text" :closable="false" show-icon />
      </el-form>
    </el-card>

    <el-card shadow="never" class="page-card">
      <template #header>奖励箱记录</template>
      <TableToolbar :table="table" keyword="账号 / 昵称 / 物品名" range="放入时间">
        <el-form-item label="账号">
          <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" @clear="table.search()" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="table.filters.source" clearable placeholder="全部" class="filter-select" @change="table.search()">
            <el-option v-for="option in rewardBoxSourceOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="table.filters.state" clearable placeholder="全部" class="filter-select" @change="table.search()">
            <el-option v-for="option in rewardBoxStateOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
        </el-form-item>
      </TableToolbar>
      <DataTable :table="table" row-key="id" empty-text="奖励箱里没有记录">
        <el-table-column prop="createdAt" label="放入时间" width="175" sortable="custom">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="账号" min-width="150">
          <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <el-tag :type="rewardBoxSource(row.source).type" disable-transitions>{{ rewardBoxSource(row.source).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ content(row) }}
            <span v-if="!row.currency && (row.category || row.itemId)" class="muted mono">{{ row.category }}:{{ row.itemId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ text(row.message) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="rewardBoxState(row.state).type" disable-transitions>{{ rewardBoxState(row.state).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="领取时间" width="175">
          <template #default="{ row }">{{ formatTime(row.claimedAt) }}</template>
        </el-table-column>
        <el-table-column label="过期时间" width="175">
          <template #default="{ row }">{{ formatTime(row.expiresAt) }}</template>
        </el-table-column>
      </DataTable>
    </el-card>
  </div>
</template>

<style scoped>
.gift-form {
  max-width: 640px;
}
.short {
  width: 220px;
}
.unit {
  margin-left: 12px;
  font-size: 12px;
}
</style>

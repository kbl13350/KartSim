<script setup lang="ts">
import { reactive, ref } from 'vue'
import { api, describe, errorMessage } from '../api/client'
import { useNarrow } from '../composables/useNarrow'
import type { Currency, RewardBoxEntry, RewardBoxGift } from '../api/types'
import { formatNumber } from '../utils/format'
import { confirmAction } from '../utils/ui'

// 奖励箱赠送 (MENUS.md 1): POST /api/admin/reward-box. The gift waits in the
// rider's 奖励箱 for 30 days. An item is "分类:编号" with days (0 = permanent);
// currencies are 金币, 酷币 and 点券.

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
const narrow = useNarrow()
const outcome = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const history = ref<{ at: number; text: string }[]>([])

async function submit() {
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
    const message = `已放入 ${username} 的奖励箱：${result.entry.name} ×${formatNumber(result.entry.count)}，30 天内可领取。`
    outcome.value = { type: 'success', text: message }
    history.value.unshift({ at: Date.now(), text: message })
    history.value.splice(10)
  } catch (error) {
    outcome.value = { type: 'error', text: errorMessage(error) }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-card shadow="never" class="page-card">
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
        <el-button type="primary" native-type="submit" :loading="submitting">赠送</el-button>
      </el-form-item>
      <el-alert v-if="outcome" :type="outcome.type" :title="outcome.text" :closable="false" show-icon />
    </el-form>
    <template v-if="history.length">
      <el-divider content-position="left">本次登录的赠送</el-divider>
      <el-timeline>
        <el-timeline-item v-for="entry in history" :key="entry.at" :timestamp="new Date(entry.at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })">
          {{ entry.text }}
        </el-timeline-item>
      </el-timeline>
    </template>
  </el-card>
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

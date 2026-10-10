<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { api, ApiError, errorMessage, describe } from '../api/client'
import type { AccountRow, GrantCurrency, GrantResult } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { currencyName, currencyOptions, formatNumber } from '../utils/format'
import { confirmAction, newRequestId } from '../utils/ui'

// 赠送 / 扣除: POST /api/admin/grant {username, currency, amount, note,
// requestId}, exactly like the old console. A positive amount grants, a
// negative one deducts.

const props = defineProps<{
  /** Prefilled account name (editable). */
  username?: string
  /** The row the dialog was opened from, to show current balances. */
  account?: AccountRow | null
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ done: [] }>()
const narrow = useNarrow()

const form = reactive({
  username: '',
  currency: 'coupon' as GrantCurrency,
  amount: undefined as number | undefined,
  note: '',
})
const outcome = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const submitting = ref(false)
// Set from the first click until the grant settles, the confirm box
// included: Enter in a field cannot start a second grant meanwhile (the
// hidden default button is disabled too, which blocks implicit submission).
const busy = ref(false)

// Balances shown under the name: the row's, then each grant's result.
interface Balance { username: string; level: number; exp: number; coupon: number; lucci: number; koin: number }
const balance = ref<Balance | null>(null)
const current = computed(() => (balance.value && balance.value.username === form.username.trim() ? balance.value : null))

watch(open, (value) => {
  if (!value) return
  form.username = props.username ?? ''
  form.amount = undefined
  outcome.value = null
  const account = props.account
  balance.value = account ? { username: account.username, level: account.level, exp: account.exp,
    coupon: account.coupon, lucci: account.lucci, koin: account.koin } : null
})

// The request id of a grant that has not succeeded yet. Submitting the
// same grant again (after a network error or an unclear outcome) reuses
// it, so the server applies it at most once; a changed form or a success
// starts a new one.
let pendingGrant: { key: string; requestId: string } | null = null
function grantRequestId(grant: object): string {
  const key = JSON.stringify(grant)
  if (!pendingGrant || pendingGrant.key !== key) pendingGrant = { key, requestId: newRequestId() }
  return pendingGrant.requestId
}

async function submit() {
  if (busy.value) return
  busy.value = true
  try {
    await sendGrant()
  } finally {
    busy.value = false
  }
}

async function sendGrant() {
  outcome.value = null
  const target = form.username.trim()
  if (!target) {
    outcome.value = { type: 'error', text: '请填写用户名' }
    return
  }
  const amount = Number(form.amount)
  if (!Number.isSafeInteger(amount) || amount === 0) {
    outcome.value = { type: 'error', text: describe('INVALID_GRANT') }
    return
  }
  const note = form.note.trim()
  if (!note) {
    outcome.value = { type: 'error', text: describe('INVALID_NOTE') }
    return
  }
  const currency = form.currency
  const verb = amount > 0 ? '发放' : '扣除'
  const confirmed = await confirmAction(
    `确认向 ${target} ${verb} ${formatNumber(Math.abs(amount))} ${currencyName(currency)}？`, verb,
    { type: amount < 0 ? 'warning' : 'info', danger: amount < 0, confirmText: verb })
  if (!confirmed) return
  submitting.value = true
  try {
    const grant = { username: target, currency, amount, note }
    const result = await api.post<GrantResult>('/api/admin/grant', { ...grant, requestId: grantRequestId(grant) })
    pendingGrant = null
    const account = result.account
    const wallet = account.wallet ?? { coupon: account.coupon ?? 0, lucci: account.lucci ?? 0, koin: account.koin ?? 0 }
    let message = `已${verb} ${formatNumber(Math.abs(result.applied))} ${currencyName(currency)}。当前：Lv.${account.level}，` +
      `经验 ${formatNumber(account.exp)}，点券 ${formatNumber(wallet.coupon)}，金币 ${formatNumber(wallet.lucci)}，` +
      `K币 ${formatNumber(wallet.koin)}`
    if (result.duplicate) message = '该发放已经处理过，未重复执行。' + message
    else if (result.applied !== amount) message += '（经验已达上限，只增加了实际可增加的部分）'
    if (result.levelUps && result.levelUps.length) {
      message += `；升级到 Lv.${result.levelUps[result.levelUps.length - 1]!.level} 并发放了升级奖励`
    }
    outcome.value = { type: 'success', text: message }
    balance.value = { username: target, level: account.level, exp: account.exp, ...wallet }
    form.amount = undefined
    emit('done')
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'REQUEST_ID_CONFLICT' || error.code === 'INVALID_REQUEST_ID')) {
      pendingGrant = null
    }
    outcome.value = { type: 'error', text: errorMessage(error) }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="open" title="赠送 / 扣除" :width="narrow ? '94%' : '520px'" :close-on-click-modal="false" append-to-body>
    <el-form label-width="96px" :label-position="narrow ? 'top' : 'right'" @submit.prevent="submit">
      <el-form-item label="用户名" required>
        <el-input v-model="form.username" maxlength="24" placeholder="账号用户名" clearable />
      </el-form-item>
      <el-form-item v-if="current" label="当前">
        <span class="muted">
          Lv.{{ current.level }} · 经验 {{ formatNumber(current.exp) }} · 点券 {{ formatNumber(current.coupon) }} ·
          金币 {{ formatNumber(current.lucci) }} · K币 {{ formatNumber(current.koin) }}
        </span>
      </el-form-item>
      <el-form-item label="类型" required>
        <el-radio-group v-model="form.currency">
          <el-radio-button v-for="option in currencyOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="数量" required>
        <el-input-number
          v-model="form.amount"
          :min="-1000000000"
          :max="1000000000"
          :step="1"
          :precision="0"
          step-strictly
          controls-position="right"
          placeholder="负数为扣除"
          class="amount"
        />
        <div class="hint">正数发放，负数扣除；绝对值不超过 10 亿，扣除后不能为负数。</div>
      </el-form-item>
      <el-form-item label="备注" required>
        <el-input v-model="form.note" maxlength="200" show-word-limit placeholder="必填，写入流水" />
      </el-form-item>
      <el-alert v-if="outcome" :type="outcome.type" :title="outcome.text" :closable="false" show-icon class="outcome" />
      <button type="submit" hidden :disabled="busy" />
    </el-form>
    <template #footer>
      <el-button @click="open = false">关闭</el-button>
      <el-button
        :type="(form.amount ?? 0) < 0 ? 'danger' : 'primary'"
        :loading="submitting"
        :disabled="busy && !submitting"
        @click="submit"
      >
        {{ (form.amount ?? 0) < 0 ? '扣除' : '发放' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.amount {
  width: 220px;
}
.hint {
  width: 100%;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.muted {
  color: var(--el-text-color-secondary);
}
.outcome {
  margin-top: 4px;
}
</style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { DrawnItem, LotteryActivity, LotteryAdmin, LotterySave, StockItem } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { useTab } from '../composables/useTabs'
import type { TagType } from '../utils/format'
import { formatTime, parseBeijing, toBeijingString } from '../utils/time'
import { confirmAction, showError } from '../utils/ui'

// 抽奖活动 (LOTTERY.md 5): GET /api/admin/lottery lists the treasure hunt,
// the 精品道具场 switch, the lotteries packs sell and every customised
// lottery; PUT /api/admin/lottery {activity, enabled, start?, end?, daily?}
// saves one, {activity, reset: true} restores its default.

const MAX_DAILY = 8
const data = ref<LotteryAdmin | null>(null)
const loading = ref(false)
const failure = ref('')
const pick = ref<number | null>(null)
const narrow = useNarrow()

async function load() {
  loading.value = true
  try {
    data.value = await api.get<LotteryAdmin>('/api/admin/lottery')
    failure.value = ''
  } catch (error) {
    failure.value = errorMessage(error)
    showError(error)
  } finally {
    loading.value = false
  }
}

useTab('lottery', load)
onMounted(load)

function itemsText(items: DrawnItem[] | null | undefined) {
  return items && items.length
    ? items.map((item) => `${item.name || `${item.category}:${item.itemId}`} ×${item.count}` +
      (item.days ? `（${item.days}天）` : '')).join('，')
    : '无'
}

function periodText(start: number | null | undefined, end: number | null | undefined) {
  if (start == null && end == null) return '不限'
  return `${start == null ? '…' : formatTime(start)} ~ ${end == null ? '…' : formatTime(end)}`
}

function state(activity: LotteryActivity, now: number): { label: string; type: TagType } {
  if (!activity.enabled) return { label: '已关闭', type: 'info' }
  if (activity.open) return { label: '开放中', type: 'success' }
  if (activity.start != null && now < activity.start) return { label: '未开始', type: 'warning' }
  return { label: '已结束', type: 'danger' }
}

function originalPeriod(activity: LotteryActivity) {
  if (!activity.originalStart && !activity.originalEnd) return '—'
  return `${(activity.originalStart || '…').slice(0, 10)} ~ ${(activity.originalEnd || '…').slice(0, 10)}`
}

const lotteryOptions = computed(() => data.value?.lotteries ?? [])

/* ---------- editor ---------- */

interface DailyRow {
  category: number | undefined
  itemId: number | undefined
  count: number | undefined
  days: number | undefined
}

const editOpen = ref(false)
const editing = ref<LotteryActivity | null>(null)
const saving = ref(false)
const editFailure = ref('')
const form = reactive({
  enabled: true,
  start: null as string | null,
  end: null as string | null,
  daily: [] as DailyRow[],
})

function editLottery(activity: LotteryActivity) {
  editing.value = activity
  form.enabled = activity.enabled !== false
  form.start = activity.start != null ? toBeijingString(activity.start) : null
  form.end = activity.end != null ? toBeijingString(activity.end) : null
  form.daily = activity.custom && activity.daily
    ? activity.daily.map((item) => ({ category: item.category, itemId: item.itemId, count: item.count, days: item.days || 0 }))
    : []
  editFailure.value = ''
  editOpen.value = true
}

function editPicked() {
  const itemId = pick.value
  if (!itemId) return
  const activity = 'lottery:' + itemId
  const listed = data.value?.activities.find((row) => row.activity === activity)
  const name = lotteryOptions.value.find((row) => row.itemId === itemId)?.name ?? String(itemId)
  editLottery(listed ?? {
    activity, name, enabled: true, open: true, start: null, end: null, daily: null, defaultDaily: null,
    hasDaily: false, custom: false,
  })
}

function addDaily() {
  if (form.daily.length < MAX_DAILY) form.daily.push({ category: undefined, itemId: undefined, count: 1, days: 0 })
}

function useDefaultDaily() {
  form.daily = (editing.value?.defaultDaily ?? []).slice(0, MAX_DAILY)
    .map((item) => ({ category: item.category, itemId: item.itemId, count: item.count, days: item.days || 0 }))
}

function dailyItems(): StockItem[] {
  return form.daily.map((row, index) => {
    const category = Number(row.category)
    const itemId = Number(row.itemId)
    const count = Number(row.count)
    const days = Number(row.days ?? 0)
    if (!Number.isInteger(category) || category < 0 || !Number.isInteger(itemId) || itemId < 0 ||
      !Number.isInteger(count) || count < 1 || count > 1000 || !Number.isInteger(days) || days < 0) {
      throw new Error(`第 ${index + 1} 行无效：分类、编号须为整数，数量 1–1000，天数不小于 0`)
    }
    return { category, itemId, count, days }
  })
}

async function save(body: LotterySave) {
  saving.value = true
  editFailure.value = ''
  try {
    const saved = await api.put<LotteryActivity>('/api/admin/lottery', body)
    ElMessage.success(`${body.reset ? '已恢复默认：' : '已保存：'}${saved.name}，${state(saved, Date.now()).label}`)
    editOpen.value = false
    void load()
  } catch (error) {
    editFailure.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

function submit() {
  const activity = editing.value
  if (!activity) return
  editFailure.value = ''
  const body: LotterySave = { activity: activity.activity, enabled: form.enabled }
  if (form.start) body.start = parseBeijing(form.start)
  if (form.end) body.end = parseBeijing(form.end)
  if (body.start !== undefined && body.end !== undefined && body.end <= body.start) {
    editFailure.value = '结束时间须晚于开始时间'
    return
  }
  if (activity.hasDaily && form.daily.length) {
    try {
      body.daily = dailyItems()
    } catch (error) {
      editFailure.value = errorMessage(error)
      return
    }
  }
  void save(body)
}

async function reset() {
  const activity = editing.value
  if (!activity) return
  if (!await confirmAction(`恢复 ${activity.name || activity.activity} 的默认设置（一直开放、默认每日道具）？`, '恢复默认')) return
  void save({ activity: activity.activity, reset: true })
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <p class="page-note">
      没有自定义设置的活动一直开放（不按原版日期）。“精品道具场”的开关作用于所有扭蛋；单个扭蛋可另行关闭或设置时段。每日免费道具每个北京日领取一次。
    </p>
    <div class="toolbar">
      <el-select v-model="pick" filterable clearable placeholder="选择其他扭蛋进行设置" class="pick">
        <el-option v-for="row in lotteryOptions" :key="row.itemId" :value="row.itemId" :label="`${row.itemId} ${row.name}`" />
      </el-select>
      <el-button type="primary" :icon="Edit" :disabled="!pick" @click="editPicked">编辑</el-button>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="failure && !data" type="error" :title="`加载失败：${failure}`" :closable="false" show-icon />
    <el-table v-loading="loading" :data="data?.activities ?? []" border stripe row-key="activity" empty-text="暂无活动">
      <el-table-column label="活动" min-width="220">
        <template #default="{ row }">
          <div>{{ row.name || row.activity }}</div>
          <div class="muted mono">{{ row.activity }}</div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="state(row, data?.serverTime ?? Date.now()).type" disable-transitions>
            {{ state(row, data?.serverTime ?? Date.now()).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="开放时段" min-width="200">
        <template #default="{ row }">{{ periodText(row.start, row.end) }}</template>
      </el-table-column>
      <el-table-column label="每日免费" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">{{ row.hasDaily ? itemsText(row.daily) : '—' }}</template>
      </el-table-column>
      <el-table-column label="原版时段" width="200">
        <template #default="{ row }">{{ originalPeriod(row) }}</template>
      </el-table-column>
      <el-table-column label="设置人" min-width="170">
        <template #default="{ row }">
          <template v-if="row.custom">{{ row.updatedBy || '—' }} <span class="muted">{{ formatTime(row.updatedAt) }}</span></template>
          <span v-else class="muted">默认</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="editLottery(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="editOpen"
      :title="editing ? `设置 · ${editing.name || editing.activity}` : '设置活动'"
      :width="narrow ? '94%' : '680px'"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form v-if="editing" label-width="96px" :label-position="narrow ? 'top' : 'right'" @submit.prevent="submit">
        <el-form-item label="活动">
          <span class="mono">{{ editing.activity }}</span>
        </el-form-item>
        <el-form-item label="开放">
          <el-switch v-model="form.enabled" active-text="开放" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="开始">
          <el-date-picker v-model="form.start" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" placeholder="留空不限（北京时间）" clearable />
        </el-form-item>
        <el-form-item label="结束">
          <el-date-picker v-model="form.end" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" placeholder="留空不限（北京时间）" clearable />
        </el-form-item>
        <el-form-item v-if="editing.hasDaily" label="每日免费">
          <div class="daily">
            <div class="muted hint">留空使用默认。默认：{{ itemsText(editing.defaultDaily) }}</div>
            <div v-if="form.daily.length" class="daily-row muted daily-head">
              <span class="cell">分类</span><span class="sep">&nbsp;</span><span class="cell">编号</span><span class="sep">&nbsp;</span>
              <span class="cell">数量</span><span class="cell">天数</span>
            </div>
            <div v-for="(row, index) in form.daily" :key="index" class="daily-row">
              <el-input-number v-model="row.category" :min="0" :precision="0" :controls="false" placeholder="分类" class="cell" />
              <span class="sep">:</span>
              <el-input-number v-model="row.itemId" :min="0" :precision="0" :controls="false" placeholder="编号" class="cell" />
              <span class="sep">×</span>
              <el-input-number v-model="row.count" :min="1" :max="1000" :precision="0" :controls="false" placeholder="数量" class="cell" />
              <el-input-number v-model="row.days" :min="0" :max="3650" :precision="0" :controls="false" placeholder="天数" class="cell" />
              <span class="muted unit">天（0 永久）</span>
              <el-button link type="danger" :icon="Delete" @click="form.daily.splice(index, 1)" />
            </div>
            <div class="daily-tools">
              <el-button size="small" :icon="Plus" :disabled="form.daily.length >= MAX_DAILY" @click="addDaily">添加道具</el-button>
              <el-button size="small" @click="useDefaultDaily">填入默认</el-button>
              <el-button v-if="form.daily.length" size="small" @click="form.daily = []">清空（用默认）</el-button>
            </div>
          </div>
        </el-form-item>
        <el-alert v-if="editFailure" type="error" :title="editFailure" :closable="false" show-icon />
        <button type="submit" hidden />
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="danger" plain :loading="saving" @click="reset">恢复默认</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar .el-button + .el-button {
  margin-left: 0;
}
.pick {
  width: 280px;
  max-width: 100%;
}
.daily {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.daily-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.cell {
  width: 80px;
}
.sep {
  width: 12px;
  text-align: center;
}
.unit {
  font-size: 12px;
}
.daily-head {
  font-size: 12px;
  line-height: 1;
}
.daily-head .cell {
  text-align: center;
}
.hint {
  font-size: 12px;
  line-height: 1.6;
}
.daily-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.daily-tools .el-button + .el-button {
  margin-left: 0;
}
</style>

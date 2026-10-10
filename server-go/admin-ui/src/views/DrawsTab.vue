<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BoxOpeningRow, LotteryDrawRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import JsonDialog from '../components/JsonDialog.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { isPositiveInteger } from '../utils/filters'
import { drawKindName, drawKindNames, formatNumber, text } from '../utils/format'
import { formatTime } from '../utils/time'

// 抽奖与开箱: GET /api/admin/lottery-draws (寻宝 / 精品道具场; kind) and
// GET /api/admin/box-openings (box: the box's item id), one inner tab each.
// q matches only the account's username and nickname on both.

const inner = ref<'draws' | 'boxes'>('draws')
const draws = usePagedTable<LotteryDrawRow, { kind: string }>('/api/admin/lottery-draws', { filters: { kind: '' } })
const boxes = usePagedTable<BoxOpeningRow, { box: string }>('/api/admin/box-openings', {
  filters: { box: '' },
  validate: ({ box }) => (box && !isPositiveInteger(box, 9) ? '箱子编号须为正整数' : ''),
})
const kindOptions = Object.entries(drawKindNames).map(([value, label]) => ({ value, label }))

useTab('draws', () => (inner.value === 'draws' ? draws : boxes).load())

// Each inner list loads the first time it is shown.
watch(inner, (name) => {
  const table = name === 'draws' ? draws : boxes
  if (!table.loaded && !table.loading) void table.load()
}, { immediate: true })

const resultOpen = ref(false)
const resultTitle = ref('')
const resultValue = ref<unknown>(null)

function showResult(title: string, value: unknown) {
  resultTitle.value = title
  resultValue.value = value
  resultOpen.value = true
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <el-tabs v-model="inner">
      <el-tab-pane label="抽奖记录" name="draws">
        <TableToolbar :table="draws" keyword="账号 / 昵称" range="时间">
          <el-form-item label="类型">
            <el-select v-model="draws.filters.kind" clearable placeholder="全部" class="filter-select" @change="draws.search()">
              <el-option v-for="option in kindOptions" :key="option.value" :value="option.value" :label="option.label" />
            </el-select>
          </el-form-item>
        </TableToolbar>
        <DataTable :table="draws">
          <el-table-column prop="at" label="时间" width="175" sortable="custom">
            <template #default="{ row }">{{ formatTime(row.at) }}</template>
          </el-table-column>
          <el-table-column label="账号" min-width="150">
            <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
          </el-table-column>
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :type="row.kind === 'treasure' ? 'warning' : 'primary'" disable-transitions>{{ drawKindName(row.kind) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="活动/扭蛋" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.refName || text(row.ref) }}
              <span v-if="row.refName" class="muted mono">#{{ row.ref }}</span>
            </template>
          </el-table-column>
          <el-table-column label="次数" width="70" align="right">
            <template #default="{ row }">{{ formatNumber(row.count) }}</template>
          </el-table-column>
          <el-table-column label="结果" min-width="300" show-overflow-tooltip>
            <template #default="{ row }">{{ text(row.summary) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="showResult(`抽奖结果 · ${row.username}`, row.result)">详情</el-button>
            </template>
          </el-table-column>
        </DataTable>
      </el-tab-pane>
      <el-tab-pane label="开箱记录" name="boxes">
        <TableToolbar :table="boxes" keyword="账号 / 昵称" range="时间">
          <el-form-item label="箱子编号">
            <el-input
              v-model="boxes.filters.box"
              maxlength="9"
              inputmode="numeric"
              clearable
              placeholder="箱子物品编号"
              class="filter-input"
              @clear="boxes.search()"
            />
          </el-form-item>
        </TableToolbar>
        <DataTable :table="boxes">
          <el-table-column prop="at" label="时间" width="175" sortable="custom">
            <template #default="{ row }">{{ formatTime(row.at) }}</template>
          </el-table-column>
          <el-table-column label="账号" min-width="150">
            <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
          </el-table-column>
          <el-table-column label="箱子" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ text(row.boxName) }} <span class="muted mono">#{{ row.boxId }}</span></template>
          </el-table-column>
          <el-table-column label="奖励组" width="90" align="right">
            <template #default="{ row }">{{ text(row.stockId) }}</template>
          </el-table-column>
          <el-table-column label="结果" min-width="300" show-overflow-tooltip>
            <template #default="{ row }">{{ text(row.summary) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="showResult(`开箱结果 · ${row.username}`, row.result)">详情</el-button>
            </template>
          </el-table-column>
        </DataTable>
      </el-tab-pane>
    </el-tabs>
    <JsonDialog v-model="resultOpen" :title="resultTitle" :value="resultValue" />
  </el-card>
</template>

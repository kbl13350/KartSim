<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BoxOpeningRow, LotteryDrawRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import JsonDialog from '../components/JsonDialog.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { drawKindName, formatNumber, text } from '../utils/format'
import { formatTime } from '../utils/time'

// 抽奖与开箱: GET /api/admin/lottery-draws (寻宝 / 精品道具场) and
// GET /api/admin/box-openings, one inner tab each.

const inner = ref<'draws' | 'boxes'>('draws')
const draws = usePagedTable<LotteryDrawRow>('/api/admin/lottery-draws')
const boxes = usePagedTable<BoxOpeningRow>('/api/admin/box-openings')

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
        <TableToolbar :table="draws" keyword="账号 / 结果" range="时间" />
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
          <el-table-column label="活动/扭蛋" width="100" align="right">
            <template #default="{ row }">{{ text(row.ref) }}</template>
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
        <TableToolbar :table="boxes" keyword="账号 / 箱子 / 结果" range="时间" />
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

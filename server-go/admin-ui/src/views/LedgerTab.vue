<script setup lang="ts">
import { onMounted } from 'vue'
import type { LedgerRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import CurrencyTag from '../components/CurrencyTag.vue'
import DataTable from '../components/DataTable.vue'
import SignedNumber from '../components/SignedNumber.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { isAsciiToken } from '../utils/filters'
import { currencyOptions, formatNumber, reasonName, reasonOptions, text } from '../utils/format'
import { formatTime } from '../utils/time'

// 货币流水: GET /api/admin/ledger (wallet_ledger and exp_ledger; q: 关联
// (refId) / 备注 contains; account, currency, reason, from/to; sort
// at/delta). A typed reason (allow-create) must be a reason code: printable
// ASCII, at most 24 characters. The filters are sized so the toolbar fits
// one line from 1440px.

const table = usePagedTable<LedgerRow, { account: string; currency: string; reason: string }>(
  '/api/admin/ledger', {
    filters: { account: '', currency: '', reason: '' },
    validate: ({ reason }) => (reason && !isAsciiToken(reason, 24)
      ? '原因须为英文原因代码（如 race、purchase），最多 24 个字符，不含空格'
      : ''),
  })
useTab('ledger', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="关联 / 备注" range="时间" class="ledger-toolbar">
      <el-form-item label="账号">
        <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" @clear="table.search()" />
      </el-form-item>
      <el-form-item label="货币">
        <el-select v-model="table.filters.currency" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option v-for="option in currencyOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="原因">
        <el-select
          v-model="table.filters.reason"
          clearable
          filterable
          allow-create
          default-first-option
          placeholder="全部"
          class="reason-select"
          @change="table.search()"
        >
          <template #label="{ value }">{{ reasonName(String(value)) }}</template>
          <el-option v-for="option in reasonOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="id">
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
      </el-table-column>
      <el-table-column label="货币" width="80">
        <template #default="{ row }"><CurrencyTag :currency="row.currency" /></template>
      </el-table-column>
      <el-table-column prop="delta" label="变化" width="130" align="right" sortable="custom">
        <template #default="{ row }"><SignedNumber :value="row.delta" /></template>
      </el-table-column>
      <el-table-column label="余额" width="140" align="right">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.balanceAfter) }}</span></template>
      </el-table-column>
      <el-table-column label="原因" width="130">
        <template #default="{ row }">
          <el-tooltip :content="row.reason || '—'" placement="top" :show-after="300">
            <span>{{ reasonName(row.reason) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="关联" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><span class="mono">{{ text(row.refId) }}</span></template>
      </el-table-column>
      <el-table-column label="备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ text(row.note) }}</template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

<style scoped>
.reason-select {
  width: 200px;
}
/* Keyword, three filters, the range and the buttons share one line from
   1440px (a 1351px toolbar with a classic scrollbar). */
@media (min-width: 641px) {
  .ledger-toolbar.toolbar :deep(.keyword) {
    width: 160px;
  }
  .ledger-toolbar .filter-input {
    width: 110px;
  }
  .ledger-toolbar .filter-select {
    width: 90px;
  }
  .ledger-toolbar .reason-select {
    width: 140px;
  }
  .ledger-toolbar.toolbar :deep(.range) {
    width: 350px;
  }
}
@media (max-width: 640px) {
  .reason-select {
    width: 100%;
  }
}
</style>

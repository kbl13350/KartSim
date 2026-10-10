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
import { currencyOptions, formatNumber, reasonName, reasonOptions, text } from '../utils/format'
import { formatTime } from '../utils/time'

// 货币流水: GET /api/admin/ledger (wallet_ledger and exp_ledger; account,
// currency, reason, from/to).

const table = usePagedTable<LedgerRow, { account: string; currency: string; reason: string }>(
  '/api/admin/ledger', { filters: { account: '', currency: '', reason: '' } })
useTab('ledger', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" range="时间">
      <el-form-item label="账号">
        <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" />
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
      <el-table-column label="变化" width="130" align="right">
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
@media (max-width: 640px) {
  .reason-select {
    width: 100%;
  }
}
</style>

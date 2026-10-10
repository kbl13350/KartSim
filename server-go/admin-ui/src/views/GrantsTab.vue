<script setup lang="ts">
import { onMounted } from 'vue'
import type { GrantRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import CurrencyTag from '../components/CurrencyTag.vue'
import DataTable from '../components/DataTable.vue'
import SignedNumber from '../components/SignedNumber.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { text } from '../utils/format'
import { formatTime } from '../utils/time'

// 发放记录: GET /api/admin/grants (admin_grants: grants and deductions).

const table = usePagedTable<GrantRow>('/api/admin/grants')
useTab('grants', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="账号 / 管理员 / 备注" range="时间" />
    <DataTable :table="table">
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="管理员" min-width="110">
        <template #default="{ row }">{{ text(row.admin) }}</template>
      </el-table-column>
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
      </el-table-column>
      <el-table-column label="货币" width="80">
        <template #default="{ row }"><CurrencyTag :currency="row.currency" /></template>
      </el-table-column>
      <el-table-column label="数量" width="140" align="right">
        <template #default="{ row }"><SignedNumber :value="row.amount" /></template>
      </el-table-column>
      <el-table-column label="备注" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ text(row.note) }}</template>
      </el-table-column>
      <el-table-column label="请求编号" min-width="150" show-overflow-tooltip>
        <template #default="{ row }"><span class="mono muted">{{ text(row.requestId) }}</span></template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import type { PurchaseRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import CurrencyTag from '../components/CurrencyTag.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { formatNumber, text } from '../utils/format'
import { formatTime } from '../utils/time'

// 购买记录: GET /api/admin/purchases (shop purchases; q matches the username,
// nickname and offer id; sort at/price).

const table = usePagedTable<PurchaseRow>('/api/admin/purchases')
useTab('purchases', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="账号 / 昵称 / 商品编号" range="时间" />
    <DataTable :table="table" row-key="id">
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
      </el-table-column>
      <el-table-column label="商品" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ text(row.name) }} <span class="muted mono">{{ row.category }}:{{ row.itemId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="商品编号" width="100">
        <template #default="{ row }">{{ text(row.offerId) }}</template>
      </el-table-column>
      <el-table-column label="货币" width="80">
        <template #default="{ row }"><CurrencyTag :currency="row.currency" /></template>
      </el-table-column>
      <el-table-column prop="price" label="价格" width="120" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.price) }}</span></template>
      </el-table-column>
      <el-table-column label="期限" width="80" align="right">
        <template #default="{ row }">{{ row.days ? `${row.days}天` : '永久' }}</template>
      </el-table-column>
      <el-table-column label="数量" width="80" align="right">
        <template #default="{ row }">{{ formatNumber(row.count) }}</template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

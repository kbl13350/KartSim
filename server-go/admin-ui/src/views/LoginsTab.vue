<script setup lang="ts">
import { onMounted } from 'vue'
import type { LoginRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { loginKindName, text, userAgentSummary } from '../utils/format'
import { formatTime } from '../utils/time'

// 登录记录: GET /api/admin/logins (kind, account, ip, from/to).

const table = usePagedTable<LoginRow, { kind: string; account: string; ip: string }>(
  '/api/admin/logins', { filters: { kind: '', account: '', ip: '' } })
useTab('logins', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" range="时间">
      <el-form-item label="账号">
        <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" />
      </el-form-item>
      <el-form-item label="IP">
        <el-input v-model="table.filters.ip" maxlength="45" clearable placeholder="IP 地址" class="filter-input" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="table.filters.kind" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option value="login" label="登录" />
          <el-option value="register" label="注册" />
        </el-select>
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="id">
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.kind === 'register' ? 'success' : 'info'" disable-transitions>{{ loginKindName(row.kind) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
      </el-table-column>
      <el-table-column label="IP" min-width="140">
        <template #default="{ row }">{{ text(row.ip) }}</template>
      </el-table-column>
      <el-table-column label="浏览器" min-width="260">
        <template #default="{ row }">
          <el-tooltip :content="row.userAgent || '—'" placement="top" :show-after="300">
            <span>{{ userAgentSummary(row.userAgent) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

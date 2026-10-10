<script setup lang="ts">
import { onMounted } from 'vue'
import type { LoginRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { isAsciiToken } from '../utils/filters'
import { loginKindName, loginKindOptions, loginKindTag, text, userAgentSummary } from '../utils/format'
import { formatTime } from '../utils/time'

// 登录记录: GET /api/admin/logins (q: 账号/昵称/IP contains; kind register,
// login or resume (自动登录: the first activity of a Beijing day on a saved
// token); account; ip (exact); from/to).

const table = usePagedTable<LoginRow, { kind: string; account: string; ip: string }>(
  '/api/admin/logins', {
    filters: { kind: '', account: '', ip: '' },
    validate: ({ ip }) => (ip && !isAsciiToken(ip, 45) ? 'IP 地址无效（英文字符，不含空格）' : ''),
  })
useTab('logins', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="账号 / 昵称 / IP" range="时间">
      <el-form-item label="账号">
        <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" @clear="table.search()" />
      </el-form-item>
      <el-form-item label="IP">
        <el-input v-model="table.filters.ip" maxlength="45" clearable placeholder="完整 IP 地址" class="filter-input" @clear="table.search()" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="table.filters.kind" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option v-for="option in loginKindOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="id">
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="类型" width="96">
        <template #default="{ row }">
          <el-tag :type="loginKindTag(row.kind)" disable-transitions>{{ loginKindName(row.kind) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账号" min-width="150">
        <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
      </el-table-column>
      <el-table-column label="IP" min-width="140" show-overflow-tooltip>
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

<script setup lang="ts">
import { onMounted } from 'vue'
import type { ClubRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { formatNumber } from '../utils/format'
import { formatTime } from '../utils/time'

// 俱乐部: GET /api/admin/clubs. 等级 is the 总部 level; 赛事中心, 车手中心
// and 银行 are the other facility levels (CLUB.md). Sort keys: createdAt
// (default), name, members, cs, csWeek, budget (not the levels).

const table = usePagedTable<ClubRow>('/api/admin/clubs')
useTab('clubs', () => table.load())
onMounted(() => table.load())
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="俱乐部名称 / 会长" range="创建时间" />
    <DataTable :table="table" row-key="id">
      <el-table-column label="ID" width="80">
        <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          {{ row.name }}
          <el-tag v-if="row.breakAt" type="danger" size="small" disable-transitions>解散中</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="会长" min-width="140">
        <template #default="{ row }"><AccountName :nickname="row.masterNickname" :username="row.masterUsername" /></template>
      </el-table-column>
      <el-table-column label="等级" width="80" align="right">
        <template #default="{ row }">Lv.{{ row.hq }}</template>
      </el-table-column>
      <el-table-column prop="members" label="人数" width="90" align="right" sortable="custom">
        <template #default="{ row }">{{ formatNumber(row.members) }}</template>
      </el-table-column>
      <el-table-column label="赛事中心" width="90" align="right">
        <template #default="{ row }">Lv.{{ row.racing }}</template>
      </el-table-column>
      <el-table-column label="车手中心" width="90" align="right">
        <template #default="{ row }">Lv.{{ row.rider }}</template>
      </el-table-column>
      <el-table-column label="银行" width="80" align="right">
        <template #default="{ row }">Lv.{{ row.bank }}</template>
      </el-table-column>
      <el-table-column prop="budget" label="预算" width="130" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.budget) }}</span></template>
      </el-table-column>
      <el-table-column prop="cs" label="活跃度" width="110" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.cs) }}</span></template>
      </el-table-column>
      <el-table-column prop="csWeek" label="周活跃度" width="110" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.csWeek) }}</span></template>
      </el-table-column>
      <el-table-column label="自动加入" width="90">
        <template #default="{ row }">{{ row.autoJoin ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="解散时间" width="175">
        <template #default="{ row }">{{ formatTime(row.breakAt) }}</template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

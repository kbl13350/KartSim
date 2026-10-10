<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ClubRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import ClubMembersDialog from '../components/ClubMembersDialog.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { clubState, clubStateOptions, formatNumber } from '../utils/format'
import { formatTime } from '../utils/time'

// 俱乐部: GET /api/admin/clubs. 等级 is the 总部 level; 赛事中心, 车手中心
// and 银行 are the other facility levels (CLUB.md). Sort keys: createdAt
// (default), name, members, cs, csWeek, budget (not the levels). state:
// active, breaking (解散倒计时中) or disbanded (break_at passed, row not yet
// swept); all by default. 成员 opens the paged member list.

const table = usePagedTable<ClubRow, { state: string }>('/api/admin/clubs', { filters: { state: '' } })
useTab('clubs', () => table.load())
onMounted(() => table.load())

const membersOpen = ref(false)
const membersClub = ref<ClubRow | null>(null)

function showMembers(row: ClubRow) {
  membersClub.value = row
  membersOpen.value = true
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="俱乐部名称 / 会长" range="创建时间">
      <el-form-item label="状态">
        <el-select v-model="table.filters.state" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option v-for="option in clubStateOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="id">
      <el-table-column label="ID" width="80">
        <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">{{ row.name }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="clubState(row.state).type" disable-transitions>{{ clubState(row.state).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="会长" min-width="140">
        <template #default="{ row }"><AccountName :nickname="row.masterNickname" :username="row.masterUsername" /></template>
      </el-table-column>
      <el-table-column label="等级" width="80" align="right">
        <template #default="{ row }">Lv.{{ row.hq }}</template>
      </el-table-column>
      <el-table-column prop="members" label="人数" width="90" align="right" sortable="custom">
        <template #default="{ row }">
          <el-link type="primary" underline="never" @click="showMembers(row)">{{ formatNumber(row.members) }}</el-link>
        </template>
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
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="showMembers(row)">成员</el-button>
        </template>
      </el-table-column>
    </DataTable>
    <ClubMembersDialog v-model="membersOpen" :club="membersClub" />
  </el-card>
</template>

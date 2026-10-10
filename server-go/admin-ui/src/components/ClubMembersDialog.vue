<script setup lang="ts">
import { watch } from 'vue'
import type { ClubMemberRow, ClubRow } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { usePagedTable } from '../composables/usePagedTable'
import { clubGradeName, formatNumber } from '../utils/format'
import { formatTime } from '../utils/time'
import AccountName from './AccountName.vue'
import DataTable from './DataTable.vue'
import TableToolbar from './TableToolbar.vue'

// 俱乐部成员: GET /api/admin/clubs/{id}/members (paged; q matches the
// username and nickname, from/to bound the join time; sort joinedAt
// (default), grade, csWeek, csTotal, donatedTotal).

const props = defineProps<{ club: ClubRow | null }>()
const open = defineModel<boolean>({ required: true })
const narrow = useNarrow()

const table = usePagedTable<ClubMemberRow>(
  () => `/api/admin/clubs/${encodeURIComponent(String(props.club?.id ?? ''))}/members`,
  { ready: () => !!props.club })

// Each opening starts on page 1 of the club's members with no search, and
// with no rows of the previously shown club.
watch(open, (value) => {
  if (!value || !props.club) return
  table.clear()
  table.reset()
})
</script>

<template>
  <el-dialog
    v-model="open"
    :title="club ? `俱乐部成员 · ${club.name}` : '俱乐部成员'"
    :width="narrow ? '96%' : '900px'"
    append-to-body
  >
    <TableToolbar :table="table" keyword="账号 / 昵称" range="加入时间">
      <template #actions><span class="muted count">共 {{ formatNumber(table.total) }} 人</span></template>
    </TableToolbar>
    <DataTable :table="table" size="small" row-key="accountId" empty-text="没有成员">
      <el-table-column label="成员" min-width="160">
        <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
      </el-table-column>
      <el-table-column prop="grade" label="职位" width="110" sortable="custom">
        <template #default="{ row }">{{ clubGradeName(row.grade) }}</template>
      </el-table-column>
      <el-table-column prop="joinedAt" label="加入时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.joinedAt) }}</template>
      </el-table-column>
      <el-table-column prop="csWeek" label="本周活跃度" width="120" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.csWeek) }}</span></template>
      </el-table-column>
      <el-table-column prop="csTotal" label="累计活跃度" width="120" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.csTotal) }}</span></template>
      </el-table-column>
      <el-table-column prop="donatedTotal" label="累计捐助" width="120" align="right" sortable="custom">
        <template #default="{ row }"><span class="num">{{ formatNumber(row.donatedTotal) }}</span></template>
      </el-table-column>
    </DataTable>
  </el-dialog>
</template>

<style scoped>
.count {
  line-height: 32px;
}
</style>

<script setup lang="ts">
import { onMounted } from 'vue'
import type { RaceParticipantRow, RaceRow } from '../api/types'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { isAsciiToken } from '../utils/filters'
import { formatNumber, gameplayName, gameplayOptions, text } from '../utils/format'
import { formatElapsed, formatTime } from '../utils/time'

// 比赛记录: GET /api/admin/races (one row per settled race with its
// participants by rank; gameplay, track, account, from/to). The track filter
// is a track id (printable ASCII), not the Chinese title.

const table = usePagedTable<RaceRow, { account: string; gameplay: string; track: string }>(
  '/api/admin/races', {
    filters: { account: '', gameplay: '', track: '' },
    validate: ({ track }) => (track && !isAsciiToken(track, 64)
      ? '赛道须填赛道 ID（英文，如 village_R01），最多 64 个字符，不含空格'
      : ''),
  })
useTab('races', () => table.load())
onMounted(() => table.load())

function winner(row: RaceRow) {
  const first = row.participants?.[0]
  return first ? first.name || first.username || '—' : '—'
}

function hasReward(participants: RaceParticipantRow[] | null | undefined, key: 'lucci' | 'exp') {
  return !!participants?.some((p) => typeof p[key] === 'number')
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" range="时间">
      <el-form-item label="账号">
        <el-input v-model="table.filters.account" maxlength="24" clearable placeholder="用户名" class="filter-input" />
      </el-form-item>
      <el-form-item label="玩法">
        <el-select v-model="table.filters.gameplay" clearable placeholder="全部" class="filter-select" @change="table.search()">
          <el-option v-for="option in gameplayOptions" :key="option.value" :value="option.value" :label="option.label" />
        </el-select>
      </el-form-item>
      <el-form-item label="赛道">
        <el-input v-model="table.filters.track" maxlength="64" clearable placeholder="赛道 ID（英文）" class="filter-input" />
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="raceId">
      <el-table-column type="expand" width="44">
        <template #default="{ row }">
          <div class="participants">
            <el-table :data="row.participants ?? []" size="small" border empty-text="没有参赛者记录">
              <el-table-column label="名次" width="70" align="right">
                <template #default="{ row: p }">{{ text(p.rank) }}</template>
              </el-table-column>
              <el-table-column label="车手" min-width="140">
                <template #default="{ row: p }">{{ text(p.name) }}</template>
              </el-table-column>
              <el-table-column label="账号" min-width="130">
                <template #default="{ row: p }">
                  <span v-if="p.username">{{ p.username }}</span>
                  <el-tag v-else size="small" type="info" disable-transitions>游客</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="成绩" width="120" align="right">
                <template #default="{ row: p }"><span class="num">{{ formatElapsed(p.elapsedMs) }}</span></template>
              </el-table-column>
              <el-table-column label="积分" width="90" align="right">
                <template #default="{ row: p }">{{ formatNumber(p.points) }}</template>
              </el-table-column>
              <el-table-column v-if="hasReward(row.participants, 'exp')" label="经验奖励" width="100" align="right">
                <template #default="{ row: p }">{{ formatNumber(p.exp) }}</template>
              </el-table-column>
              <el-table-column v-if="hasReward(row.participants, 'lucci')" label="金币奖励" width="100" align="right">
                <template #default="{ row: p }">{{ formatNumber(p.lucci) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="at" label="时间" width="175" sortable="custom">
        <template #default="{ row }">{{ formatTime(row.at) }}</template>
      </el-table-column>
      <el-table-column label="玩法" width="80">
        <template #default="{ row }"><el-tag type="info" disable-transitions>{{ gameplayName(row.gameplay) }}</el-tag></template>
      </el-table-column>
      <el-table-column label="赛道" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.trackName || text(row.trackId) }}
          <span v-if="row.trackName && row.trackId" class="muted mono">{{ row.trackId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="人数" width="70" align="right">
        <template #default="{ row }">{{ formatNumber(row.players ?? row.participants?.length) }}</template>
      </el-table-column>
      <el-table-column label="第一名" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ winner(row) }}</template>
      </el-table-column>
      <el-table-column label="最好成绩" width="110" align="right">
        <template #default="{ row }"><span class="num">{{ formatElapsed(row.participants?.[0]?.elapsedMs) }}</span></template>
      </el-table-column>
      <el-table-column label="房间" width="90">
        <template #default="{ row }">{{ text(row.roomId) }}</template>
      </el-table-column>
      <el-table-column label="比赛 ID" min-width="180" show-overflow-tooltip>
        <template #default="{ row }"><span class="mono muted">{{ row.raceId }}</span></template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

<style scoped>
.participants {
  padding: 4px 16px 8px 48px;
}
@media (max-width: 640px) {
  .participants {
    padding: 4px 8px 8px;
  }
}
</style>

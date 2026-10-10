<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AccountGame } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { clubGradeName, formatNumber, licenseLevelName, text } from '../utils/format'
import { formatElapsed, formatTime } from '../utils/time'

// 游戏数据 of the account drawer (GET /api/admin/accounts/{id}/game): race
// stats, the rider school license, friends and club up top; the lists
// (time attack bests, license steps and PRO qualification times, quests,
// career counters) one at a time below. The lists are short, so they sort
// in the browser.

const props = defineProps<{ data: AccountGame | null; loading: boolean; failure: string }>()
const emit = defineEmits<{ retry: [] }>()
const narrow = useNarrow(1000)

type List = 'timeAttack' | 'licenseClears' | 'licenseRecords' | 'quests' | 'counters'
const list = ref<List>('timeAttack')

const lists = computed(() => {
  const data = props.data
  return [
    { name: 'timeAttack' as const, label: '计时赛最佳', count: data?.timeAttack?.length ?? 0 },
    { name: 'licenseClears' as const, label: '驾照步骤', count: data?.licenseClears?.length ?? 0 },
    { name: 'licenseRecords' as const, label: 'PRO 资格成绩', count: data?.licenseRecords?.length ?? 0 },
    { name: 'quests' as const, label: '任务进度', count: data?.quests?.length ?? 0 },
    { name: 'counters' as const, label: '生涯计数', count: data?.counters?.length ?? 0 },
  ]
})

const proText = computed(() => {
  const license = props.data?.license
  if (!license?.proUntil) return '—'
  return license.proUntil > Date.now() ? `至 ${formatTime(license.proUntil)}` : `已于 ${formatTime(license.proUntil)} 到期`
})
</script>

<template>
  <div v-loading="loading && !data" class="game-data">
    <el-result v-if="failure && !data" icon="error" title="加载失败" :sub-title="failure">
      <template #extra><el-button type="primary" @click="emit('retry')">重试</el-button></template>
    </el-result>
    <template v-if="data">
      <el-descriptions title="比赛" :column="narrow ? 2 : 4" border size="small" class="block">
        <el-descriptions-item label="比赛场次">{{ data.stats ? formatNumber(data.stats.races) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="冠军">{{ data.stats ? formatNumber(data.stats.wins) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="前三名">{{ data.stats ? formatNumber(data.stats.podiums) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="积分">{{ data.stats ? formatNumber(data.stats.points) : '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-descriptions title="驾照" :column="narrow ? 2 : 4" border size="small" class="block">
        <el-descriptions-item label="驾照">{{ data.license ? licenseLevelName(data.license.level) : '无' }}</el-descriptions-item>
        <el-descriptions-item label="PRO 有效期">{{ proText }}</el-descriptions-item>
        <el-descriptions-item label="PRO 取得次数">{{ data.license ? formatNumber(data.license.proCount) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="最后考试">{{ formatTime(data.license?.lastRunAt) }}</el-descriptions-item>
      </el-descriptions>
      <el-descriptions title="社交" :column="narrow ? 1 : 3" border size="small" class="block">
        <el-descriptions-item label="好友数">{{ formatNumber(data.friends) }}</el-descriptions-item>
        <el-descriptions-item label="俱乐部">
          <template v-if="data.club">
            {{ data.club.name }}（{{ clubGradeName(data.club.grade) }}）<span class="muted mono">#{{ data.club.id }}</span>
          </template>
          <template v-else>—</template>
        </el-descriptions-item>
        <el-descriptions-item label="加入时间">{{ formatTime(data.club?.joinedAt) }}</el-descriptions-item>
        <el-descriptions-item label="本周活跃度">{{ data.club ? formatNumber(data.club.csWeek) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="累计活跃度">{{ data.club ? formatNumber(data.club.csTotal) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="累计捐助">{{ data.club ? formatNumber(data.club.donatedTotal) : '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-radio-group v-model="list" size="small" class="lists">
        <el-radio-button v-for="entry in lists" :key="entry.name" :value="entry.name">
          {{ entry.label }}（{{ entry.count }}）
        </el-radio-button>
      </el-radio-group>

      <el-table
        v-if="list === 'timeAttack'"
        :data="data.timeAttack ?? []"
        border
        stripe
        size="small"
        :default-sort="{ prop: 'updatedAt', order: 'descending' }"
        empty-text="没有计时赛成绩"
      >
        <el-table-column prop="trackName" label="赛道" min-width="200" sortable show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.trackName || text(row.trackId) }}
            <span v-if="row.trackName && row.trackId" class="muted mono">{{ row.trackId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="bestMs" label="最佳成绩" width="120" align="right" sortable>
          <template #default="{ row }"><span class="num">{{ formatElapsed(row.bestMs) }}</span></template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="175" sortable>
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>

      <el-table
        v-else-if="list === 'licenseClears'"
        :data="data.licenseClears ?? []"
        border
        stripe
        size="small"
        :default-sort="{ prop: 'step', order: 'ascending' }"
        empty-text="没有通过的驾照步骤"
      >
        <el-table-column prop="step" label="步骤" width="90" align="right" sortable />
        <el-table-column label="PRO 周期" min-width="120">
          <template #default="{ row }">{{ row.period || '—' }}</template>
        </el-table-column>
        <el-table-column prop="bestMs" label="最佳成绩" width="120" align="right" sortable>
          <template #default="{ row }"><span class="num">{{ formatElapsed(row.bestMs) }}</span></template>
        </el-table-column>
        <el-table-column prop="clearedAt" label="通过时间" width="175" sortable>
          <template #default="{ row }">{{ formatTime(row.clearedAt) }}</template>
        </el-table-column>
      </el-table>

      <el-table
        v-else-if="list === 'licenseRecords'"
        :data="data.licenseRecords ?? []"
        border
        stripe
        size="small"
        :default-sort="{ prop: 'updatedAt', order: 'descending' }"
        empty-text="没有 PRO 资格成绩"
      >
        <el-table-column prop="trackName" label="赛道" min-width="200" sortable show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.trackName || text(row.trackId) }}
            <span v-if="row.trackName && row.trackId" class="muted mono">{{ row.trackId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="bestMs" label="最佳成绩" width="120" align="right" sortable>
          <template #default="{ row }"><span class="num">{{ formatElapsed(row.bestMs) }}</span></template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="175" sortable>
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>

      <el-table
        v-else-if="list === 'quests'"
        :data="data.quests ?? []"
        border
        stripe
        size="small"
        :default-sort="{ prop: 'updatedAt', order: 'descending' }"
        empty-text="没有任务进度"
      >
        <el-table-column prop="title" label="任务" min-width="200" sortable show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.title || `任务 ${row.questId}` }}
            <span class="muted mono">#{{ row.questId }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="period" label="周期" min-width="110" sortable>
          <template #default="{ row }">{{ row.period || '一次性' }}</template>
        </el-table-column>
        <el-table-column prop="value" label="进度" width="100" align="right" sortable>
          <template #default="{ row }">{{ formatNumber(row.value) }}</template>
        </el-table-column>
        <el-table-column prop="completedAt" label="完成时间" width="175" sortable>
          <template #default="{ row }">
            <span v-if="row.completedAt">{{ formatTime(row.completedAt) }}</span>
            <span v-else class="muted">未完成</span>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="175" sortable>
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>

      <el-table
        v-else
        :data="data.counters ?? []"
        border
        stripe
        size="small"
        :default-sort="{ prop: 'counter', order: 'ascending' }"
        empty-text="没有生涯计数"
      >
        <el-table-column prop="counter" label="计数" min-width="200" sortable show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.counter }}</span></template>
        </el-table-column>
        <el-table-column prop="value" label="数值" width="140" align="right" sortable>
          <template #default="{ row }"><span class="num">{{ formatNumber(row.value) }}</span></template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="175" sortable>
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<style scoped>
.game-data {
  min-height: 160px;
}
.block {
  margin-bottom: 16px;
}
.block :deep(.el-descriptions__header) {
  margin-bottom: 8px;
}
.block :deep(.el-descriptions__title) {
  font-size: 14px;
}
.lists {
  flex-wrap: wrap;
  row-gap: 4px;
  margin-bottom: 12px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>

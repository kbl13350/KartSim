<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { NodeRow, NodesResponse, ProbeStatus } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { useTab } from '../composables/useTabs'
import { formatNumber, text, type TagType } from '../utils/format'
import { formatAgo, formatDuration, formatTime } from '../utils/time'
import { showError } from '../utils/ui'

// 服务器节点: GET /api/admin/nodes. Refreshes every 5 seconds while this tab
// is on screen; relative times use the server's `now`.

const INTERVAL = 5000
const data = ref<NodesResponse | null>(null)
const loading = ref(false)
const failure = ref('')
const auto = ref(true)
const narrow = useNarrow()
let timer: ReturnType<typeof setInterval> | undefined

async function load(silent = false) {
  if (silent && loading.value) return
  loading.value = true
  try {
    data.value = await api.get<NodesResponse>('/api/admin/nodes')
    failure.value = ''
  } catch (error) {
    failure.value = errorMessage(error)
    if (!silent) showError(error)
  } finally {
    loading.value = false
  }
}

const { active } = useTab('nodes', () => load())

function stop() {
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
}

watch([active, auto], ([isActive, isAuto], previous) => {
  stop()
  if (!isActive) return
  // Opening (or coming back to) the tab loads at once.
  if (!previous || !previous[0]) void load()
  if (isAuto) timer = setInterval(() => void load(true), INTERVAL)
}, { immediate: true })
onBeforeUnmount(stop)

const statusTags: Record<string, { type: TagType; label: string }> = {
  ok: { type: 'success', label: '正常' },
  stale: { type: 'danger', label: '超时' },
  full: { type: 'warning', label: '满员' },
}

function status(row: NodeRow) {
  return statusTags[row.status] ?? { type: 'info' as TagType, label: row.status || '—' }
}

function usage(row: NodeRow) {
  return row.capacity > 0 ? Math.min(100, Math.round((row.players / row.capacity) * 100)) : 0
}

function usageColor(row: NodeRow) {
  const value = usage(row)
  if (value >= 90) return 'var(--el-color-danger)'
  if (value >= 70) return 'var(--el-color-warning)'
  return 'var(--el-color-success)'
}

function probe(value: ProbeStatus | null | undefined) {
  if (!value) return { type: 'info' as TagType, label: '未知' }
  return value.ok ? { type: 'success' as TagType, label: '正常' } : { type: 'danger' as TagType, label: '异常' }
}
</script>

<template>
  <div>
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-head">
          <span>数据服务</span>
          <div class="card-tools">
            <span class="muted small">{{ data ? `更新于 ${formatTime(data.now)}` : '' }}</span>
            <el-switch v-model="auto" active-text="每 5 秒自动刷新" />
            <el-button :icon="Refresh" :loading="loading" size="small" @click="load()">刷新</el-button>
          </div>
        </div>
      </template>
      <el-alert v-if="failure" type="error" :title="`加载失败：${failure}`" :closable="false" show-icon class="alert" />
      <el-descriptions v-if="data?.data" :column="narrow ? 1 : 3" border size="small" class="service">
        <el-descriptions-item label="版本">{{ text(data.data.version) }}</el-descriptions-item>
        <el-descriptions-item label="Go 版本">{{ text(data.data.goVersion) }}</el-descriptions-item>
        <el-descriptions-item label="启动时间">
          {{ formatTime(data.data.startedAt) }}
          <span class="muted">（已运行 {{ formatDuration(data.now - data.data.startedAt) }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="内存">{{ data.data.heapMB != null ? `${formatNumber(data.data.heapMB)} MB` : '—' }}</el-descriptions-item>
        <el-descriptions-item label="协程数">{{ formatNumber(data.data.goroutines) }}</el-descriptions-item>
        <el-descriptions-item label="数据库 / Redis">
          <div class="probes">
            <span>
              MySQL <el-tag size="small" :type="probe(data.data.mysql).type" disable-transitions>{{ probe(data.data.mysql).label }}</el-tag>
              <span v-if="data.data.mysql?.latencyMs != null" class="muted"> {{ data.data.mysql.latencyMs }} ms</span>
              <span v-if="data.data.mysql?.error" class="error-text"> {{ data.data.mysql.error }}</span>
            </span>
            <span>
              Redis <el-tag size="small" :type="probe(data.data.redis).type" disable-transitions>{{ probe(data.data.redis).label }}</el-tag>
              <span v-if="data.data.redis?.latencyMs != null" class="muted"> {{ data.data.redis.latencyMs }} ms</span>
              <span v-if="data.data.redis?.error" class="error-text"> {{ data.data.redis.error }}</span>
            </span>
          </div>
        </el-descriptions-item>
      </el-descriptions>
      <el-skeleton v-else-if="loading" :rows="2" animated />
    </el-card>

    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-head">
          <span>游戏节点（{{ data?.nodes?.length ?? 0 }}）</span>
        </div>
      </template>
      <el-table v-loading="loading && !data" :data="data?.nodes ?? []" border stripe row-key="nodeId" empty-text="没有已注册的游戏节点">
        <el-table-column label="节点" min-width="170" fixed="left">
          <template #default="{ row }">
            <div>{{ row.name || row.nodeId }}</div>
            <div class="muted mono">{{ row.nodeId }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="status(row).type" disable-transitions>{{ status(row).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="地址" min-width="200" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ text(row.origin) }}</span></template>
        </el-table-column>
        <el-table-column label="玩家 / 容量" width="190">
          <template #default="{ row }">
            <el-progress :percentage="usage(row)" :color="usageColor(row)" :stroke-width="14" :text-inside="true" :format="() => `${row.players}/${row.capacity}`" />
          </template>
        </el-table-column>
        <el-table-column label="房间" width="70" align="right">
          <template #default="{ row }">{{ formatNumber(row.rooms) }}</template>
        </el-table-column>
        <el-table-column label="启动时间 / 运行时长" width="190">
          <template #default="{ row }">
            <div>{{ formatTime(row.startedAt) }}</div>
            <div class="muted">已运行 {{ row.startedAt ? formatDuration((data?.now ?? Date.now()) - row.startedAt) : '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="最后心跳" width="170">
          <template #default="{ row }">
            <div>{{ formatAgo(data?.now ?? Date.now(), row.seenAt) }}</div>
            <div class="muted small">{{ formatTime(row.seenAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="协议" width="70" align="right">
          <template #default="{ row }">{{ text(row.protocolVersion) }}</template>
        </el-table-column>
        <el-table-column label="内存" width="90" align="right">
          <template #default="{ row }">{{ row.stats?.heapMB != null ? `${formatNumber(row.stats.heapMB)} MB` : '—' }}</template>
        </el-table-column>
        <el-table-column label="协程" width="80" align="right">
          <template #default="{ row }">{{ formatNumber(row.stats?.goroutines) }}</template>
        </el-table-column>
        <el-table-column label="连接" width="70" align="right">
          <template #default="{ row }">{{ formatNumber(row.stats?.connections) }}</template>
        </el-table-column>
        <el-table-column label="进行中比赛" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.stats?.races) }}</template>
        </el-table-column>
        <el-table-column label="节点版本" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ text(row.stats?.version) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.card-tools {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.small {
  font-size: 12px;
}
.alert {
  margin-bottom: 12px;
}
.probes {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>

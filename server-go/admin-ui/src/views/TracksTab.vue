<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { TrackDirectory, ManagedTrack } from '../api/types'
import { useTab } from '../composables/useTabs'
import { useNarrow } from '../composables/useNarrow'
import { confirmAction, showError } from '../utils/ui'

const directory = ref<TrackDirectory>({ tracks: [], themes: [], version: '', updatedAt: 0 })
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const busy = ref('')
const theme = ref('')
const state = ref('')
const query = ref('')
const page = ref(1)
const pageSize = ref(20)
const narrow = useNarrow()
let sequence = 0

const enabledCount = computed(() => directory.value.tracks.filter(track => track.enabled).length)
const selectedTheme = computed(() => directory.value.themes.find(item => item.id === theme.value))
const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return directory.value.tracks.filter(track =>
    (!theme.value || track.theme === theme.value) &&
    (!state.value || track.enabled === (state.value === 'enabled')) &&
    (!term || [track.title, track.id, track.theme, track.themeTitle, ...track.aliases]
      .some(text => text.toLocaleLowerCase().includes(term))))
})
const rows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([theme, state, query, pageSize], () => { page.value = 1 })
watch(() => filtered.value.length, count => {
  page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize.value)))
})

async function load() {
  if (busy.value) return
  const request = ++sequence
  loading.value = true
  try {
    const result = await api.get<TrackDirectory>('/api/admin/tracks')
    if (request !== sequence) return
    directory.value = result
    error.value = ''
  } catch (cause) {
    if (request === sequence) error.value = errorMessage(cause)
  } finally {
    if (request === sequence) {
      loading.value = false
      loaded.value = true
    }
  }
}
useTab('tracks', () => { void load() })
onMounted(() => { void load() })

async function update(path: string, enabled: boolean, key: string, label: string) {
  if (busy.value || loading.value) return
  busy.value = key
  ++sequence
  try {
    directory.value = await api.patch<TrackDirectory>(path, { enabled })
    error.value = ''
    ElMessage.success(`已${enabled ? '开启' : '关闭'}${label}`)
  } catch (cause) {
    showError(cause)
  } finally {
    busy.value = ''
  }
}

function setTrack(track: ManagedTrack, enabled: boolean) {
  return update(`/api/admin/tracks/${encodeURIComponent(track.id)}`, enabled, track.id, `：${track.title}`)
}

async function setTheme(enabled: boolean) {
  const selected = selectedTheme.value
  if (!selected || busy.value || loading.value) return
  const action = enabled ? '开启' : '关闭'
  if (!await confirmAction(`${action}“${selected.title}”主题的全部 ${selected.total} 张地图？此操作包含当前搜索和状态筛选之外的地图。`,
    `${action}主题地图`, { type: enabled ? 'info' : 'warning', confirmText: `全部${action}` })) return
  await update(`/api/admin/track-themes/${encodeURIComponent(selected.id)}`, enabled, `theme:${selected.id}`, `“${selected.title}”主题的全部地图`)
}

function reset() {
  theme.value = ''
  state.value = ''
  query.value = ''
  page.value = 1
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <p class="page-note">按主题管理游戏内的地图。关闭后，地图将从玩家的选图列表、收藏选图和随机选图中隐藏，重新打开选图界面时生效；已有比赛和历史回放保留。同一地图的别名同步开关。</p>
    <div class="summary" aria-label="地图状态统计">
      <span>共 <strong>{{ directory.tracks.length }}</strong> 张地图</span>
      <span><strong>{{ directory.themes.length }}</strong> 个主题</span>
      <el-tag type="success" disable-transitions>已开启 {{ enabledCount }}</el-tag>
      <el-tag type="info" disable-transitions>已关闭 {{ directory.tracks.length - enabledCount }}</el-tag>
    </div>
    <el-form class="toolbar" inline @submit.prevent>
      <el-form-item label="主题分类">
        <el-select v-model="theme" filterable clearable placeholder="全部主题" class="theme-select" aria-label="主题分类">
          <el-option v-for="item in directory.themes" :key="item.id" :value="item.id"
            :label="`${item.title} · ${item.enabledCount}/${item.total} 已开启`" />
        </el-select>
      </el-form-item>
      <el-form-item label="显示状态">
        <el-select v-model="state" clearable placeholder="全部状态" class="state-select" aria-label="显示状态">
          <el-option value="enabled" label="已开启" />
          <el-option value="disabled" label="已关闭" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-input v-model="query" :prefix-icon="Search" placeholder="地图名称 / ID / 主题" clearable class="keyword" aria-label="搜索地图" />
      </el-form-item>
      <el-form-item>
        <el-button @click="reset">重置</el-button>
        <el-button :icon="Refresh" :loading="loading" :disabled="!!busy" @click="load">刷新</el-button>
      </el-form-item>
    </el-form>
    <div v-if="selectedTheme" class="theme-actions">
      <span><strong>{{ selectedTheme.title }}</strong>：{{ selectedTheme.enabledCount }} / {{ selectedTheme.total }} 张已开启</span>
      <el-button size="small" type="success" plain :disabled="!!busy || loading || selectedTheme.enabledCount === selectedTheme.total" @click="setTheme(true)">开启整个主题</el-button>
      <el-button size="small" type="warning" plain :disabled="!!busy || loading || selectedTheme.enabledCount === 0" @click="setTheme(false)">关闭整个主题</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="load-error">
      <el-button link type="primary" @click="load">重新加载</el-button>
    </el-alert>
    <el-table v-loading="loading" :data="rows" row-key="id" border stripe style="width: 100%">
      <el-table-column label="地图名称" min-width="230">
        <template #default="{ row }">
          {{ row.title }}
          <div class="muted mono">{{ row.id }}</div>
          <el-tooltip v-if="row.aliases.length" :content="`这些别名与此地图同步开关：${row.aliases.join('、')}`" placement="top">
            <span class="alias-note muted">同图别名 {{ row.aliases.length }} 个</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="主题分类" min-width="120">
        <template #default="{ row }"><el-link type="primary" underline="never" @click="theme = row.theme">{{ row.themeTitle }}</el-link></template>
      </el-table-column>
      <el-table-column label="模式" width="85"><template #default="{ row }">{{ row.gameType === 'item' ? '道具' : '竞速' }}</template></el-table-column>
      <el-table-column label="方向" width="85"><template #default="{ row }">{{ row.reverse ? '反向' : '正向' }}</template></el-table-column>
      <el-table-column label="显示状态" width="105">
        <template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" disable-transitions>{{ row.enabled ? '已开启' : '已关闭' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="地图开关" width="130" fixed="right">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" :loading="busy === row.id" :disabled="!!busy || loading"
            :aria-label="`${row.title}地图显示开关`" active-text="开" inactive-text="关" inline-prompt
            @change="(value: string | number | boolean) => setTrack(row, value === true)" />
        </template>
      </el-table-column>
      <template #empty><el-empty :description="!loaded ? '加载中…' : error ? '地图目录加载失败' : '没有符合筛选条件的地图'" :image-size="72" /></template>
    </el-table>
    <div class="pager">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="filtered.length"
        :layout="narrow ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'" :pager-count="narrow ? 5 : 7" background />
    </div>
  </el-card>
</template>

<style scoped>
.summary, .theme-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 18px; }
.summary strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.toolbar { display: flex; flex-wrap: wrap; }
.toolbar :deep(.el-form-item) { margin-right: 12px; margin-bottom: 12px; }
.theme-select { width: 255px; }
.state-select { width: 135px; }
.keyword { width: 260px; }
.theme-actions { padding: 12px; background: var(--el-fill-color-light); border-radius: 4px; }
.alias-note { display: inline-block; font-size: 12px; border-bottom: 1px dotted var(--el-text-color-secondary); }
.load-error { margin-bottom: 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 12px; overflow-x: auto; }
@media (max-width: 640px) {
  .toolbar :deep(.el-form-item) { width: 100%; margin-right: 0; }
  .toolbar :deep(.el-form-item__content) { flex: 1; min-width: 0; }
  .theme-select, .state-select, .keyword { width: 100%; }
}
</style>

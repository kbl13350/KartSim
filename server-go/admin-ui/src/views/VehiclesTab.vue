<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { VehicleDirectory, ManagedVehicle } from '../api/types'
import { useTab } from '../composables/useTabs'
import { useNarrow } from '../composables/useNarrow'
import { confirmAction, showError } from '../utils/ui'
import VehiclePreview from '../components/VehiclePreview.vue'

const directory = ref<VehicleDirectory>({ vehicles: [], categories: [], version: '', updatedAt: 0 })
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const busy = ref('')
const category = ref('')
const engine = ref('')
const state = ref('')
const query = ref('')
const page = ref(1)
const pageSize = ref(20)
const narrow = useNarrow()
let sequence = 0

const enabledCount = computed(() => directory.value.vehicles.filter(vehicle => vehicle.enabled).length)
const selectedCategory = computed(() => directory.value.categories.find(item => item.id === category.value))
const engines = computed(() => [...new Map(directory.value.vehicles.map(vehicle =>
  [vehicle.engineTitle, vehicle.engineGrade ?? -1] as const)).entries()]
  .sort((a, b) => b[1] - a[1]).map(([title]) => title))
const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return directory.value.vehicles.filter(vehicle =>
    (!category.value || vehicle.category === category.value) &&
    (!engine.value || vehicle.engineTitle === engine.value) &&
    (!state.value || vehicle.enabled === (state.value === 'enabled')) &&
    (!term || [vehicle.title, vehicle.id, vehicle.category, vehicle.categoryTitle, vehicle.internalId, vehicle.engineTitle]
      .some(text => text.toLocaleLowerCase().includes(term))))
})
const rows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([category, engine, state, query, pageSize], () => { page.value = 1 })
watch(() => filtered.value.length, count => {
  page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize.value)))
})

async function load() {
  if (busy.value) return
  const request = ++sequence
  loading.value = true
  try {
    const result = await api.get<VehicleDirectory>('/api/admin/vehicles')
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
useTab('vehicles', () => { void load() })
onMounted(() => { void load() })

async function update(path: string, enabled: boolean, key: string, label: string) {
  if (busy.value || loading.value) return
  busy.value = key
  ++sequence
  try {
    directory.value = await api.patch<VehicleDirectory>(path, { enabled })
    error.value = ''
    ElMessage.success(`已${enabled ? '开启' : '关闭'}${label}`)
  } catch (cause) {
    showError(cause)
  } finally {
    busy.value = ''
  }
}

function setVehicle(vehicle: ManagedVehicle, enabled: boolean) {
  return update(`/api/admin/vehicles/${encodeURIComponent(vehicle.id)}`, enabled, vehicle.id, `：${vehicle.title}`)
}

async function setCategory(enabled: boolean) {
  const selected = selectedCategory.value
  if (!selected || busy.value || loading.value) return
  const action = enabled ? '开启' : '关闭'
  if (!await confirmAction(`${action}“${selected.title}”类别的全部 ${selected.total} 辆车？此操作包含当前搜索、引擎世代和状态筛选之外的车辆。`,
    `${action}类别车辆`, { type: enabled ? 'info' : 'warning', confirmText: `全部${action}` })) return
  await update(`/api/admin/vehicle-categories/${encodeURIComponent(selected.id)}`, enabled, `category:${selected.id}`, `“${selected.title}”类别的全部车辆`)
}

function reset() {
  category.value = ''
  engine.value = ''
  state.value = ''
  query.value = ''
  page.value = 1
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <p class="page-note">按分类和引擎世代管理车辆。关闭后，车辆将从车库、收藏、选车和商城的新选择中隐藏，重新打开界面时生效；已拥有的车辆、当前装备、进行中的比赛及历史回放保留。重新开启后恢复显示。</p>
    <div class="summary" aria-label="车辆状态统计">
      <span>共 <strong>{{ directory.vehicles.length }}</strong> 辆车</span>
      <span><strong>{{ directory.categories.length }}</strong> 个类别</span>
      <el-tag type="success" disable-transitions>已开启 {{ enabledCount }}</el-tag>
      <el-tag type="info" disable-transitions>已关闭 {{ directory.vehicles.length - enabledCount }}</el-tag>
    </div>
    <el-form class="toolbar" inline @submit.prevent>
      <el-form-item label="车辆分类">
        <el-select v-model="category" filterable clearable placeholder="全部分类" class="category-select" aria-label="车辆分类">
          <el-option v-for="item in directory.categories" :key="item.id" :value="item.id"
            :label="`${item.title} · ${item.enabledCount}/${item.total} 已开启`" />
        </el-select>
      </el-form-item>
      <el-form-item label="引擎世代">
        <el-select v-model="engine" clearable placeholder="全部世代" class="engine-select" aria-label="引擎世代">
          <el-option v-for="title in engines" :key="title" :value="title" :label="title" />
        </el-select>
      </el-form-item>
      <el-form-item label="显示状态">
        <el-select v-model="state" clearable placeholder="全部状态" class="state-select" aria-label="显示状态">
          <el-option value="enabled" label="已开启" />
          <el-option value="disabled" label="已关闭" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-input v-model="query" :prefix-icon="Search" placeholder="车辆名称 / ID / 型号" clearable class="keyword" aria-label="搜索车辆" />
      </el-form-item>
      <el-form-item>
        <el-button @click="reset">重置</el-button>
        <el-button :icon="Refresh" :loading="loading" :disabled="!!busy" @click="load">刷新</el-button>
      </el-form-item>
    </el-form>
    <div v-if="selectedCategory" class="category-actions">
      <span><strong>{{ selectedCategory.title }}</strong>：{{ selectedCategory.enabledCount }} / {{ selectedCategory.total }} 辆已开启</span>
      <el-button size="small" type="success" plain :disabled="!!busy || loading || selectedCategory.enabledCount === selectedCategory.total" @click="setCategory(true)">开启整个分类</el-button>
      <el-button size="small" type="warning" plain :disabled="!!busy || loading || selectedCategory.enabledCount === 0" @click="setCategory(false)">关闭整个分类</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="load-error">
      <el-button link type="primary" @click="load">重新加载</el-button>
    </el-alert>
    <el-table v-loading="loading" :data="rows" row-key="id" border stripe style="width: 100%">
      <el-table-column label="车辆预览 / 名称" :min-width="narrow ? 240 : 360">
        <template #default="{ row }">
          <div class="vehicle-cell">
            <VehiclePreview :id="row.id" :title="row.title" />
            <div class="vehicle-info">
              <div>{{ row.title }}</div>
              <div class="muted mono">{{ row.itemId ? `#${row.itemId}` : '系统车辆' }} · {{ row.internalId }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="车辆分类" min-width="120">
        <template #default="{ row }"><el-link type="primary" underline="never" @click="category = row.category">{{ row.categoryTitle }}</el-link></template>
      </el-table-column>
      <el-table-column label="引擎世代" min-width="140"><template #default="{ row }">{{ row.engineTitle }}</template></el-table-column>
      <el-table-column label="显示状态" width="105">
        <template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" disable-transitions>{{ row.enabled ? '已开启' : '已关闭' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="车辆开关" width="130" fixed="right">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" :loading="busy === row.id" :disabled="!!busy || loading"
            :aria-label="`${row.title}车辆显示开关`" active-text="开" inactive-text="关" inline-prompt
            @change="(value: string | number | boolean) => setVehicle(row, value === true)" />
        </template>
      </el-table-column>
      <template #empty><el-empty :description="!loaded ? '加载中…' : error ? '车辆目录加载失败' : '没有符合筛选条件的车辆'" :image-size="72" /></template>
    </el-table>
    <div class="pager">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 50, 100]" :total="filtered.length"
        :layout="narrow ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'" :pager-count="narrow ? 5 : 7" background />
    </div>
  </el-card>
</template>

<style scoped>
.summary, .category-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 18px; }
.summary strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.toolbar { display: flex; flex-wrap: wrap; }
.toolbar :deep(.el-form-item) { margin-right: 12px; margin-bottom: 12px; }
.category-select { width: 255px; }
.state-select { width: 135px; }
.engine-select { width: 165px; }
.keyword { width: 260px; }
.category-actions { padding: 12px; background: var(--el-fill-color-light); border-radius: 4px; }
.vehicle-cell { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
.vehicle-info { min-width: 0; overflow-wrap: anywhere; }
.load-error { margin-bottom: 12px; }
.pager { display: flex; justify-content: flex-end; margin-top: 12px; overflow-x: auto; }
@media (max-width: 640px) {
  .toolbar :deep(.el-form-item) { width: 100%; margin-right: 0; }
  .toolbar :deep(.el-form-item__content) { flex: 1; min-width: 0; }
  .category-select, .engine-select, .state-select, .keyword { width: 100%; }
  .vehicle-cell { flex-direction: column; align-items: flex-start; gap: 8px; }
}
</style>

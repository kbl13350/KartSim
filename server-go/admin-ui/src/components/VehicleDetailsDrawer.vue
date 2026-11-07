<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { ManagedVehicle, VehicleDetails, VehicleDetailField, VehicleOverrides } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { confirmAction } from '../utils/ui'
import { formatTime } from '../utils/time'
import VehiclePreview from './VehiclePreview.vue'

const props = defineProps<{ modelValue: boolean; vehicle?: ManagedVehicle }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [] }>()
const narrow = useNarrow()
const detail = ref<VehicleDetails>()
const draft = ref<VehicleOverrides>({ metadata: {}, profiles: {} })
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const speed = ref('7')
const tab = ref('physics')
const query = ref('')
const fieldErrors = ref<Record<string, string>>({})
let sequence = 0

const dirty = computed(() => !!detail.value && JSON.stringify(draft.value) !== JSON.stringify(detail.value.overrides))
const overrideCount = computed(() => Object.keys(draft.value.metadata).length +
  Object.values(draft.value.profiles).reduce((sum, profile) => sum + Object.keys(profile).length, 0))
const baseProfile = computed(() => ({ ...detail.value?.base.profiles['7'], ...detail.value?.base.profiles[speed.value] }))
const missingFields = computed(() => detail.value?.physicsFields.filter(field => value(field) === undefined) ?? [])
const groups = computed(() => {
  const term = query.value.trim().toLowerCase()
  const fields = detail.value?.physicsFields.filter(field => !term || `${field.label} ${field.key}`.toLowerCase().includes(term)) ?? []
  return ['车身与操控', '漂移与集气', '氮气与起步', '瞬间加速与充能', '槽位、零件与初始道具']
    .map(title => ({ title, fields: fields.filter(field => field.group === title) })).filter(group => group.fields.length)
})
const effectiveJSON = computed(() => JSON.stringify({
  identity: { ...detail.value?.base.identity, ...draft.value.metadata },
  profiles: Object.fromEntries(['7', '4'].map(profile => [profile, {
    ...detail.value?.base.profiles['7'], ...detail.value?.base.profiles[profile], ...draft.value.profiles[profile],
  }])),
}, null, 2))

function accept(result: VehicleDetails) {
  detail.value = result
  draft.value = structuredClone(result.overrides)
  fieldErrors.value = {}
  error.value = ''
}

async function load() {
  if (!props.vehicle || saving.value) return
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const result = await api.get<VehicleDetails>(`/api/admin/vehicles/${encodeURIComponent(props.vehicle.id)}/details`)
    if (current === sequence) accept(result)
  } catch (cause) {
    if (current === sequence) error.value = errorMessage(cause)
  } finally {
    if (current === sequence) loading.value = false
  }
}

watch(() => [props.modelValue, props.vehicle?.id] as const, ([open]) => {
  ++sequence
  if (!open) return
  detail.value = undefined
  draft.value = { metadata: {}, profiles: {} }
  speed.value = '7'
  query.value = ''
  tab.value = 'physics'
  void load()
}, { immediate: true })

function original(field: VehicleDetailField, metadata = false) {
  return metadata ? detail.value?.base.identity[field.key] : baseProfile.value[field.key]
}
function value(field: VehicleDetailField, metadata = false) {
  return (metadata ? draft.value.metadata[field.key] : draft.value.profiles[speed.value]?.[field.key]) ?? original(field, metadata)
}
function customized(field: VehicleDetailField, metadata = false) {
  return Object.hasOwn(metadata ? draft.value.metadata : draft.value.profiles[speed.value] ?? {}, field.key)
}
function fieldID(field: VehicleDetailField, metadata: boolean) {
  return `${metadata ? 'metadata' : speed.value}:${field.key}`
}
function resetField(field: VehicleDetailField, metadata = false) {
  if (metadata) delete draft.value.metadata[field.key]
  else {
    delete draft.value.profiles[speed.value]?.[field.key]
    if (!Object.keys(draft.value.profiles[speed.value] ?? {}).length) delete draft.value.profiles[speed.value]
  }
  delete fieldErrors.value[fieldID(field, metadata)]
}
function setField(field: VehicleDetailField, next: unknown, metadata = false) {
  const id = fieldID(field, metadata)
  if (field.type === 'number' && (typeof next !== 'number' || !Number.isFinite(next) ||
      next < (field.min ?? 0) || next > (field.max ?? Infinity) || (field.integer && !Number.isInteger(next)))) {
    fieldErrors.value[id] = `请输入${field.integer ? '整数' : '有效数值'}（${field.min ?? 0} 至 ${field.max}）`
    return
  }
  if (field.type === 'string' && (typeof next !== 'string' || next !== next.trim() ||
      [...next].length < (field.min ?? 1) || [...next].length > (field.max ?? 120) || /[<>\p{Cc}]/u.test(next))) {
    fieldErrors.value[id] = '名称须为 1–120 字，不能包含首尾空格、控制字符或尖括号'
    return
  }
  delete fieldErrors.value[id]
  if (next === original(field, metadata)) { resetField(field, metadata); return }
  if (metadata) draft.value.metadata[field.key] = next as string | number | boolean
  else (draft.value.profiles[speed.value] ??= {})[field.key] = next as number
}

async function save() {
  if (!detail.value || saving.value || !dirty.value || Object.keys(fieldErrors.value).length) return
  for (const profile of ['7', '4']) {
    const values = { ...detail.value.base.profiles['7'], ...detail.value.base.profiles[profile], ...draft.value.profiles[profile] }
    if (values.dualBoosterTickMin! > values.dualBoosterTickMax!) {
      error.value = `档位 ${profile}：双重氮气最小时长不能大于最大时长`
      return
    }
  }
  saving.value = true
  error.value = ''
  try {
    const result = await api.put<VehicleDetails>(`/api/admin/vehicles/${encodeURIComponent(detail.value.vehicle.id)}/details`, {
      version: detail.value.version, updatedAt: detail.value.updatedAt, overrides: draft.value,
    })
    accept(result)
    emit('saved')
    ElMessage.success('车辆数据已保存，下次加载车辆或比赛时生效')
  } catch (cause) { error.value = errorMessage(cause) }
  finally { saving.value = false }
}

async function beforeClose(done: () => void) {
  if (saving.value) return
  if (dirty.value && !await confirmAction('车辆数据尚未保存，放弃本次修改并关闭？', '未保存的修改', { confirmText: '放弃修改' })) return
  ++sequence
  done()
}
async function reload() {
  if (dirty.value && !await confirmAction('重新加载将放弃当前修改，并读取最新保存的数据。', '重新加载车辆', { confirmText: '重新加载' })) return
  await load()
}
async function resetAll() {
  if (!await confirmAction('将所有基础属性和两个档位的性能参数恢复为原始值，点击保存后生效。', '恢复原始数据', { confirmText: '恢复原始值' })) return
  draft.value = { metadata: {}, profiles: {} }
  fieldErrors.value = {}
}
</script>

<template>
  <el-drawer :model-value="modelValue" :size="narrow ? '100%' : 'min(1100px, 94vw)'" title="车辆详细数据"
    :before-close="beforeClose" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving"
    @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading" class="detail-content">
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="detail-alert">
        <el-button :disabled="saving" link type="primary" @click="reload">重新加载最新数据</el-button>
      </el-alert>
      <template v-if="detail">
        <div class="vehicle-heading">
          <VehiclePreview :id="detail.vehicle.id" :title="detail.vehicle.title" />
          <div><h3>{{ detail.vehicle.title }}</h3><div class="muted mono">{{ detail.vehicle.id }} · {{ detail.vehicle.internalId }}</div>
            <div class="heading-tags"><el-tag>{{ detail.vehicle.categoryTitle }}</el-tag><el-tag type="info">{{ detail.vehicle.engineTitle }}</el-tag>
              <el-tag :type="detail.vehicle.enabled ? 'success' : 'info'">{{ detail.vehicle.enabled ? '已开启' : '已关闭' }}</el-tag></div></div>
        </div>
        <p class="muted">修改的是车辆基础数据，零件、宠物和速度规则仍会参与计算。标准档位用于常规及复古模式；无限加速（4）单独配置。保存后在下次加载车辆或比赛时生效。</p>
        <el-tabs v-model="tab">
          <el-tab-pane label="性能参数" name="physics">
            <div class="physics-toolbar">
              <el-radio-group v-model="speed" aria-label="性能档位"><el-radio-button value="7">标准（7）</el-radio-button><el-radio-button value="4">无限加速（4）</el-radio-button></el-radio-group>
              <el-input v-model="query" :prefix-icon="Search" placeholder="搜索参数名称 / 字段" aria-label="搜索车辆参数" clearable />
            </div>
            <p class="muted">共 {{ detail.physicsFields.length }} 项参数 · 黄色标记为自定义值</p>
            <el-alert v-if="missingFields.length" type="warning" :closable="false" show-icon
              :title="`原始参数表有 ${missingFields.length} 项空值，显示为“未提供”。请补齐后再使用该档位。`" />
            <el-form label-position="top" :disabled="saving || loading" @submit.prevent>
              <section v-for="group in groups" :key="group.title" class="field-group">
                <h4>{{ group.title }}</h4>
                <div class="field-grid">
                  <el-form-item v-for="field in group.fields" :key="`${speed}:${field.key}`" :label="`${field.label}${field.unit ? `（${field.unit}）` : ''}`"
                    :error="fieldErrors[fieldID(field, false)]" :class="{ customized: customized(field) }">
                    <div class="field-key mono">{{ field.key }}</div>
                    <el-input :model-value="value(field) === undefined ? '' : String(value(field))" type="number" :min="field.min ?? 0" :max="field.max"
                      :step="field.integer ? 1 : 'any'" :aria-label="field.label" @update:model-value="setField(field, $event === '' ? undefined : Number($event))" />
                    <div class="field-original"><span>原始值：{{ original(field) ?? '未提供' }}</span><el-button v-if="customized(field)" link type="primary" @click="resetField(field)">恢复</el-button></div>
                  </el-form-item>
                </div>
              </section>
            </el-form>
            <el-empty v-if="!groups.length" description="没有匹配的参数" :image-size="64" />
          </el-tab-pane>
          <el-tab-pane label="基础属性" name="metadata">
            <el-form label-position="top" :disabled="saving || loading" class="field-grid" @submit.prevent>
              <el-form-item v-for="field in detail.metadataFields.filter(f => f.key !== 'kartType' || detail!.vehicle.itemId !== 0)" :key="field.key"
                :label="field.label" :error="fieldErrors[fieldID(field, true)]" :class="{ customized: customized(field, true) }">
                <div class="field-key mono">{{ field.key }}</div>
                <el-switch v-if="field.type === 'boolean'" :model-value="value(field, true) === true" :aria-label="field.label" @update:model-value="setField(field, $event, true)" />
                <el-input v-else-if="field.type === 'string'" :model-value="String(value(field, true) ?? '')" :maxlength="field.max" :aria-label="field.label" @update:model-value="setField(field, $event, true)" />
                <el-input v-else :model-value="value(field, true) === undefined ? '' : String(value(field, true))" type="number" :min="field.min ?? 0" :max="field.max" step="1"
                  :aria-label="field.label" @update:model-value="setField(field, $event === '' ? undefined : Number($event), true)" />
                <div class="field-original"><span>原始值：{{ original(field, true) ?? '未设置' }}</span><el-button v-if="customized(field, true)" link type="primary" @click="resetField(field, true)">恢复</el-button></div>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="完整数据与来源" name="source">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="车辆标识">{{ detail.vehicle.id }}</el-descriptions-item>
              <el-descriptions-item label="模型路径">{{ detail.base.identity.path }}</el-descriptions-item>
              <el-descriptions-item label="参数文件">{{ detail.base.parameterPath || '未收录独立参数文件，性能以参数表为准' }}</el-descriptions-item>
              <el-descriptions-item label="标准参数来源">{{ detail.base.sources['7'] }}</el-descriptions-item>
              <el-descriptions-item label="无限加速来源">{{ detail.base.sources['4'] }}</el-descriptions-item>
            </el-descriptions>
            <h4>当前完整配置{{ dirty ? '（包含未保存修改）' : '' }}</h4><pre class="source-json">{{ effectiveJSON }}</pre>
            <h4>原始资源属性（只读）</h4><pre class="source-json">{{ JSON.stringify(detail.base.body, null, 2) }}</pre>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-empty v-else-if="!loading && !error" description="请选择车辆" />
    </div>
    <template #footer>
      <div class="detail-footer">
        <div class="muted">{{ overrideCount }} 项自定义{{ dirty ? ' · 有未保存修改' : '' }}<br v-if="detail?.updatedAt" />
          <span v-if="detail?.updatedAt">最近保存：{{ formatTime(detail.updatedAt) }} · {{ detail.updatedBy }}</span></div>
        <div class="footer-actions"><el-button :disabled="!detail || loading || saving" @click="resetAll">恢复原始数据</el-button>
          <el-button :disabled="!detail || loading || saving" @click="reload">重新加载</el-button>
          <el-button type="primary" :loading="saving" :disabled="!dirty || loading || !!Object.keys(fieldErrors).length" @click="save">保存修改</el-button></div>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.detail-content { min-height: 180px; }
.detail-alert { margin-bottom: 16px; }
.vehicle-heading { display: flex; align-items: center; gap: 16px; }
.vehicle-heading h3 { margin: 0 0 6px; }
.heading-tags { display: flex; gap: 6px; margin-top: 10px; }
.physics-toolbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.physics-toolbar .el-input { flex: 1; min-width: 230px; }
.field-group h4 { border-bottom: 1px solid var(--el-border-color-light); padding-bottom: 10px; }
.field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 16px; }
.field-grid :deep(.el-form-item) { padding: 10px; border-radius: 6px; background: var(--el-fill-color-extra-light); }
.field-grid :deep(.customized) { background: var(--el-color-warning-light-9); }
.field-grid :deep(.el-form-item__content) { display: block; }
.field-key { font-size: 11px; line-height: 1.5; min-height: 34px; overflow-wrap: anywhere; color: var(--el-text-color-secondary); }
.field-grid .el-input-number { width: 100%; }
.field-original { display: flex; justify-content: space-between; gap: 4px; font-size: 12px; color: var(--el-text-color-secondary); overflow-wrap: anywhere; }
.source-json { background: var(--el-fill-color-light); padding: 14px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.detail-footer { display: flex; justify-content: space-between; gap: 12px; text-align: left; align-items: center; }
.footer-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.footer-actions .el-button { margin: 0; }
@media (max-width: 900px) { .field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .field-grid { grid-template-columns: 1fr; } .detail-footer { flex-direction: column; align-items: stretch; } }
</style>

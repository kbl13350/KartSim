<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ImageInstance } from 'element-plus'
import { Loading, Picture, ZoomIn } from '@element-plus/icons-vue'
import { trackPreviewKind, trackPreviewUrl } from '../utils/trackPreview'

const props = defineProps<{ id: string; title: string }>()
const source = computed(() => trackPreviewUrl(props.id))
const kind = computed(() => trackPreviewKind(props.id))
const kindLabel = computed(() => {
  return kind.value === 'map' ? '路线图' : kind.value === 'scene' ? '场景预览' : ''
})
const image = ref<ImageInstance>()
const failed = ref(false)
const ready = ref(false)
const canPreview = computed(() => !!source.value && ready.value && !failed.value)

watch(source, () => {
  failed.value = false
  ready.value = false
})

function openPreview() {
  if (canPreview.value) image.value?.showPreview()
}
</script>

<template>
  <div class="track-preview" :class="{ 'can-preview': canPreview, 'route-preview': kind === 'map' }"
    :role="canPreview ? 'button' : undefined" :tabindex="canPreview ? 0 : undefined"
    :aria-label="canPreview ? `放大查看${title}地图预览` : undefined"
    @keydown.enter.prevent="openPreview" @keydown.space.prevent="openPreview">
    <el-image v-if="source" ref="image" :src="source" :alt="`${title}地图预览`" fit="contain"
      loading="lazy" :preview-src-list="[source]" preview-teleported hide-on-click-modal
      @load="ready = true" @error="failed = true">
      <template #placeholder>
        <span class="preview-placeholder" role="status"><el-icon class="is-loading"><Loading /></el-icon><span>加载预览…</span></span>
      </template>
      <template #error>
        <span class="preview-placeholder"><el-icon><Picture /></el-icon><span>预览加载失败</span></span>
      </template>
    </el-image>
    <span v-else class="preview-placeholder"><el-icon><Picture /></el-icon><span>暂缺预览</span></span>
    <span v-if="canPreview && kindLabel" class="preview-kind">{{ kindLabel }}</span>
    <span v-if="canPreview" class="preview-hint" aria-hidden="true"><el-icon><ZoomIn /></el-icon>点击放大</span>
  </div>
</template>

<style scoped>
.track-preview { position: relative; width: 128px; height: 80px; flex-shrink: 0; overflow: hidden; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: var(--el-fill-color-light); }
.route-preview { background: #253244; }
.track-preview :deep(.el-image) { display: block; width: 100%; height: 100%; }
.can-preview { cursor: zoom-in; }
.can-preview:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.preview-placeholder { display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 5px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.4; }
.preview-placeholder .el-icon { font-size: 20px; }
.preview-kind { position: absolute; top: 3px; left: 3px; padding: 1px 4px; border-radius: 3px; background: rgb(0 0 0 / 60%); color: white; font-size: 10px; line-height: 16px; pointer-events: none; }
.preview-hint { position: absolute; right: 0; bottom: 0; left: 0; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 2px 0; background: rgb(0 0 0 / 55%); color: white; font-size: 11px; line-height: 16px; pointer-events: none; opacity: 0; transition: opacity .15s ease; }
.can-preview:hover .preview-hint, .can-preview:focus-visible .preview-hint { opacity: 1; }
@media (hover: none) { .preview-hint { opacity: 1; } }
</style>

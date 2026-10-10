<script setup lang="ts">
import { computed } from 'vue'
import { useNarrow } from '../composables/useNarrow'

// A read-only view of a raw result object (抽奖/开箱 结果).
const props = defineProps<{ title: string; value: unknown }>()
const open = defineModel<boolean>({ required: true })
const narrow = useNarrow()
const textValue = computed(() => {
  try {
    return JSON.stringify(props.value, null, 2) ?? '—'
  } catch {
    return String(props.value)
  }
})
</script>

<template>
  <el-dialog v-model="open" :title="title" :width="narrow ? '94%' : '720px'" append-to-body>
    <pre class="json">{{ textValue }}</pre>
  </el-dialog>
</template>

<style scoped>
.json {
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

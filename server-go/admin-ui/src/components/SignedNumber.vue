<script setup lang="ts">
import { formatSigned } from '../utils/format'

// +1,234 in green, -1,234 in red.
defineProps<{ value: number | null | undefined }>()
</script>

<template>
  <span :class="['signed', { up: (value ?? 0) > 0, down: (value ?? 0) < 0 }]">{{ formatSigned(value) }}</span>
</template>

<style scoped>
.signed {
  font-variant-numeric: tabular-nums;
}
.up {
  color: var(--el-color-success);
}
.down {
  color: var(--el-color-danger);
}
</style>

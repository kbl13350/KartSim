<script setup lang="ts">
import { currencyName, currencyTags } from '../utils/format'

defineProps<{ currency: string | null | undefined }>()
</script>

<template>
  <el-tag v-if="currency" :type="currencyTags[currency] ?? 'info'" disable-transitions>{{ currencyName(currency) }}</el-tag>
  <span v-else>—</span>
</template>

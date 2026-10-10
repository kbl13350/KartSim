<script setup lang="ts">
import { Refresh, Search } from '@element-plus/icons-vue'
import type { PagedTable } from '../composables/usePagedTable'
import { rangeShortcuts } from '../utils/time'

// The search row above a paged table: keyword, the list's own filters
// (default slot), a Beijing-time range, and 搜索 / 重置 / 刷新. Extra buttons
// go in the `actions` slot on the right.

defineProps<{
  table: PagedTable<any, any>
  /** Placeholder of the keyword box; no keyword box without it. */
  keyword?: string
  /** Label of the time range (e.g. 注册时间); no range picker without it. */
  range?: string
}>()

const shortcuts = rangeShortcuts()
const defaultTime: [Date, Date] = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]
</script>

<template>
  <el-form class="toolbar" :inline="true" @submit.prevent="table.search()">
    <el-form-item v-if="keyword">
      <el-input
        v-model="table.q"
        :placeholder="keyword"
        :prefix-icon="Search"
        maxlength="64"
        clearable
        class="keyword"
        @clear="table.search()"
      />
    </el-form-item>
    <slot />
    <el-form-item v-if="range" :label="range">
      <el-date-picker
        v-model="table.range"
        type="datetimerange"
        value-format="YYYY-MM-DD HH:mm:ss"
        format="YYYY-MM-DD HH:mm:ss"
        start-placeholder="开始（北京时间）"
        end-placeholder="结束"
        range-separator="至"
        :shortcuts="shortcuts"
        :default-time="defaultTime"
        unlink-panels
        class="range"
        @change="table.search()"
      />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" native-type="submit" :icon="Search">搜索</el-button>
      <el-button @click="table.reset()">重置</el-button>
      <el-button :icon="Refresh" :loading="table.loading" @click="table.load()">刷新</el-button>
    </el-form-item>
    <div v-if="$slots.actions" class="toolbar-actions">
      <slot name="actions" />
    </div>
  </el-form>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  row-gap: 0;
}
.toolbar :deep(.el-form-item) {
  margin-right: 12px;
  margin-bottom: 12px;
}
.keyword {
  width: 240px;
}
.range {
  width: 400px;
}
.toolbar-actions {
  margin-left: auto;
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}
@media (max-width: 640px) {
  .toolbar :deep(.el-form-item) {
    width: 100%;
    margin-right: 0;
  }
  .toolbar :deep(.el-form-item__content) {
    flex: 1;
    min-width: 0;
  }
  .keyword,
  .range {
    width: 100%;
  }
  .toolbar-actions {
    margin-left: 0;
  }
}
</style>

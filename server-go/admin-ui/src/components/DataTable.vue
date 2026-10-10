<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TableInstance } from 'element-plus'
import { PAGE_SIZES, type PagedTable } from '../composables/usePagedTable'
import { useNarrow } from '../composables/useNarrow'

// An el-table bound to a usePagedTable: loading mask, custom (server) sort,
// empty / error states and the pagination bar. Columns go in the default
// slot; other attributes (row-key, default-sort, ...) pass to el-table.

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  table: PagedTable<any, any>
  emptyText?: string
}>()

const narrow = useNarrow()
const tableRef = ref<TableInstance>()

watch(() => props.table.sortResets, () => tableRef.value?.clearSort())
</script>

<template>
  <div class="data-table">
    <el-table
      ref="tableRef"
      v-loading="table.loading"
      :data="table.items"
      border
      stripe
      style="width: 100%"
      v-bind="$attrs"
      @sort-change="table.onSortChange"
    >
      <slot />
      <template #empty>
        <el-result v-if="table.error" icon="error" title="加载失败" :sub-title="table.error">
          <template #extra>
            <el-button type="primary" @click="table.load()">重试</el-button>
          </template>
        </el-result>
        <el-empty v-else :description="table.loaded ? (emptyText ?? '暂无数据') : '加载中…'" :image-size="72" />
      </template>
    </el-table>
    <div class="pager">
      <el-pagination
        :current-page="table.page"
        :page-size="table.pageSize"
        :page-sizes="PAGE_SIZES"
        :total="table.total"
        :layout="narrow ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
        :pager-count="narrow ? 5 : 7"
        background
        @current-change="table.onPageChange"
        @size-change="table.onSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  overflow-x: auto;
}
</style>

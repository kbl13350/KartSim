import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { api, errorMessage, type Query, type QueryValue } from '../api/client'
import type { Paged } from '../api/types'
import { parseBeijing } from '../utils/time'
import { showError } from '../utils/ui'

// A server-paged table (ADMIN.md section 3): page/pageSize, q, sort/order,
// from/to and per-list filters go to the list endpoint, which answers
// {items, total, page, pageSize}.
//
// The search inputs (q, range, filters) are only read by search() and
// reset(): they validate the inputs and keep a snapshot, and every load
// (paging, sorting, 刷新, silent reloads) queries that snapshot. Text typed
// into a box without pressing 搜索 therefore never leaks into a page change.

export type SortOrder = '' | 'asc' | 'desc'

export interface PagedTable<T, F extends Record<string, QueryValue>> {
  page: number
  pageSize: number
  q: string
  sort: string
  order: SortOrder
  /** Beijing "YYYY-MM-DD HH:mm:ss" strings from the date-range picker. */
  range: [string, string] | null
  filters: F
  items: T[]
  total: number
  loading: boolean
  error: string
  /** Whether a load has finished (empty text says 暂无数据 only then). */
  loaded: boolean
  /** Bumped when the sort is cleared, so the table clears its sort arrows. */
  sortResets: number
  /** Loads the current page with the last searched criteria. */
  load(options?: { silent?: boolean }): Promise<void>
  /** Validates and applies the search inputs, then loads page 1. */
  search(): void
  /** Clears the search inputs and the sort, then searches. */
  reset(): void
  /** Drops the rows (and any answer still in flight), e.g. when the subject of the list changes. */
  clear(): void
  onSortChange(event: { prop: string | null; order: 'ascending' | 'descending' | null }): void
  onPageChange(page: number): void
  onSizeChange(size: number): void
}

export interface PagedTableOptions<F> {
  filters?: F
  /** Extra query parameters that are not search fields (e.g. the account of a drawer). */
  fixed?: () => Query
  pageSize?: number
  /**
   * Checks the (trimmed) filters before a search: a non-empty message is
   * shown instead of sending a query the server would answer INVALID_QUERY.
   */
  validate?: (filters: F) => string
  /** false skips loading (e.g. a drawer that has no account yet). */
  ready?: () => boolean
}

export const PAGE_SIZES = [20, 50, 100]

/** The criteria of the last search. */
interface Criteria {
  q: string
  range: [string, string] | null
  filters: Record<string, QueryValue>
}

function trimmed(filters: Record<string, QueryValue>): Record<string, QueryValue> {
  const result: Record<string, QueryValue> = {}
  for (const [key, value] of Object.entries(filters)) result[key] = typeof value === 'string' ? value.trim() : value
  return result
}

export function usePagedTable<T, F extends Record<string, QueryValue> = Record<string, never>>(
  path: string | (() => string), options: PagedTableOptions<F> = {}): PagedTable<T, F> {
  const initialFilters = { ...(options.filters ?? {}) } as F
  let sequence = 0
  let applied: Criteria = { q: '', range: null, filters: trimmed(initialFilters) }

  const table = reactive({
    page: 1,
    pageSize: options.pageSize ?? PAGE_SIZES[0]!,
    q: '',
    sort: '',
    order: '' as SortOrder,
    range: null as [string, string] | null,
    filters: { ...initialFilters },
    items: [] as T[],
    total: 0,
    loading: false,
    error: '',
    loaded: false,
    sortResets: 0,

    async load({ silent = false }: { silent?: boolean } = {}) {
      if (options.ready && !options.ready()) return
      const id = ++sequence
      const query: Query = { page: table.page, pageSize: table.pageSize }
      if (applied.q) query.q = applied.q
      if (table.sort && table.order) {
        query.sort = table.sort
        query.order = table.order
      }
      if (applied.range) {
        const from = parseBeijing(applied.range[0])
        const to = parseBeijing(applied.range[1])
        if (Number.isFinite(from)) query.from = from
        // The picker ends on a whole second; the server's `to` is an inclusive
        // millisecond, so the end second's last 999 ms count too.
        if (Number.isFinite(to)) query.to = to + 999
      }
      Object.assign(query, applied.filters)
      Object.assign(query, options.fixed?.() ?? {})
      table.loading = true
      try {
        const result = await api.get<Paged<T>>(typeof path === 'function' ? path() : path, query)
        if (id !== sequence) return
        table.items = (result?.items ?? []) as never
        table.total = result?.total ?? 0
        table.error = ''
        // A page past the end (rows went away) moves back to the last page.
        const last = Math.max(1, Math.ceil(table.total / table.pageSize))
        if (table.page > last && table.total > 0) {
          table.page = last
          void table.load({ silent })
          return
        }
      } catch (error) {
        if (id !== sequence) return
        table.error = errorMessage(error)
        table.items = [] as never
        table.total = 0
        if (!silent) showError(error)
      } finally {
        if (id === sequence) {
          table.loading = false
          table.loaded = true
        }
      }
    },

    search() {
      const filters = trimmed(table.filters as Record<string, QueryValue>)
      const problem = options.validate?.(filters as F) ?? ''
      if (problem) {
        // The table keeps showing (and paging) the last valid search.
        ElMessage.warning({ message: problem, grouping: true, showClose: true })
        return
      }
      applied = { q: table.q.trim(), range: table.range ? [table.range[0], table.range[1]] : null, filters }
      table.page = 1
      void table.load()
    },

    reset() {
      table.q = ''
      table.range = null
      table.filters = { ...initialFilters } as never
      if (table.sort) table.sortResets++
      table.sort = ''
      table.order = ''
      table.search()
    },

    clear() {
      sequence++
      table.items = [] as never
      table.total = 0
      table.page = 1
      table.error = ''
      table.loading = false
      table.loaded = false
    },

    onSortChange({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }) {
      table.sort = prop && order ? prop : ''
      table.order = prop && order ? (order === 'ascending' ? 'asc' : 'desc') : ''
      table.page = 1
      void table.load()
    },

    onPageChange(page: number) {
      table.page = page
      void table.load()
    },

    onSizeChange(size: number) {
      table.pageSize = size
      table.page = 1
      void table.load()
    },
  })
  return table as unknown as PagedTable<T, F>
}

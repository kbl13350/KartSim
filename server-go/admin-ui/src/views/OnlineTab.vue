<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api/client'
import type { NodeRow, NodesResponse, OnlineRow } from '../api/types'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { isSelf } from '../session'
import { kickAccount } from '../utils/accounts'
import { text } from '../utils/format'

// 在线玩家: GET /api/admin/online (from the game nodes' registrations; q
// matches nickname/account, node narrows to one node; sort name (default),
// username, node, room).

const table = usePagedTable<OnlineRow, { node: string }>('/api/admin/online', { filters: { node: '' } })
const nodes = ref<NodeRow[]>([])

async function loadNodes() {
  try {
    nodes.value = (await api.get<NodesResponse>('/api/admin/nodes')).nodes ?? []
  } catch {
    // The node picker is optional; the list itself reports errors.
  }
}

function refresh() {
  void table.load()
  void loadNodes()
}

useTab('online', refresh)
onMounted(refresh)

async function kick(row: OnlineRow) {
  if (!row.accountId) return
  if (await kickAccount({ id: row.accountId, username: row.username, nickname: row.name })) {
    void table.load({ silent: true })
  }
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <TableToolbar :table="table" keyword="昵称 / 账号">
      <el-form-item label="节点">
        <el-select v-model="table.filters.node" clearable filterable placeholder="全部节点" class="filter-select" @change="table.search()">
          <el-option v-for="node in nodes" :key="node.nodeId" :value="node.nodeId" :label="node.name || node.nodeId" />
        </el-select>
      </el-form-item>
    </TableToolbar>
    <DataTable :table="table" row-key="playerId" empty-text="当前没有在线玩家">
      <el-table-column prop="name" label="昵称" min-width="140" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">{{ text(row.name) }}</template>
      </el-table-column>
      <el-table-column prop="username" label="账号" min-width="140" sortable="custom">
        <template #default="{ row }">
          <el-tag v-if="row.guest || !row.accountId" type="info" disable-transitions>游客</el-tag>
          <span v-else>{{ text(row.username) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="node" label="所在节点" min-width="160" sortable="custom">
        <template #default="{ row }">
          {{ row.nodeName || row.nodeId }}
          <span v-if="row.nodeName && row.nodeId !== row.nodeName" class="muted mono">（{{ row.nodeId }}）</span>
        </template>
      </el-table-column>
      <el-table-column prop="room" label="所在房间" min-width="140" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          <span v-if="row.room">{{ row.room }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="玩家 ID" min-width="180" show-overflow-tooltip>
        <template #default="{ row }"><span class="mono">{{ row.playerId }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.accountId && !row.guest"
            link
            type="danger"
            :disabled="isSelf(row.accountId)"
            :title="isSelf(row.accountId) ? '不能把自己踢下线' : undefined"
            @click="kick(row)"
          >踢下线</el-button>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
    </DataTable>
  </el-card>
</template>

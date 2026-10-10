<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Plus } from '@element-plus/icons-vue'
import { api } from '../api/client'
import type { InviteRow } from '../api/types'
import AccountName from '../components/AccountName.vue'
import DataTable from '../components/DataTable.vue'
import TableToolbar from '../components/TableToolbar.vue'
import { usePagedTable } from '../composables/usePagedTable'
import { useTab } from '../composables/useTabs'
import { formatTime } from '../utils/time'
import { copyText, showError } from '../utils/ui'

// 邀请码: POST /multiplayer/admin/invites makes one. A code is shown only
// once (the server stores its digest), so the codes of this login are kept
// in memory; GET /api/admin/invites lists every invite by the digest's
// first 12 characters (used=1|0; sort createdAt).

const creating = ref(false)
const codes = ref<{ code: string; at: number }[]>([])

const table = usePagedTable<InviteRow, { used: string }>('/api/admin/invites', { filters: { used: '' } })
useTab('invites', () => table.load())
onMounted(() => table.load())

async function create() {
  if (creating.value) return
  creating.value = true
  try {
    const result = await api.post<{ invite: string }>('/multiplayer/admin/invites')
    codes.value.unshift({ code: result.invite, at: Date.now() })
    ElMessage.success('已生成邀请码')
    void table.load({ silent: true })
  } catch (error) {
    showError(error)
  } finally {
    creating.value = false
  }
}

async function copy(code: string) {
  if (await copyText(code)) ElMessage.success('已复制')
  else ElMessage.warning('浏览器不允许自动复制，请手动选中复制')
}
</script>

<template>
  <div>
    <el-card shadow="never" class="page-card">
      <p class="page-note">邀请码仅在邀请注册模式（KART_REGISTRATION=invite）下需要；开放注册时也可填写，填写后即被消耗。</p>
      <el-button type="primary" :icon="Plus" :loading="creating" @click="create">生成邀请码</el-button>
      <template v-if="codes.length">
        <el-alert
          type="warning"
          title="邀请码只显示这一次，单次有效，请复制后发给玩家。刷新或退出后本列表清空。"
          :closable="false"
          show-icon
          class="alert"
        />
        <div v-for="entry in codes" :key="entry.code" class="code-row">
          <code class="invite">{{ entry.code }}</code>
          <el-button :icon="CopyDocument" size="small" @click="copy(entry.code)">复制</el-button>
          <span class="muted">{{ formatTime(entry.at) }}</span>
        </div>
      </template>
    </el-card>

    <el-card shadow="never" class="page-card">
      <template #header>全部邀请码</template>
      <p class="page-note">服务器只保存邀请码的摘要，这里显示摘要的前 12 位，无法还原邀请码本身。</p>
      <TableToolbar :table="table">
        <el-form-item label="状态">
          <el-select v-model="table.filters.used" clearable placeholder="全部" class="filter-select" @change="table.search()">
            <el-option value="0" label="未使用" />
            <el-option value="1" label="已使用" />
          </el-select>
        </el-form-item>
      </TableToolbar>
      <DataTable :table="table" empty-text="还没有邀请码">
        <el-table-column label="摘要" min-width="140">
          <template #default="{ row }"><span class="mono">{{ row.hash }}</span></template>
        </el-table-column>
        <el-table-column prop="createdAt" label="生成时间" width="175" sortable="custom">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.used ? 'info' : 'success'" disable-transitions>{{ row.used ? '已使用' : '未使用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用者" min-width="180">
          <template #default="{ row }">
            <AccountName v-if="row.usedBy" :nickname="row.usedBy.nickname" :username="row.usedBy.username" />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </DataTable>
    </el-card>
  </div>
</template>

<style scoped>
.alert {
  margin: 16px 0 12px;
}
.code-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.invite {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 16px;
  padding: 4px 10px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  user-select: all;
  word-break: break-all;
}
</style>

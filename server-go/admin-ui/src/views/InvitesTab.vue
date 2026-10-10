<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Plus } from '@element-plus/icons-vue'
import { api } from '../api/client'
import { formatTime } from '../utils/time'
import { copyText, showError } from '../utils/ui'

// 邀请码: POST /multiplayer/admin/invites. A code is shown only once (the
// server stores its digest), so the codes of this login are kept in memory.

const creating = ref(false)
const codes = ref<{ code: string; at: number }[]>([])

async function create() {
  creating.value = true
  try {
    const result = await api.post<{ invite: string }>('/multiplayer/admin/invites')
    codes.value.unshift({ code: result.invite, at: Date.now() })
    ElMessage.success('已生成邀请码')
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

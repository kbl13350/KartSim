<script setup lang="ts">
import type { AccountRow } from '../api/types'

// AccountRow.online in a cell: the node, 断开中 for an account that was
// kicked, banned or logged in elsewhere and is dropped at the node's next
// heartbeat, or 离线.
defineProps<{ online: AccountRow['online'] | undefined }>()
</script>

<template>
  <el-tooltip
    v-if="online?.leaving"
    :content="`已被踢下线、封禁或在别处登录，${online.nodeName || online.nodeId} 下次心跳时断开`"
    placement="top"
  >
    <el-tag type="warning" disable-transitions>断开中</el-tag>
  </el-tooltip>
  <el-tag v-else-if="online" type="success" disable-transitions>{{ online.nodeName || online.nodeId }}</el-tag>
  <span v-else class="muted">离线</span>
</template>

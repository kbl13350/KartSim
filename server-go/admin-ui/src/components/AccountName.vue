<script setup lang="ts">
// A rider in a table cell: nickname over the account name.
defineProps<{ nickname?: string | null; username?: string | null }>()
</script>

<template>
  <div class="account-name">
    <span class="nick">{{ nickname || username || '—' }}</span>
    <span v-if="nickname && username" class="user">{{ username }}</span>
  </div>
</template>

<style scoped>
.account-name {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.user {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>

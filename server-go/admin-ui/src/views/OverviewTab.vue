<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { Overview } from '../api/types'
import AccountName from '../components/AccountName.vue'
import { useTab } from '../composables/useTabs'
import { formatNumber, loginKindName, text } from '../utils/format'
import { formatTime } from '../utils/time'
import { showError } from '../utils/ui'

// 概览: GET /api/admin/overview ("today" is Beijing time from 00:00). The
// online, nodes and rooms figures are null while the cluster registry
// (Redis) is unavailable: those cards show "—" and say so.

const data = ref<Overview | null>(null)
const loading = ref(false)
const failure = ref('')

async function load() {
  loading.value = true
  try {
    data.value = await api.get<Overview>('/api/admin/overview')
    failure.value = ''
  } catch (error) {
    failure.value = errorMessage(error)
    showError(error)
  } finally {
    loading.value = false
  }
}

useTab('overview', load)
onMounted(load)

interface Card {
  title: string
  /** A number shown by el-statistic; null or undefined shows "—". */
  value?: number | null
  /** Text shown instead of a number. */
  text?: string
  foot: string
  warn?: boolean
}

const REGISTRY_DOWN = 'Redis 不可用'

const cards = computed<Card[]>(() => {
  const value = data.value
  if (!value) return []
  const { online, nodes, rooms } = value
  const unhealthy = !!nodes && nodes.healthy < nodes.total
  return [
    { title: '注册用户总数', value: value.accounts?.total, foot: `管理员 ${formatNumber(value.accounts?.admins)} · 封禁 ${formatNumber(value.accounts?.banned)}` },
    { title: '今日新增', value: value.accounts?.today, foot: '北京时间 0 点起' },
    { title: '今日登录人数', value: value.logins?.uniqueToday, foot: `共 ${formatNumber(value.logins?.today)} 次登录` },
    online
      ? { title: '当前在线', value: online.players, foot: `账号 ${formatNumber(online.accounts)} · 游客 ${formatNumber(online.guests)}` }
      : { title: '当前在线', value: null, foot: REGISTRY_DOWN, warn: true },
    nodes
      ? { title: '游戏节点（正常/总数）', text: `${formatNumber(nodes.healthy)} / ${formatNumber(nodes.total)}`,
          foot: unhealthy ? '有节点异常' : '全部正常', warn: unhealthy }
      : { title: '游戏节点（正常/总数）', text: '— / —', foot: REGISTRY_DOWN, warn: true },
    rooms !== null && rooms !== undefined
      ? { title: '房间数', value: rooms, foot: '所有节点' }
      : { title: '房间数', value: null, foot: REGISTRY_DOWN, warn: true },
    { title: '今日比赛场次', value: value.races?.today, foot: '已结算' },
    { title: '今日点券消费', value: value.coupon?.spentToday, foot: '商城与抽奖等' },
    { title: '今日发放点券', value: value.coupon?.grantedToday, foot: '管理员发放' },
  ]
})
</script>

<template>
  <div v-loading="loading && !data">
    <el-result v-if="failure && !data" icon="error" title="加载失败" :sub-title="failure">
      <template #extra><el-button type="primary" @click="load">重试</el-button></template>
    </el-result>
    <template v-if="data">
      <div class="overview-head">
        <span class="muted">数据时间：{{ formatTime(data.now) }}（北京时间）</span>
        <el-button :icon="Refresh" :loading="loading" size="small" @click="load">刷新</el-button>
      </div>
      <div class="stat-grid">
        <el-card v-for="card in cards" :key="card.title" shadow="hover" class="stat-card">
          <el-statistic v-if="card.text === undefined && card.value != null" :title="card.title" :value="card.value" />
          <div v-else class="el-statistic">
            <div class="el-statistic__head">{{ card.title }}</div>
            <div class="el-statistic__content">
              <span class="el-statistic__number" :class="{ warn: card.warn }">{{ card.text ?? '—' }}</span>
            </div>
          </div>
          <div class="stat-foot" :class="{ warn: card.warn }">{{ card.foot }}</div>
        </el-card>
      </div>
      <el-row :gutter="16">
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="page-card">
            <template #header>最近注册</template>
            <el-table :data="data.recentRegistrations ?? []" size="small" stripe empty-text="暂无数据">
              <el-table-column label="账号" min-width="140">
                <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
              </el-table-column>
              <el-table-column label="注册时间" width="170">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="注册 IP" min-width="130">
                <template #default="{ row }">{{ text(row.registerIp) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
        <el-col :xs="24" :lg="12">
          <el-card shadow="never" class="page-card">
            <template #header>最近登录</template>
            <el-table :data="data.recentLogins ?? []" size="small" stripe empty-text="暂无数据">
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.at) }}</template>
              </el-table-column>
              <el-table-column label="类型" width="70">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.kind === 'register' ? 'success' : 'info'" disable-transitions>{{ loginKindName(row.kind) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="账号" min-width="140">
                <template #default="{ row }"><AccountName :nickname="row.nickname" :username="row.username" /></template>
              </el-table-column>
              <el-table-column label="IP" min-width="130">
                <template #default="{ row }">{{ text(row.ip) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<style scoped>
.overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card :deep(.el-card__body) {
  padding: 16px;
}
.stat-foot {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.warn {
  color: var(--el-color-danger);
}
</style>

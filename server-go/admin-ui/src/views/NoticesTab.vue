<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { api, errorMessage } from '../api/client'
import type { Notice } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { useTab } from '../composables/useTabs'
import { formatTime, parseBeijing, toBeijingString } from '../utils/time'
import { confirmAction, showError } from '../utils/ui'

// 迷你提示窗公告 (MENUS.md 3): GET /api/admin/notices, PUT /api/admin/notices
// {id (0 = new), title, message, startAt?, endAt?}, DELETE
// /api/admin/notices/{id}. "|" in the message is a line break in the game.

const notices = ref<Notice[]>([])
const loading = ref(false)
const failure = ref('')
const loaded = ref(false)
const narrow = useNarrow()

async function load() {
  loading.value = true
  try {
    notices.value = (await api.get<{ notices: Notice[] | null }>('/api/admin/notices')).notices ?? []
    failure.value = ''
  } catch (error) {
    failure.value = errorMessage(error)
    showError(error)
  } finally {
    loading.value = false
    loaded.value = true
  }
}

useTab('notices', load)
onMounted(load)

function periodText(notice: Notice) {
  if (!notice.startAt && !notice.endAt) return '不限'
  return `${notice.startAt ? formatTime(notice.startAt) : '…'} ~ ${notice.endAt ? formatTime(notice.endAt) : '…'}`
}

function showing(notice: Notice) {
  const now = Date.now()
  if (notice.startAt && now < notice.startAt) return { label: '未开始', type: 'warning' as const }
  if (notice.endAt && now >= notice.endAt) return { label: '已结束', type: 'info' as const }
  return { label: '显示中', type: 'success' as const }
}

/* ---------- editor ---------- */

const editOpen = ref(false)
const saving = ref(false)
const editFailure = ref('')
const form = reactive({ id: 0, title: '', message: '', start: null as string | null, end: null as string | null })

function editNotice(notice: Notice | null) {
  form.id = notice?.id ?? 0
  form.title = notice?.title ?? ''
  form.message = notice?.message ?? ''
  form.start = notice?.startAt ? toBeijingString(notice.startAt) : null
  form.end = notice?.endAt ? toBeijingString(notice.endAt) : null
  editFailure.value = ''
  editOpen.value = true
}

async function save() {
  // Enter in 标题 submits the form: a second Enter while the first request
  // is in flight must not publish the notice twice.
  if (saving.value) return
  editFailure.value = ''
  const body: { id: number; title: string; message: string; startAt?: number; endAt?: number } = {
    id: Number(form.id) || 0,
    title: form.title.trim(),
    message: form.message.trim(),
  }
  if (!body.title || !body.message) {
    editFailure.value = '请填写标题和内容'
    return
  }
  if (form.start) body.startAt = parseBeijing(form.start)
  if (form.end) body.endAt = parseBeijing(form.end)
  if (body.startAt && body.endAt && body.endAt <= body.startAt) {
    editFailure.value = '结束时间须晚于开始时间'
    return
  }
  saving.value = true
  try {
    await api.put<{ id: number }>('/api/admin/notices', body)
    ElMessage.success(`${body.id ? '已保存：' : '已发布：'}${body.title}`)
    editOpen.value = false
    void load()
  } catch (error) {
    editFailure.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}

async function remove(notice: Notice) {
  if (!await confirmAction(`删除公告“${notice.title}”？`, '删除公告', { danger: true, confirmText: '删除' })) return
  try {
    await api.del(`/api/admin/notices/${notice.id}`)
    ElMessage.success(`已删除：${notice.title}`)
    if (editOpen.value && form.id === notice.id) editOpen.value = false
    void load()
  } catch (error) {
    showError(error)
  }
}
</script>

<template>
  <el-card shadow="never" class="page-card">
    <p class="page-note">公告显示在游戏任务栏的迷你提示窗中（与奖励箱、任务的系统提醒一起轮播）。时段留空表示不限。</p>
    <div class="toolbar">
      <el-button type="primary" :icon="Plus" @click="editNotice(null)">发布公告</el-button>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </div>
    <el-table v-loading="loading" :data="notices" border stripe row-key="id">
      <el-table-column label="标题" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.title }}</template>
      </el-table-column>
      <el-table-column label="内容" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">{{ row.message }}</template>
      </el-table-column>
      <el-table-column label="时段" min-width="200">
        <template #default="{ row }">
          <div>{{ periodText(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><el-tag :type="showing(row).type" disable-transitions>{{ showing(row).label }}</el-tag></template>
      </el-table-column>
      <el-table-column label="设置人" min-width="170">
        <template #default="{ row }">{{ row.updatedBy || '—' }} <span class="muted">{{ formatTime(row.updatedAt) }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="editNotice(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-result v-if="failure" icon="error" title="加载失败" :sub-title="failure">
          <template #extra><el-button type="primary" @click="load">重试</el-button></template>
        </el-result>
        <el-empty v-else :description="loaded ? '暂无公告' : '加载中…'" :image-size="72" />
      </template>
    </el-table>

    <el-dialog
      v-model="editOpen"
      :title="form.id ? '编辑公告' : '发布公告'"
      :width="narrow ? '94%' : '600px'"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form label-width="80px" :label-position="narrow ? 'top' : 'right'" @submit.prevent="save">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.message" type="textarea" :rows="4" maxlength="400" show-word-limit placeholder="“|”表示换行" />
        </el-form-item>
        <el-form-item label="开始">
          <el-date-picker v-model="form.start" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" placeholder="留空不限（北京时间）" clearable />
        </el-form-item>
        <el-form-item label="结束">
          <el-date-picker v-model="form.end" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm:ss" placeholder="留空不限（北京时间）" clearable />
        </el-form-item>
        <el-form-item v-if="form.message" label="预览">
          <div class="preview">
            <div class="preview-title">{{ form.title || '（无标题）' }}</div>
            <div v-for="(line, index) in form.message.split('|')" :key="index">{{ line }}</div>
          </div>
        </el-form-item>
        <el-alert v-if="editFailure" type="error" :title="editFailure" :closable="false" show-icon />
        <button type="submit" hidden :disabled="saving" />
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ form.id ? '保存修改' : '发布' }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.toolbar .el-button + .el-button {
  margin-left: 0;
}
.preview {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  line-height: 1.6;
}
.preview-title {
  font-weight: 600;
}
</style>

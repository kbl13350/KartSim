<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { api, errorMessage } from '../api/client'
import type { AccountPatch, AccountRow } from '../api/types'
import { useNarrow } from '../composables/useNarrow'
import { session } from '../session'
import { formatTime, isPermanent, parseBeijing, PERMANENT_BAN, toBeijingString } from '../utils/time'
import { confirmAction } from '../utils/ui'

// 编辑账号: PATCH /api/admin/accounts/{id} with only the changed fields
// {nickname?, admin?, bannedUntil? (0 = 解封), banReason?, password?}.

const props = defineProps<{ account: AccountRow | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [account: AccountRow] }>()
const narrow = useNarrow()

const form = reactive({
  nickname: '',
  admin: false,
  bannedUntil: null as string | null,
  banReason: '',
  password: '',
})
const failure = ref('')
const saving = ref(false)

const self = computed(() => !!props.account && props.account.username === session.admin?.username)
const currentBan = computed(() => (props.account?.banned && props.account.bannedUntil ? props.account.bannedUntil : 0))

watch(open, (value) => {
  if (!value || !props.account) return
  const account = props.account
  form.nickname = account.nickname
  form.admin = account.admin
  form.bannedUntil = currentBan.value ? toBeijingString(currentBan.value) : null
  form.banReason = account.banReason ?? ''
  form.password = ''
  failure.value = ''
})

function banFor(days: number) {
  form.bannedUntil = toBeijingString(Date.now() + days * 86400000)
}

function banForever() {
  form.bannedUntil = toBeijingString(PERMANENT_BAN)
}

function unban() {
  form.bannedUntil = null
}

/** Registration's nickname rule (validName(16)): no blank, no edge spaces, no control characters or < >. */
function nicknameProblem(value: string): string {
  if (!value.trim()) return '昵称不能为空'
  if (value !== value.trim()) return '昵称首尾不能有空格'
  if ([...value].length > 16) return '昵称最多 16 个字'
  if (/[\u0000-\u001f\u007f-\u009f<>]/.test(value)) return '昵称不能包含 < > 或控制字符'
  return ''
}

function disabledDate(date: Date) {
  // Days before today cannot hold a ban end (local calendar of the picker).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

async function save() {
  const account = props.account
  if (!account) return
  failure.value = ''
  const patch: AccountPatch = {}
  const changes: string[] = []

  if (form.nickname !== account.nickname) {
    const problem = nicknameProblem(form.nickname)
    if (problem) {
      failure.value = problem
      return
    }
    patch.nickname = form.nickname
    changes.push(`昵称改为“${form.nickname}”`)
  }
  if (form.admin !== account.admin) {
    patch.admin = form.admin
    changes.push(form.admin ? '设为管理员' : '撤销管理员')
  }
  const until = form.bannedUntil ? parseBeijing(form.bannedUntil) : 0
  if (form.bannedUntil && (!Number.isFinite(until) || until <= Date.now())) {
    failure.value = '封禁到期时间须晚于现在'
    return
  }
  if (until !== currentBan.value) {
    patch.bannedUntil = until
    changes.push(until ? `封禁至 ${isPermanent(until) ? '永久' : formatTime(until)}` : '解除封禁')
  }
  const reason = form.banReason.trim()
  if (reason !== (account.banReason ?? '')) {
    if ([...reason].length > 200) {
      failure.value = '封禁原因最多 200 字'
      return
    }
    patch.banReason = reason
    changes.push(reason ? `封禁原因改为“${reason}”` : '清除封禁原因')
  }
  if (form.password) {
    if (form.password.length < 8 || form.password.length > 128) {
      failure.value = '新密码须为 8–128 位'
      return
    }
    patch.password = form.password
    changes.push('重置密码')
  }
  if (!changes.length) {
    ElMessage.info('没有修改')
    return
  }
  const sensitive = patch.password !== undefined || (patch.bannedUntil ?? 0) > 0 || patch.admin !== undefined
  if (!await confirmAction(`确认对 ${account.nickname}（${account.username}）：${changes.join('；')}？` +
    (patch.password !== undefined ? '\n重置密码后该账号需要用新密码登录。' : '') +
    ((patch.bannedUntil ?? 0) > 0 ? '\n封禁会立即踢下线并作废所有会话。' : ''),
  '保存修改', { type: sensitive ? 'warning' : 'info', danger: sensitive })) {
    return
  }
  saving.value = true
  try {
    const saved = await api.patch<AccountRow>(`/api/admin/accounts/${encodeURIComponent(account.id)}`, patch)
    ElMessage.success(`已保存：${changes.join('；')}`)
    open.value = false
    emit('saved', saved)
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="open"
    :title="account ? `编辑账号 · ${account.nickname}（${account.username}）` : '编辑账号'"
    :width="narrow ? '94%' : '600px'"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-form v-if="account" label-width="96px" :label-position="narrow ? 'top' : 'right'" autocomplete="off" @submit.prevent="save">
      <el-form-item label="昵称">
        <el-input v-model="form.nickname" maxlength="16" show-word-limit />
      </el-form-item>
      <el-form-item label="管理员">
        <el-switch v-model="form.admin" :disabled="self && account.admin" inline-prompt active-text="是" inactive-text="否" />
        <span v-if="self" class="hint inline">不能撤销自己的管理员权限</span>
      </el-form-item>
      <el-form-item label="封禁到期">
        <div class="ban">
          <el-date-picker
            v-model="form.bannedUntil"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="未封禁（北京时间）"
            :disabled="self"
            :disabled-date="disabledDate"
            class="ban-picker"
          />
          <div class="ban-buttons">
            <el-button size="small" :disabled="self" @click="banFor(1)">1天</el-button>
            <el-button size="small" :disabled="self" @click="banFor(7)">7天</el-button>
            <el-button size="small" :disabled="self" @click="banFor(30)">30天</el-button>
            <el-button size="small" type="danger" plain :disabled="self" @click="banForever">永久</el-button>
            <el-button size="small" type="success" plain :disabled="!form.bannedUntil" @click="unban">解封</el-button>
          </div>
          <div class="hint">
            当前：{{ currentBan ? (isPermanent(currentBan) ? '永久封禁' : `封禁至 ${formatTime(currentBan)}`) : '未封禁' }}
            <template v-if="self">（不能封禁自己）</template>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="封禁原因">
        <el-input v-model="form.banReason" type="textarea" :rows="2" maxlength="200" show-word-limit placeholder="可留空" />
      </el-form-item>
      <el-form-item label="重置密码">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          maxlength="128"
          autocomplete="new-password"
          placeholder="留空不修改；8–128 位"
        />
      </el-form-item>
      <el-alert v-if="failure" type="error" :title="failure" :closable="false" show-icon />
      <button type="submit" hidden />
    </el-form>
    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ban {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.ban-picker {
  width: 240px;
}
.ban-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ban-buttons .el-button + .el-button {
  margin-left: 0;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.hint.inline {
  margin-left: 12px;
}
</style>

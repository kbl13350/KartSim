<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Lock, User } from '@element-plus/icons-vue'
import { errorMessage } from '../api/client'
import { login, session } from '../session'

const form = reactive({ username: '', password: '' })
const busy = ref(false)
const failure = ref('')

async function submit() {
  failure.value = ''
  const username = form.username.trim()
  if (!username || !form.password) {
    failure.value = '请输入用户名和密码'
    return
  }
  busy.value = true
  try {
    await login(username, form.password)
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    form.password = ''
    busy.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="always">
      <template #header>
        <div class="login-title">跑跑卡丁车 管理后台</div>
      </template>
      <el-alert v-if="session.notice && !failure" type="warning" :title="session.notice" :closable="false" show-icon class="notice" />
      <el-form label-position="top" autocomplete="on" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" name="username" autocomplete="username" maxlength="24" :prefix-icon="User" autofocus />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            name="password"
            type="password"
            autocomplete="current-password"
            maxlength="128"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-alert v-if="failure" type="error" :title="failure" :closable="false" show-icon class="notice" />
        <el-button type="primary" native-type="submit" :loading="busy" class="submit">登录</el-button>
      </el-form>
      <p class="hint">只有管理员账号可以登录。登录令牌只保存在本页面内存中，关闭或刷新页面后需要重新登录。</p>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
}
.login-card {
  width: 400px;
  max-width: 100%;
}
.login-title {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
.notice {
  margin-bottom: 16px;
}
.submit {
  width: 100%;
}
.hint {
  margin: 16px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>

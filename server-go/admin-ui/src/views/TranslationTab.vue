<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, errorMessage } from '../api/client'
import { useTab } from '../composables/useTabs'

type Settings = { enabled: boolean; model: string; keyConfigured: boolean }
const form = reactive({ enabled: false, model: 'deepseek-flash', apiKey: '', clearKey: false })
const configured = ref(false)
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const testing = ref(false)
const failure = ref('')
const result = ref('')
function apply(settings: Settings) {
  form.enabled = settings.enabled
  form.model = settings.model
  configured.value = settings.keyConfigured
  form.apiKey = ''
  form.clearKey = false
}
async function load() {
  loading.value = true
  try {
    apply(await api.get<Settings>('/api/admin/translation'))
    failure.value = ''
    loaded.value = true
  } catch (error) { failure.value = errorMessage(error) }
  finally { loading.value = false }
}
async function save() {
  if (saving.value) return
  saving.value = true
  failure.value = ''
  result.value = ''
  try {
    apply(await api.put<Settings>('/api/admin/translation', { ...form }))
    ElMessage.success('翻译设置已保存')
  } catch (error) { failure.value = errorMessage(error) }
  finally { saving.value = false }
}
async function testConnection() {
  if (testing.value) return
  testing.value = true
  failure.value = ''
  result.value = ''
  try { result.value = (await api.post<{ text: string }>('/api/admin/translation/test', {})).text }
  catch (error) { failure.value = errorMessage(error) }
  finally { testing.value = false }
}
useTab('translation', load)
onMounted(load)
</script>

<template>
  <el-card v-loading="loading" header="多人房间 · AI 聊天翻译">
    <el-alert title="启用后，其他玩家的聊天会发送至 DeepSeek，译成接收者的游戏语言（中文、英文或韩文）。原文保留，自己的消息和表情动作不翻译。" type="info" :closable="false" />
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" style="margin-top: 16px" />
    <el-form label-position="top" style="max-width: 640px; margin-top: 24px" @submit.prevent="save">
      <el-form-item label="自动翻译">
        <el-switch v-model="form.enabled" :disabled="!loaded || form.clearKey || saving" />
      </el-form-item>
      <el-form-item label="翻译模型">
        <el-select v-model="form.model" :disabled="!loaded || saving">
          <el-option label="DeepSeek Flash（推荐）" value="deepseek-flash" />
          <el-option label="DeepSeek V4 Pro" value="deepseek-v4-pro" />
        </el-select>
      </el-form-item>
      <el-form-item :label="`DeepSeek API Key · ${configured ? '已配置' : '未配置'}`">
        <el-input v-model="form.apiKey" type="password" show-password autocomplete="new-password" :maxlength="512"
          :disabled="!loaded || saving || form.clearKey" :placeholder="configured ? '留空保留当前密钥；输入新密钥则替换' : '输入 DeepSeek API Key'" />
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="form.clearKey" :disabled="!configured || saving" @change="() => { if (form.clearKey) { form.enabled = false; form.apiKey = '' } }">清除已保存的密钥并关闭翻译</el-checkbox>
      </el-form-item>
      <el-button type="primary" native-type="submit" :loading="saving" :disabled="!loaded || loading || testing">保存设置</el-button>
      <el-button :loading="testing" :disabled="!configured || saving || loading || !!form.apiKey || form.clearKey" @click="testConnection">测试已保存的配置</el-button>
      <p>密钥加密保存在服务端，页面不会回显。测试会使用已保存的配置翻译一条示例消息。</p>
      <el-alert v-if="result" :title="`连接成功：${result}`" type="success" :closable="false" />
    </el-form>
  </el-card>
</template>

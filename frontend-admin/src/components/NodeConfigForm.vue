<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue'

interface Props {
  nodeType: string
  title: string
}

const props = defineProps<Props>()

interface ModelEntry {
  name: string
  channel: string
  base_url: string
  api_key: string
  temperature: number
  top_p: number
  max_tokens: number
  protocol?: string  // 图片节点专用: chat|local|openai-gen|openai-edit
}

interface FormData {
  enabled: number
  model_name: string
  api_channel: string
  base_url: string
  api_key: string
  temperature: number
  top_p: number
  max_tokens: number
  prompt_template: string
  extra_config: string
}

const form = ref<FormData>({
  enabled: 1,
  model_name: '',
  api_channel: '',
  base_url: '',
  api_key: '',
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 32768,
  prompt_template: '',
  extra_config: '',
})

const extraModels = ref<ModelEntry[]>([])
const loading = ref(false)
const saved = ref(false)
const showAddModel = ref(false)
const editingIndex = ref<number | null>(null)
const newModel = reactive<ModelEntry>({ name: '', channel: '', base_url: '', api_key: '', temperature: 0.7, top_p: 1.0, max_tokens: 32768 })
const editModel = reactive<ModelEntry>({ name: '', channel: '', base_url: '', api_key: '', temperature: 0.7, top_p: 1.0, max_tokens: 32768 })

function parseExtraConfig(raw: string): Record<string, any> {
  try { return JSON.parse(raw) } catch { return {} }
}

async function loadConfig() {
  try {
    const res = await fetch(`/api/admin/node-configs/${props.nodeType}`)
    if (!res.ok) return
    const data = await res.json()
    form.value.enabled = data.enabled
    form.value.model_name = data.model_name
    form.value.api_channel = data.api_channel
    form.value.base_url = data.base_url
    form.value.api_key = data.api_key
    form.value.prompt_template = data.prompt_template
    form.value.extra_config = data.extra_config
    try {
      const params = JSON.parse(data.parameters)
      if (params.temperature !== undefined) form.value.temperature = params.temperature
      if (params.top_p !== undefined) form.value.top_p = params.top_p
      if (params.max_tokens !== undefined) form.value.max_tokens = params.max_tokens
    } catch {}
    const ec = parseExtraConfig(data.extra_config || '{}')
    extraModels.value = Array.isArray(ec.models) ? ec.models : []
  } catch (e) {
    console.error(e)
  }
}

async function saveConfig() {
  loading.value = true
  saved.value = false
  try {
    const parameters = JSON.stringify({
      temperature: form.value.temperature,
      top_p: form.value.top_p,
      max_tokens: form.value.max_tokens,
    })
    const ec = parseExtraConfig(form.value.extra_config || '{}')
    ec.models = extraModels.value
    const extraConfigStr = JSON.stringify(ec)
    await fetch(`/api/admin/node-configs/${props.nodeType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: form.value.enabled,
        model_name: form.value.model_name,
        api_channel: form.value.api_channel,
        base_url: form.value.base_url,
        api_key: form.value.api_key,
        parameters,
        prompt_template: form.value.prompt_template,
        extra_config: extraConfigStr,
      }),
    })
    saved.value = true
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function addModel() {
  const name = newModel.name.trim()
  if (!name) return
  extraModels.value.push({ ...newModel })
  newModel.name = ''
  newModel.channel = ''
  newModel.base_url = ''
  newModel.api_key = ''
  newModel.temperature = 0.7
  newModel.top_p = 1.0
  newModel.max_tokens = 32768
  showAddModel.value = false
  saveConfig()
}

function removeModel(index: number) {
  if (editingIndex.value === index) editingIndex.value = null
  extraModels.value.splice(index, 1)
  saveConfig()
}

function startEditModel(i: number) {
  editingIndex.value = i
  Object.assign(editModel, extraModels.value[i])
}

function saveEditModel() {
  if (editingIndex.value === null) return
  extraModels.value[editingIndex.value] = { ...editModel }
  editingIndex.value = null
  saveConfig()
}

function cancelEditModel() { editingIndex.value = null }

onMounted(loadConfig)
watch(() => props.nodeType, loadConfig)
</script>

<template>
  <div class="p-8 max-w-3xl mx-auto space-y-8">
    <!-- 标题头 -->
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90 mb-1">{{ title }}</h1>
      <p class="text-sm text-base-content/40 font-medium">配置节点专用的 AI 大模型驱动渠道及核心运行参数</p>
    </div>

    <!-- 保存成功提示 -->
    <div v-if="saved" class="alert alert-success bg-success/10 border-success/20 text-success text-xs font-semibold rounded-xl flex items-center gap-2.5 p-4 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span>节点配置已成功同步到系统数据库</span>
    </div>

    <div class="flex flex-col gap-6">
      <!-- 启用状态开关卡片 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm p-5 rounded-2xl">
        <label class="label cursor-pointer justify-between w-full">
          <div class="space-y-0.5">
            <span class="label-text font-bold text-base-content/80 text-sm">启用此节点类型</span>
            <p class="text-[11px] text-base-content/40 font-medium">关闭后，画布端将无法添加或执行此类型的节点组件</p>
          </div>
          <input v-model.number="form.enabled" type="checkbox" class="toggle toggle-primary toggle-md" :true-value="1" :false-value="0" />
        </label>
      </div>

      <!-- AI 模型核心配置 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-100 px-6 py-4">
          <h3 class="text-sm font-bold text-base-content/80">主模型渠道配置</h3>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label class="form-control w-full">
              <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">默认模型名称</span></div>
              <input v-model="form.model_name" type="text" placeholder="例如: gpt-4o" class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
            </label>

            <label class="form-control w-full">
              <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">API 渠道</span></div>
              <input v-model="form.api_channel" type="text" placeholder="例如: OpenAI" class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm" />
            </label>
          </div>

          <label class="form-control w-full">
            <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">Base URL (接口请求基准地址)</span></div>
            <input v-model="form.base_url" type="text" placeholder="https://api.openai.com/v1" class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
            <div class="label py-0.5"><span class="label-text-alt text-[9px] text-base-content/25 font-medium">指向兼容 OpenAI Chat Completions 格式的 API 端点。常见值：OpenAI=https://api.openai.com/v1，DeepSeek=https://api.deepseek.com/v1</span></div>
          </label>

          <label class="form-control w-full">
            <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">API Key (鉴权密钥)</span></div>
            <input v-model="form.api_key" type="password" placeholder="sk-..." class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
            <div class="label py-0.5"><span class="label-text-alt text-[9px] text-base-content/25 font-medium">密钥仅本地存储于 SQLite 数据库，不会上传至任何云端服务。留空则不发送 Authorization 头</span></div>
          </label>
        </div>
      </div>

      <!-- 附加模型列表 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-100 px-6 py-4 flex items-center justify-between">
          <div class="space-y-0.5">
            <h3 class="text-sm font-bold text-base-content/80">候选附加模型</h3>
            <p class="text-[10px] text-base-content/40 font-medium">配置多个可用大模型，节点使用时在画布面板下拉菜单中自由切选</p>
          </div>
          <button v-if="!showAddModel" class="btn btn-ghost hover:bg-primary/10 text-primary btn-xs font-bold gap-1 rounded-lg" @click="showAddModel = true">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            添加模型
          </button>
        </div>

        <div class="p-6">
          <div v-if="extraModels.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div v-for="(m, i) in extraModels" :key="i" class="relative group">
              <!-- 编辑中 -->
              <div v-if="editingIndex === i" class="bg-base-200/10 rounded-2xl p-4 border border-base-200/80 space-y-3 shadow-inner">
                <div class="flex items-center justify-between border-b border-base-200/60 pb-1.5 mb-1">
                  <h4 class="text-xs font-extrabold text-base-content/80">编辑候选模型</h4>
                  <button class="text-base-content/40 hover:text-base-content text-[11px] font-bold" @click="cancelEditModel">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-2.5">
                  <label class="form-control w-full"><div class="label py-0"><span class="label-text text-[9px] font-bold text-base-content/40">名称</span></div><input v-model="editModel.name" class="input input-bordered input-xs w-full text-xs font-mono" /></label>
                  <label class="form-control w-full"><div class="label py-0"><span class="label-text text-[9px] font-bold text-base-content/40">渠道</span></div><input v-model="editModel.channel" class="input input-bordered input-xs w-full text-xs" /></label>
                </div>
                <label class="form-control w-full"><div class="label py-0"><span class="label-text text-[9px] font-bold text-base-content/40">Base URL</span></div><input v-model="editModel.base_url" class="input input-bordered input-xs w-full text-xs font-mono" /></label>
                <label class="form-control w-full"><div class="label py-0"><span class="label-text text-[9px] font-bold text-base-content/40">API Key</span></div><input v-model="editModel.api_key" type="password" class="input input-bordered input-xs w-full text-xs font-mono" /></label>
                <label v-if="nodeType === 'image'" class="form-control w-full"><div class="label py-0"><span class="label-text text-[9px] font-bold text-base-content/40">协议</span></div>
                  <select v-model="editModel.protocol" class="select select-xs select-bordered w-full text-xs font-bold">
                    <option value="">跟随默认</option>
                    <option value="chat">Chat 生图 (Gemini)</option>
                    <option value="local">本地协议</option>
                    <option value="openai-gen">OpenAI 生图</option>
                    <option value="openai-edit">OpenAI 改图</option>
                  </select>
                </label>
                <div class="flex gap-2 justify-end pt-1">
                  <button class="btn btn-primary btn-xs px-3 rounded-lg font-bold" @click="saveEditModel">确认</button>
                  <button class="btn btn-ghost btn-xs px-3 rounded-lg font-bold" @click="cancelEditModel">取消</button>
                </div>
              </div>
              <!-- 正常展示 -->
              <div v-else class="flex items-center justify-between gap-3 bg-base-100 rounded-xl p-3 border border-base-200/80 shadow-sm hover:border-base-300 transition-colors">
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-extrabold text-base-content/85 truncate font-mono">{{ m.name }}</span>
                    <span class="badge badge-sm badge-ghost text-[9px] font-bold py-0 h-4.5 rounded-md px-1.5 opacity-60">{{ m.channel || '渠道未知' }}</span>
                    <span v-if="nodeType === 'image' && m.protocol" class="badge badge-sm text-[9px] font-bold py-0 h-4.5 rounded-md px-1.5" :class="m.protocol === 'chat' ? 'bg-purple-500/15 text-purple-400 border-purple-500/20' : m.protocol === 'local' ? 'bg-info/15 text-info border-info/20' : m.protocol === 'openai-edit' ? 'bg-warning/15 text-warning border-warning/20' : 'bg-primary/15 text-primary border-primary/20'">{{ { chat: 'Chat生图', local: '本地', 'openai-gen': 'OAI生图', 'openai-edit': 'OAI改图' }[m.protocol] }}</span>
                  </div>
                  <span class="text-[10px] text-base-content/35 block truncate font-mono">{{ m.base_url || '使用通道默认地址' }}</span>
                </div>
                <div class="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="btn btn-ghost hover:bg-primary/10 text-primary btn-xs rounded-lg px-2 text-[10px] font-bold" @click="startEditModel(i)">编辑</button>
                  <button class="btn btn-ghost hover:bg-error/10 hover:text-error btn-xs rounded-lg px-2 text-[10px] font-bold" @click="removeModel(i)">删除</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="!showAddModel" class="text-center py-6">
            <p class="text-xs text-base-content/30 font-medium">暂无附加可选模型</p>
          </div>

          <!-- 添加新模型子表单 -->
          <div v-if="showAddModel" class="bg-base-200/10 rounded-2xl p-5 border border-base-200/80 space-y-4 shadow-inner">
            <div class="flex items-center justify-between border-b border-base-200/60 pb-2 mb-2">
              <h4 class="text-xs font-extrabold text-base-content/80">新增大模型候选</h4>
              <button class="text-base-content/40 hover:text-base-content text-[11px] font-bold" @click="showAddModel = false">✕</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label class="form-control w-full">
                <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">模型名称</span></div>
                <input v-model="newModel.name" type="text" placeholder="gpt-4o" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
              </label>
              <label class="form-control w-full">
                <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">API 渠道</span></div>
                <input v-model="newModel.channel" type="text" placeholder="OpenAI" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs" />
              </label>
            </div>
            <label class="form-control w-full">
              <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">Base URL</span></div>
              <input v-model="newModel.base_url" type="text" placeholder="https://api.openai.com" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
            </label>
            <label class="form-control w-full">
              <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">API Key</span></div>
              <input v-model="newModel.api_key" type="password" placeholder="sk-..." class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
            </label>
            <!-- 图片节点专用: 协议选择 -->
            <label v-if="nodeType === 'image'" class="form-control w-full">
              <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">调用协议</span></div>
              <select v-model="newModel.protocol" class="select select-sm select-bordered w-full focus:ring-1 focus:ring-primary/10 text-xs font-bold">
                <option value="">跟随默认 (OpenAI 生图)</option>
                <option value="chat">Chat 生图 (Gemini 对话式)</option>
                <option value="local">本地协议 (chatgpt2api)</option>
                <option value="openai-gen">OpenAI 生图 (t2i)</option>
                <option value="openai-edit">OpenAI 改图 (img2img)</option>
              </select>
            </label>
            <div class="flex gap-2 pt-2 justify-end">
              <button class="btn btn-primary btn-xs px-3 rounded-lg font-bold" @click="addModel">保存并添加</button>
              <button class="btn btn-ghost btn-xs px-3 rounded-lg font-bold" @click="showAddModel = false">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 模型参数 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-100 px-6 py-4">
          <h3 class="text-sm font-bold text-base-content/80">默认超参设置</h3>
        </div>
        <div class="p-6 space-y-6">
          <label class="form-control w-full">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-base-content/50">Temperature (采样温度 / 创造力)</span>
              <span class="badge badge-sm badge-primary text-[10px] font-mono font-bold">{{ form.temperature }}</span>
            </div>
            <input v-model.number="form.temperature" type="range" min="0" max="2" step="0.1" class="range range-xs range-primary" />
            <div class="flex justify-between text-[10px] text-base-content/30 mt-1 font-medium"><span>0.0 (最精准)</span><span>1.0 (流利)</span><span>2.0 (最具创意)</span></div>
          </label>

          <label class="form-control w-full">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-base-content/50">Top P (核心概率阈值采样)</span>
              <span class="badge badge-sm badge-primary text-[10px] font-mono font-bold">{{ form.top_p }}</span>
            </div>
            <input v-model.number="form.top_p" type="range" min="0" max="1" step="0.05" class="range range-xs range-primary" />
            <div class="flex justify-between text-[10px] text-base-content/30 mt-1 font-medium"><span>0.0</span><span>0.5</span><span>1.0 (保留全样本)</span></div>
          </label>

          <label class="form-control w-full">
            <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">Max Tokens (单词限制)</span></div>
            <input v-model.number="form.max_tokens" type="number" class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
          </label>
        </div>
      </div>

      <!-- 提示词模板 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-100 px-6 py-4">
          <h3 class="text-sm font-bold text-base-content/80">提示词系统模板</h3>
        </div>
        <div class="p-6">
          <label class="form-control w-full">
            <div class="label py-0.5"><span class="label-text-alt text-[10px] font-bold text-base-content/30">支持用双花括号接收上游变量（如： &#123;&#123;变量名&#125;&#125;）</span></div>
            <textarea v-model="form.prompt_template" class="textarea textarea-bordered w-full h-32 focus:ring-2 focus:ring-primary/15 text-sm leading-relaxed p-4" placeholder="请对上游输入内容进行生成：\n{{content}}"></textarea>
          </label>
        </div>
      </div>

      <!-- 扩展配置 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-100 px-6 py-4">
          <h3 class="text-sm font-bold text-base-content/80">扩展高级配置 (JSON格式)</h3>
        </div>
        <div class="p-6">
          <label class="form-control w-full">
            <textarea v-model="form.extra_config" class="textarea textarea-bordered w-full h-24 font-mono text-xs focus:ring-2 focus:ring-primary/15 leading-relaxed p-4" placeholder='{"models": [], "custom_headers": {"X-Custom": "value"}}'></textarea>
          </label>
        </div>
      </div>

      <!-- 保存操作按钮 -->
      <button class="btn btn-primary btn-md w-full rounded-2xl font-bold tracking-widest text-sm shadow-md transition-all duration-200 active:scale-[0.98]" :class="{ 'btn-disabled opacity-60': loading }" @click="saveConfig">
        <span v-if="loading" class="loading loading-spinner loading-xs mr-1"></span>
        {{ loading ? '保存中...' : '同步并保存配置' }}
      </button>
    </div>
  </div>
</template>

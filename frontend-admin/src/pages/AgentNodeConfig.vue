<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'

interface ModelEntry {
  name: string
  channel: string
  base_url: string
  api_key: string
  temperature: number
  top_p: number
  max_tokens: number
  supports_vision: boolean
}

interface Role {
  key: string
  label: string
  prompt: string
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

const nodeType = 'agent'

const form = ref<FormData>({
  enabled: 1, model_name: '', api_channel: '', base_url: '', api_key: '',
  temperature: 0.7, top_p: 1.0, max_tokens: 32768,
  prompt_template: '', extra_config: '',
})

const extraModels = ref<ModelEntry[]>([])
const roles = ref<Role[]>([])
const loading = ref(false)
const saved = ref(false)
const showAddModel = ref(false)
const showAddRole = ref(false)
const editingModelIndex = ref<number | null>(null)
const editingRoleIndex = ref<number | null>(null)
const newModel = reactive<ModelEntry>({ name: '', channel: '', base_url: '', api_key: '', temperature: 0.7, top_p: 1.0, max_tokens: 32768, supports_vision: false })
const newRole = reactive<Role>({ key: '', label: '', prompt: '' })
const editModel = reactive<ModelEntry>({ name: '', channel: '', base_url: '', api_key: '', temperature: 0.7, top_p: 1.0, max_tokens: 32768, supports_vision: false })
const editRole = reactive<Role>({ key: '', label: '', prompt: '' })

function parseJSON(raw: string): Record<string, any> {
  try { return JSON.parse(raw) } catch { return {} }
}

async function load() {
  try {
    const res = await fetch(`/api/admin/node-configs/${nodeType}`)
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
    const ec = parseJSON(data.extra_config || '{}')
    extraModels.value = Array.isArray(ec.models) ? ec.models : []
    roles.value = Array.isArray(ec.roles) ? ec.roles : []
  } catch (e) { console.error(e) }
}

async function save() {
  loading.value = true
  saved.value = false
  try {
    const parameters = JSON.stringify({ temperature: form.value.temperature, top_p: form.value.top_p, max_tokens: form.value.max_tokens })
    const ec = parseJSON(form.value.extra_config || '{}')
    ec.models = extraModels.value
    ec.roles = roles.value
    await fetch(`/api/admin/node-configs/${nodeType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: form.value.enabled,
        model_name: form.value.model_name, api_channel: form.value.api_channel,
        base_url: form.value.base_url, api_key: form.value.api_key,
        parameters, prompt_template: form.value.prompt_template,
        extra_config: JSON.stringify(ec),
      }),
    })
    saved.value = true
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function addModel() {
  if (!newModel.name.trim()) return
  extraModels.value.push({ ...newModel })
  newModel.name = ''; newModel.channel = ''; newModel.base_url = ''; newModel.api_key = ''
  newModel.temperature = 0.7; newModel.top_p = 1.0; newModel.max_tokens = 32768; newModel.supports_vision = false
  showAddModel.value = false
  save()
}

function startEditModel(i: number) { editingModelIndex.value = i; Object.assign(editModel, extraModels.value[i]) }
function saveEditModel() {
  if (editingModelIndex.value === null) return
  extraModels.value[editingModelIndex.value] = { ...editModel }
  editingModelIndex.value = null
  save()
}
function cancelEditModel() { editingModelIndex.value = null }
function removeModel(i: number) {
  if (editingModelIndex.value === i) editingModelIndex.value = null
  extraModels.value.splice(i, 1)
  save()
}

function addRole() {
  if (!newRole.key.trim() || !newRole.label.trim()) return
  roles.value.push({ ...newRole })
  newRole.key = ''; newRole.label = ''; newRole.prompt = ''
  showAddRole.value = false
  save()
}

function startEditRole(i: number) { editingRoleIndex.value = i; Object.assign(editRole, roles.value[i]) }
function saveEditRole() {
  if (editingRoleIndex.value === null) return
  roles.value[editingRoleIndex.value] = { ...editRole }
  editingRoleIndex.value = null
  save()
}
function cancelEditRole() { editingRoleIndex.value = null }
function removeRole(i: number) {
  if (editingRoleIndex.value === i) editingRoleIndex.value = null
  roles.value.splice(i, 1)
  save()
}

onMounted(load)
</script>

<template>
  <div class="p-8 max-w-3xl mx-auto space-y-8">
    <!-- 标题头 -->
    <div>
      <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90 mb-1">智能体节点配置</h1>
      <p class="text-sm text-base-content/40 font-medium">配置多轮对话角色参数以及附加的模型调配渠道</p>
    </div>

    <!-- 保存成功提示 -->
    <div v-if="saved" class="alert alert-success bg-success/10 border-success/20 text-success text-xs font-semibold rounded-xl flex items-center gap-2.5 p-4 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span>智能体节点配置已成功同步到系统数据库</span>
    </div>

    <div class="flex flex-col gap-6">
      <!-- 启用状态开关卡片 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm p-5 rounded-2xl">
        <label class="label cursor-pointer justify-between w-full">
          <div class="space-y-0.5">
            <span class="label-text font-bold text-base-content/80 text-sm">启用智能体节点</span>
            <p class="text-[11px] text-base-content/40 font-medium">控制画布端智能体多轮对话组件是否处于可用激活状态</p>
          </div>
          <input v-model.number="form.enabled" type="checkbox" class="toggle toggle-primary toggle-md" :true-value="1" :false-value="0" />
        </label>
      </div>

      <!-- AI 主模型配置 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-200/25 px-6 py-4">
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
            <input v-model="form.base_url" type="text" placeholder="https://api.openai.com" class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
          </label>

          <label class="form-control w-full">
            <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">API Key</span></div>
            <input v-model="form.api_key" type="password" placeholder="sk-..." class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
          </label>
        </div>
      </div>

      <!-- 附加候选模型 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-200/25 px-6 py-4 flex items-center justify-between">
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
          <div v-if="extraModels.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="(m, i) in extraModels" :key="i" class="relative group">
              <!-- 编辑子表单 -->
              <div v-if="editingModelIndex === i" class="bg-base-200/10 rounded-2xl p-5 border border-base-200/80 space-y-4 shadow-inner">
                <div class="flex items-center justify-between border-b border-base-200/60 pb-2 mb-2">
                  <h4 class="text-xs font-extrabold text-base-content/80">编辑模型渠道</h4>
                  <button class="text-base-content/40 hover:text-base-content text-[11px] font-bold" @click="cancelEditModel">✕</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label class="form-control w-full">
                    <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">模型名称</span></div>
                    <input v-model="editModel.name" type="text" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
                  </label>
                  <label class="form-control w-full">
                    <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">API 渠道</span></div>
                    <input v-model="editModel.channel" type="text" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs" />
                  </label>
                </div>
                <label class="form-control w-full">
                  <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">Base URL</span></div>
                  <input v-model="editModel.base_url" type="text" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
                </label>
                <label class="form-control w-full">
                  <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">API Key</span></div>
                  <input v-model="editModel.api_key" type="password" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
                </label>
                <label class="cursor-pointer flex items-center gap-2 py-1"><input v-model="editModel.supports_vision" type="checkbox" class="checkbox checkbox-xs checkbox-primary rounded" /><span class="text-xs font-bold text-base-content/60">支持多模态识图</span></label>
                <div class="flex gap-2 justify-end">
                  <button class="btn btn-primary btn-xs px-3 rounded-lg font-bold" @click="saveEditModel">确认修改</button>
                  <button class="btn btn-ghost btn-xs px-3 rounded-lg font-bold" @click="cancelEditModel">取消</button>
                </div>
              </div>

              <!-- 展示卡片 -->
              <div v-else class="flex items-center justify-between gap-3 bg-base-100 rounded-xl p-4 border border-base-200/80 shadow-sm hover:border-base-300 transition-colors">
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-extrabold text-base-content/85 truncate font-mono">{{ m.name }}</span>
                    <span class="badge badge-sm badge-ghost text-[9px] font-bold py-0 h-4.5 rounded-md px-1.5 opacity-60">{{ m.channel || '普通渠道' }}</span>
                    <span v-if="m.supports_vision" class="badge badge-sm badge-primary text-[9px] font-bold py-0 h-4.5 rounded-md px-1.5">多模态</span>
                  </div>
                  <span class="text-[10px] text-base-content/35 block truncate font-mono">{{ m.base_url || '使用渠道默认请求地址' }}</span>
                </div>
                <div class="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="btn btn-ghost hover:bg-primary/10 text-primary btn-xs rounded-lg px-2 text-[10px] font-bold" @click="startEditModel(i)">编辑</button>
                  <button class="btn btn-ghost hover:bg-error/10 hover:text-error btn-xs rounded-lg px-2 text-[10px] font-bold" @click="removeModel(i)">删除</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 添加附加模型表单 -->
          <div v-if="showAddModel" class="bg-base-200/10 rounded-2xl p-5 border border-base-200/80 space-y-4 shadow-inner">
            <div class="flex items-center justify-between border-b border-base-200/60 pb-2 mb-2">
              <h4 class="text-xs font-extrabold text-base-content/80">新增附加模型选项</h4>
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
            <label class="cursor-pointer flex items-center gap-2 py-1"><input v-model="newModel.supports_vision" type="checkbox" class="checkbox checkbox-xs checkbox-primary rounded" /><span class="text-xs font-bold text-base-content/60">支持多模态（图片识别）</span></label>
            <div class="flex gap-2 pt-2 justify-end">
              <button class="btn btn-primary btn-xs px-3 rounded-lg font-bold" @click="addModel">保存并添加</button>
              <button class="btn btn-ghost btn-xs px-3 rounded-lg font-bold" @click="showAddModel = false">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 模型基础参数设定 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-200/25 px-6 py-4">
          <h3 class="text-sm font-bold text-base-content/80">基础超参设置</h3>
        </div>
        <div class="p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label class="form-control w-full">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold text-base-content/50">Temperature (采样温度)</span>
                <span class="badge badge-sm badge-primary text-[10px] font-mono font-bold">{{ form.temperature }}</span>
              </div>
              <input v-model.number="form.temperature" type="range" min="0" max="2" step="0.1" class="range range-xs range-primary" />
              <div class="flex justify-between text-[10px] text-base-content/30 mt-1 font-medium"><span>0.0 (严谨)</span><span>2.0 (开放)</span></div>
            </label>

            <label class="form-control w-full">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-bold text-base-content/50">Top P (采样概率空间)</span>
                <span class="badge badge-sm badge-primary text-[10px] font-mono font-bold">{{ form.top_p }}</span>
              </div>
              <input v-model.number="form.top_p" type="range" min="0" max="1" step="0.05" class="range range-xs range-primary" />
              <div class="flex justify-between text-[10px] text-base-content/30 mt-1 font-medium"><span>0.0</span><span>1.0</span></div>
            </label>
          </div>
          <label class="form-control w-full">
            <div class="label py-1"><span class="label-text text-xs font-bold text-base-content/50">Max Tokens 单次响应最大长度上限</span></div>
            <input v-model.number="form.max_tokens" type="number" class="input input-bordered input-md w-full focus:ring-2 focus:ring-primary/15 text-sm font-mono" />
          </label>
        </div>
      </div>

      <!-- 角色模板库配置 -->
      <div class="card bg-base-100 border border-base-200/80 shadow-sm rounded-2xl overflow-hidden">
        <div class="border-b border-base-200/80 bg-base-200/25 px-6 py-4 flex items-center justify-between">
          <div class="space-y-0.5">
            <h3 class="text-sm font-bold text-base-content/80">角色提示词模板库</h3>
            <p class="text-[10px] text-base-content/40 font-medium">定义各种专属角色（Persona），支持配置系统提示词</p>
          </div>
          <button v-if="!showAddRole" class="btn btn-ghost hover:bg-primary/10 text-primary btn-xs font-bold gap-1 rounded-lg" @click="showAddRole = true">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            添加角色
          </button>
        </div>

        <div class="p-6">
          <div v-if="roles.length > 0" class="flex flex-col gap-4">
            <div v-for="(r, i) in roles" :key="i" class="relative group">
              <!-- 编辑子表单 -->
              <div v-if="editingRoleIndex === i" class="bg-base-200/10 rounded-2xl p-5 border border-base-200/80 space-y-4 shadow-inner">
                <div class="flex items-center justify-between border-b border-base-200/60 pb-2 mb-2">
                  <h4 class="text-xs font-extrabold text-base-content/80">编辑角色配置</h4>
                  <button class="text-base-content/40 hover:text-base-content text-[11px] font-bold" @click="cancelEditRole">✕</button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <label class="form-control w-full">
                    <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">角色标识</span></div>
                    <input v-model="editRole.key" type="text" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
                  </label>
                  <label class="form-control w-full">
                    <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">角色展示名称</span></div>
                    <input v-model="editRole.label" type="text" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs" />
                  </label>
                </div>
                <label class="form-control w-full">
                  <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">系统 System Prompt</span></div>
                  <textarea v-model="editRole.prompt" class="textarea textarea-bordered w-full h-24 focus:ring-1 focus:ring-primary/10 text-xs leading-relaxed" />
                </label>
                <div class="flex gap-2 justify-end">
                  <button class="btn btn-primary btn-xs px-3 rounded-lg font-bold" @click="saveEditRole">确认修改</button>
                  <button class="btn btn-ghost btn-xs px-3 rounded-lg font-bold" @click="cancelEditRole">取消</button>
                </div>
              </div>

              <!-- 展示卡片 -->
              <div v-else class="bg-base-100 rounded-xl p-4 border border-base-200/85 hover:border-base-300 transition-colors shadow-sm">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs font-extrabold text-base-content/85">{{ r.label }}</span>
                    <code class="text-[9px] bg-slate-100 text-slate-500 font-bold font-mono px-2 py-0.5 rounded-md">{{ r.key }}</code>
                  </div>
                  <div class="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn btn-ghost hover:bg-primary/10 text-primary btn-xs rounded-lg px-2 text-[10px] font-bold" @click="startEditRole(i)">编辑</button>
                    <button class="btn btn-ghost hover:bg-error/10 hover:text-error btn-xs rounded-lg px-2 text-[10px] font-bold" @click="removeRole(i)">删除</button>
                  </div>
                </div>
                <p class="text-xs text-base-content/40 leading-relaxed font-medium line-clamp-3 whitespace-pre-wrap">{{ r.prompt || '（未配置 System Prompt）' }}</p>
              </div>
            </div>
          </div>
          <div v-else-if="!showAddRole" class="text-center py-6">
            <p class="text-xs text-base-content/30 font-medium">暂无任何预设角色配置模板</p>
          </div>

          <!-- 新建角色表单 -->
          <div v-if="showAddRole" class="bg-base-200/10 rounded-2xl p-5 border border-base-200/80 space-y-4 shadow-inner">
            <div class="flex items-center justify-between border-b border-base-200/60 pb-2 mb-2">
              <h4 class="text-xs font-extrabold text-base-content/80">新增智能体系统预设</h4>
              <button class="text-base-content/40 hover:text-base-content text-[11px] font-bold" @click="showAddRole = false">✕</button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="form-control w-full">
                <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">唯一英文标识 (key)</span></div>
                <input v-model="newRole.key" type="text" placeholder="例如: translator" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs font-mono" />
              </label>
              <label class="form-control w-full">
                <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">角色名称</span></div>
                <input v-model="newRole.label" type="text" placeholder="例如: 翻译官" class="input input-bordered input-sm w-full focus:ring-1 focus:ring-primary/10 text-xs" />
              </label>
            </div>
            <label class="form-control w-full">
              <div class="label py-0.5"><span class="label-text text-[10px] font-bold text-base-content/50">角色扮演提示词 (System Prompt)</span></div>
              <textarea v-model="newRole.prompt" class="textarea textarea-bordered w-full h-24 focus:ring-1 focus:ring-primary/10 text-xs leading-relaxed" placeholder="你现在是一个专业的翻译官，请把用户发送的任何输入进行精确英汉互译..." />
            </label>
            <div class="flex gap-2 pt-2 justify-end">
              <button class="btn btn-primary btn-xs px-3 rounded-lg font-bold" @click="addRole">同步并添加</button>
              <button class="btn btn-ghost btn-xs px-3 rounded-lg font-bold" @click="showAddRole = false">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 保存配置主按钮 -->
      <button class="btn btn-primary btn-md w-full rounded-2xl font-bold tracking-widest text-sm shadow-md transition-all duration-200 active:scale-[0.98]" :class="{ 'btn-disabled opacity-60': loading }" @click="save">
        <span v-if="loading" class="loading loading-spinner loading-xs mr-1"></span>
        {{ loading ? '同步中...' : '同步并保存配置' }}
      </button>
    </div>
  </div>
</template>

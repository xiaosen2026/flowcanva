<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from 'vue'
import type { Node } from '../../types'

const props = defineProps<{
  node: Node | null
  panelStyle: Record<string, string>
  nodeInputs?: { edgeId: string; sourceNodeId: string; sourceNodeType: string; data: any }[]
  assets?: any[]
}>()
const emit = defineEmits<{ (e: 'save', content: string): void }>()

interface Variable { name: string; value: string; type: 'image' | 'video' | 'audio' | 'text' }

const serverUrl = ref('http://localhost:8188')
const workflowJson = ref('')
const name = ref('')
const variables = ref<Variable[]>([])
const outputVarName = ref('')
const outputType = ref<'image'|'video'|'audio'|'text'>('text')
const outputVars = ref<string[]>([])
const outputs = ref<{ name: string; value: string; type: 'image' | 'video' | 'audio' | 'text' }[]>([])
const isRunning = ref(false)
const errorMsg = ref('')
const fullscreen = ref(false)
const newVarName = ref('')
const newVarValue = ref('')
const runningId = ref<string | null>(null)

// 自动补全状态
const showAutocomplete = ref(false)
const autocompleteFilter = ref('')
const autocompleteIndex = ref(0)
const jsonArea = ref<HTMLDivElement | null>(null)

function stopExecution() { isRunning.value = false; runningId.value = null }

// 组件卸载时停止轮询(递归setTimeout通过runningId失配自然终止)
onUnmounted(() => { runningId.value = null })

async function pollResults(id: string) {
  runningId.value = id
  const start = Date.now()
  const poll = async () => {
    if (runningId.value !== id) return
    try {
      const res = await fetch(`/api/comfyui/result/${id}?server_url=${encodeURIComponent(serverUrl.value)}`)
      const d = await res.json()
      if (d.outputs?.length) {
        outputs.value = d.outputs.map((o: any, i: number) => {
          const kind = o.kind || 'image'
          const type = kind === 'text' ? 'text' : kind === 'gif' ? 'video' : outputType.value
          return { name: `输出${d.outputs.length > 1 ? i + 1 : ''}`, value: o.url || o.value, type }
        })
        isRunning.value = false; runningId.value = null; save()
        return
      }
      if (Date.now() - start > 120000) { errorMsg.value = '超时'; isRunning.value = false; runningId.value = null; return }
    } catch { /* retry */ }
    setTimeout(poll, 3000)
  }
  setTimeout(poll, 3000)
}
function reset() { serverUrl.value = 'http://localhost:8188'; workflowJson.value = ''; name.value = ''; variables.value = []; outputVars.value = ['输出']; outputs.value = [] }
watch(() => props.node?.id, loadContent, { immediate: true })

function save() { emit('save', JSON.stringify({ serverUrl: serverUrl.value, workflowJson: workflowJson.value, name: name.value, variables: variables.value, outputVars: outputVars.value, outputs: outputs.value })) }
function addVar() { const n = newVarName.value.trim(); if (!n) return; variables.value.push({ name: n, value: newVarValue.value, type: 'text' }); newVarName.value = ''; newVarValue.value = ''; save() }
function removeVar(i: number) { variables.value.splice(i, 1); save() }
function onVarChange() { save() }

async function execute() {
  errorMsg.value = ''; isRunning.value = true; save()
  try {
    let wfStr = workflowJson.value
    for (const v of variables.value) wfStr = wfStr.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.value)
    const wf = JSON.parse(wfStr)
    const res = await fetch('/api/comfyui/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ server_url: serverUrl.value, workflow_json: wf }) })
    const data = await res.json()
    if (!res.ok) { errorMsg.value = data.error || '失败'; isRunning.value = false; return }
    pollResults(data.prompt_id)
  } catch (e: any) { errorMsg.value = e.message || '请求失败'; isRunning.value = false }
}

// 加载节点保存的内容到面板状态
function loadContent() {
  if (!props.node?.content) { reset(); return }
  try {
    const d = JSON.parse(props.node.content)
    serverUrl.value = d.serverUrl || 'http://localhost:8188'
    workflowJson.value = d.workflowJson || ''
    name.value = d.name || ''
    variables.value = d.variables || []
    outputVars.value = d.outputVars?.length ? d.outputVars : ['输出']
    outputs.value = d.outputs || []
  } catch { reset() }
}

// 已连接的媒体资源(图片/视频/音频)供变量下拉选择
const connectedMedia = computed(() => {
  const inputs = props.nodeInputs || []
  return inputs.filter(ni => ni.data?.url).map(ni => ({ url: ni.data.url, label: ni.sourceNodeType === 'image' ? '图片' : ni.sourceNodeType === 'video' ? '视频' : '连线' }))
})

// 过滤后的补全变量列表
const filteredVars = computed(() => {
  const all = [...variables.value.map(v => v.name), ...outputVars.value]
  if (!autocompleteFilter.value) return all
  return all.filter(n => n.includes(autocompleteFilter.value))
})

function isInputVar(n: string) { return variables.value.some(v => v.name === n) }

// textarea JSON 编辑器:检测 {{ 触发补全
function onJsonInput() {
  const ta = document.querySelector('.flex-1.min-w-0 textarea') as HTMLTextAreaElement
  if (!ta) return
  const cursor = ta.selectionStart
  if (cursor >= 2 && ta.value.slice(cursor - 2, cursor) === '{{') {
    autocompleteIndex.value = 0; autocompleteFilter.value = ''; showAutocomplete.value = true
    acTop.value = Math.min(cursor, 60); acLeft.value = 8
  } else if (showAutocomplete.value) {
    const lastOpen = ta.value.lastIndexOf('{{', cursor)
    if (lastOpen >= 0) {
      const typed = ta.value.slice(lastOpen + 2, cursor)
      if (!typed.includes('}}') && !typed.includes('\n')) { autocompleteFilter.value = typed; autocompleteIndex.value = 0; return }
    }
    showAutocomplete.value = false
  }
}

// 插入选中变量到 textarea
function insertVar(varName: string) {
  const ta = document.querySelector('.flex-1.min-w-0 textarea') as HTMLTextAreaElement
  if (!ta) return
  const cursor = ta.selectionStart
  const lastOpen = ta.value.lastIndexOf('{{', cursor)
  if (lastOpen >= 0) {
    ta.value = ta.value.slice(0, lastOpen) + `{{${varName}}}` + ta.value.slice(cursor)
    ta.selectionStart = ta.selectionEnd = lastOpen + varName.length + 4
    workflowJson.value = ta.value
  }
  showAutocomplete.value = false; save()
}

// 输入变量框:检测 {{ 触发补全
function onInputVarKey(i: number, e: Event) {
  const inp = e.target as HTMLInputElement
  const cursor = inp.selectionStart || 0
  if (cursor >= 2 && inp.value.slice(cursor - 2, cursor) === '{{') {
    autocompleteIndex.value = 0; autocompleteFilter.value = ''; showAutocomplete.value = true
    const rect = inp.getBoundingClientRect()
    const editorRect = inp.closest('.flex-1')?.getBoundingClientRect()
    if (rect && editorRect) { acTop.value = rect.bottom - editorRect.top + 2; acLeft.value = rect.left - editorRect.left }
  } else if (showAutocomplete.value) {
    const lastOpen = inp.value.lastIndexOf('{{', cursor)
    if (lastOpen >= 0) { autocompleteFilter.value = inp.value.slice(lastOpen + 2, cursor); autocompleteIndex.value = 0; return }
    showAutocomplete.value = false
  }
}

// 输入变量框:补全导航与确认
function onVarKeydown(e: KeyboardEvent) {
  if (!showAutocomplete.value) return
  if (e.key === 'Escape') { showAutocomplete.value = false; return }
  if (e.key === 'ArrowDown') { autocompleteIndex.value = Math.min(autocompleteIndex.value + 1, filteredVars.value.length - 1); e.preventDefault(); return }
  if (e.key === 'ArrowUp') { autocompleteIndex.value = Math.max(autocompleteIndex.value - 1, 0); e.preventDefault(); return }
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (filteredVars.value.length > 0) {
      const v = filteredVars.value[autocompleteIndex.value]
      const inp = e.target as HTMLInputElement
      const cursor = inp.selectionStart || 0
      const lastOpen = inp.value.lastIndexOf('{{', cursor)
      if (lastOpen >= 0) {
        inp.value = inp.value.slice(0, lastOpen) + `{{${v}}}` + inp.value.slice(cursor)
        inp.selectionStart = inp.selectionEnd = lastOpen + v.length + 4
        showAutocomplete.value = false; save()
      }
      e.preventDefault()
    }
    return
  }
}

// 粘贴剪贴板 JSON 到编辑器
function pasteJson() {
  navigator.clipboard.readText().then(t => {
    try { JSON.parse(t); workflowJson.value = t; errorMsg.value = '✅ 已粘贴'; save() } catch { errorMsg.value = 'JSON格式错误' }
    setTimeout(() => { if (errorMsg.value === '✅ 已粘贴') errorMsg.value = '' }, 1500)
  }).catch(() => errorMsg.value = '剪贴板读取失败')
}

// contenteditable JSON editor
const acTop = ref(0)
const acLeft = ref(0)

function updateAutocompletePosition() {
  if (!jsonArea.value) return
  const sel = window.getSelection()
  if (!sel?.rangeCount) return
  const range = sel.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rect = range.getClientRects()[0]
  const editorRect = jsonArea.value.getBoundingClientRect()
  if (rect && editorRect) {
    acTop.value = rect.bottom - editorRect.top + 4
    acLeft.value = rect.left - editorRect.left
  }
}

function countCaretBefore(tNode: any, offset: number): number {
  let count = 0
  if (!jsonArea.value) return count
  const walk = (node: any): boolean => {
    if (node === tNode) { count += offset; return true }
    if ((node as any).nodeType === 3) { count += (node as any).textContent?.length || 0 }
    else { for (const c of (node as any).childNodes || []) { if (walk(c)) return true } }
    return false
  }
  walk(jsonArea.value)
  return count
}

function onJsonKeydown(e: KeyboardEvent) {
  if (showAutocomplete.value) {
    if (e.key === 'Escape') { showAutocomplete.value = false; return }
    if (e.key === 'ArrowDown') { autocompleteIndex.value = Math.min(autocompleteIndex.value + 1, filteredVars.value.length - 1); e.preventDefault(); return }
    if (e.key === 'ArrowUp') { autocompleteIndex.value = Math.max(autocompleteIndex.value - 1, 0); e.preventDefault(); return }
    if (e.key === 'Enter' || e.key === 'Tab') { if (filteredVars.value.length > 0) { insertVar(filteredVars.value[autocompleteIndex.value]); e.preventDefault() }; return }
  }
}
</script>

<template>
  <div v-if="node" :style="panelStyle" class="pointer-events-auto bg-neutral-900/95 backdrop-blur rounded-2xl border border-white/20 p-2 space-y-1 max-h-[45vh] overflow-y-auto" @pointerdown.stop>
    <div class="flex items-center gap-1">
      <input v-model="name" @change="save()" placeholder="名称" class="flex-1 text-white/80 text-xs bg-transparent border-none outline-none" />
      <button class="h-5 px-1.5 rounded text-white/30 hover:text-white text-[10px] whitespace-nowrap inline-flex items-center gap-0.5" @click="fullscreen = true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.665.87.35.183.772.21 1.144.07l1.169-.474a1.125 1.125 0 0 1 1.37.49l1.297 2.247a1.125 1.125 0 0 1-.27 1.401l-.978.907c-.287.266-.413.66-.34 1.043.073.384.073.78 0 1.164-.073.384.053.777.34 1.043l.978.907c.404.374.523.954.27 1.401l-1.297 2.247a1.125 1.125 0 0 1-1.37.49l-1.169-.474a1.13 1.13 0 0 0-1.144.07c-.352.184-.602.496-.665.87l-.213 1.281c-.09.542-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281a1.13 1.13 0 0 0-.665-.87 1.13 1.13 0 0 0-1.144-.07l-1.169.474a1.125 1.125 0 0 1-1.37-.49L3.6 13.093a1.125 1.125 0 0 1 .27-1.401l.978-.907c.287-.266.413-.66.34-1.043a4.5 4.5 0 0 1 0-1.164c.073-.384-.053-.777-.34-1.043L3.6 5.63a1.125 1.125 0 0 1-.27-1.4l1.297-2.248a1.125 1.125 0 0 1 1.37-.49l1.169.474c.372.14.794.113 1.144-.07a1.13 1.13 0 0 0 .665-.87L9.594 3.94Z"/><circle cx="12" cy="12" r="3"/></svg>
        高级配置
      </button>
      <button class="h-5 px-1.5 text-[10px] rounded bg-white/5 text-white/40 hover:text-white" @click="pasteJson">📋</button>
    </div>
    <input v-model="serverUrl" @change="save()" placeholder="http://localhost:8188" class="w-full h-5 text-[10px] bg-white/5 border border-white/10 rounded px-1.5 text-white/50 outline-none" />
    <div class="flex items-center gap-1 text-[9px] text-white/25">
      <span>{{ variables.length }} 入</span><span>·</span><span>{{ outputVars.length }} 出</span><span class="text-white/15 ml-auto cursor-pointer hover:text-white/40" @click="fullscreen=true">高级 ⛶</span>
    </div>
    <div v-for="(v, i) in variables.slice(0, 4)" :key="i" class="flex items-center gap-1">
      <span class="text-yellow-300/60 text-[9px] w-12 truncate">{{ v.name }}</span>
      <template v-if="v.type === 'image' || v.type === 'video' || v.type === 'audio'">
        <img v-if="v.value" :src="v.value" class="h-6 w-6 rounded object-cover border border-white/10" />
        <select v-model="v.value" @change="onVarChange()" class="flex-1 h-5 text-[8px] bg-white/5 border border-white/10 rounded px-1 text-white/50 outline-none">
          <option value="">(空)</option>
          <option v-for="ni in connectedMedia" :key="ni.url" :value="ni.url">{{ ni.label }}</option>
        </select>
      </template>
      <input v-else v-model="v.value" @input="onVarChange()" class="flex-1 h-5 text-[9px] bg-white/5 border border-white/10 rounded px-1 text-white/60 outline-none" />
    </div>
    <div class="flex gap-1">
      <button class="flex-1 h-6 text-[10px] rounded bg-cyan-500/20 text-cyan-400 disabled:opacity-30" :disabled="!workflowJson" @click="execute">{{ isRunning ? '执行中...' : '▶ 执行' }}</button>
      <button v-if="isRunning" class="h-6 px-2 text-[10px] rounded bg-red-500/20 text-red-400" @click="stopExecution">取消</button>
    </div>
    <div v-if="errorMsg" :class="errorMsg.startsWith('✅') ? 'text-green-400 text-[9px]' : 'text-red-400 text-[9px]'">{{ errorMsg }}</div>
  </div>

  <Teleport to="body">
    <div v-if="fullscreen" class="fixed inset-0 z-[10001] bg-neutral-950 flex flex-col" @keydown.escape="fullscreen = false">
      <div class="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <div class="flex items-center gap-2">
          <input v-model="name" @change="save()" class="text-white/80 text-sm bg-transparent border-none outline-none w-32" />
          <input v-model="serverUrl" @change="save()" class="h-6 w-44 text-[10px] bg-white/5 border border-white/10 rounded px-2 text-white/60 outline-none" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-white/25 text-[10px]">{{ variables.length }} 入 · {{ outputVars.length }} 出</span>
          <button class="h-6 px-2 text-[10px] rounded bg-cyan-500/20 text-cyan-400 disabled:opacity-40" :disabled="isRunning" @click="execute">{{ isRunning ? '执行中...' : '▶ 执行' }}</button>
          <button v-if="isRunning" class="h-6 px-2 text-[10px] rounded bg-red-500/20 text-red-400" @click="stopExecution">取消</button>
          <button class="h-6 w-6 rounded flex items-center justify-center text-white/40 hover:text-white text-xs" @click="fullscreen = false">✕</button>
        </div>
      </div>
      <div class="flex-1 min-h-0 flex">
        <!-- Left: input (yellow) -->
        <div class="w-60 border-r border-white/10 p-2 overflow-y-auto shrink-0 space-y-1">
          <div class="text-yellow-300/70 text-[9px] uppercase font-medium mb-1">输入变量 <span class="text-white/20">({{ variables.length }})</span></div>
          <div v-for="(v, i) in variables" :key="i" class="flex items-center gap-0.5 group border border-yellow-500/10 rounded px-1 py-0.5 hover:border-yellow-500/20">
            <span class="text-yellow-300/70 text-[9px] w-12 truncate font-mono">{{ v.name }}</span>
            <select v-model="v.type" @change="onVarChange()" class="h-4 text-[8px] bg-white/5 border border-white/10 rounded px-0.5 text-white/40 outline-none w-12">
              <option value="text">文本</option><option value="image">图片</option><option value="video">视频</option><option value="audio">音频</option>
            </select>
            <input v-model="v.value" @input="onVarChange(); onInputVarKey(i, $event)" @keydown="onVarKeydown($event)" class="flex-1 h-5 text-[9px] bg-white/5 border border-white/10 rounded px-1 text-white/60 outline-none" />
            <button class="text-white/10 hover:text-red-400 text-[9px] opacity-0 group-hover:opacity-100" @click="removeVar(i)">✕</button>
          </div>
          <div class="flex gap-0.5">
            <input v-model="newVarName" placeholder="变量名" class="w-16 h-5 text-[9px] bg-white/5 border border-yellow-500/20 rounded px-1 text-white/50 outline-none" />
            <input v-model="newVarValue" placeholder="值" class="flex-1 h-5 text-[9px] bg-white/5 border border-white/10 rounded px-1 text-white/50 outline-none" />
            <button class="h-5 px-1.5 rounded text-[9px] bg-yellow-500/20 text-yellow-400" @click="addVar">+</button>
          </div>
          <div v-if="errorMsg" :class="errorMsg.startsWith('✅') ? 'text-green-400 text-[9px]' : 'text-red-400 text-[9px]'">{{ errorMsg }}</div>
        </div>

        <!-- Center: JSON -->
        <div class="flex-1 flex flex-col min-w-0 relative">
          <textarea
            v-model="workflowJson"
            @change="save()"
            @keydown="onJsonKeydown"
            @input="onJsonInput"
            class="flex-1 w-full text-[9px] font-mono bg-neutral-900 border-none outline-none p-2 resize-none text-white/40 caret-white"
            style="font-family:monospace;tab-size:2"
            spellcheck="false"
            placeholder="ComfyUI JSON..."
          />
          <div v-if="showAutocomplete && filteredVars.length" class="absolute z-20 bg-neutral-800 border border-white/15 rounded-lg shadow-lg" :style="{top:acTop+'px',left:acLeft+'px',maxHeight:'120px',overflowY:'auto',minWidth:'100px'}">
            <div v-for="(v,i) in filteredVars.slice(0,8)" :key="v" class="px-2 py-1 text-[9px] cursor-pointer text-white/60" :class="[{'bg-yellow-500/10 text-yellow-300':i===autocompleteIndex && isInputVar(v),'bg-green-500/10 text-green-300':i===autocompleteIndex && !isInputVar(v)}]" @mousedown.prevent="insertVar(v)">&#123;&#123;{{ v }}&#125;&#125;</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

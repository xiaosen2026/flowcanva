<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import type { Node, Asset } from '../../types'
import MentionDropdown from '../MentionDropdown.vue'
import { useAssets } from '../../composables/useAssets'
import { useNodeConfigs } from '../../composables/useNodeConfigs'
import { chatWithLLMStream, chatWithLLM } from '../../api'

const props = defineProps<{
  node: Node | null
  panelStyle: Record<string, string>
  nodeInputs?: { edgeId: string; sourceNodeId: string; sourceNodeType: string; data: any }[]
  assets?: Asset[]
}>()

const emit = defineEmits<{
  (e: 'save', content: string): void
  (e: 'remove-connected-edge', edgeId: string): void
  (e: 'update-asset', id: string, data: { category?: string }): void
  (e: 'remove-asset', id: string): void
}>()

const { addAsset } = useAssets()
const { getModels, getModelConfig, getRoles } = useNodeConfigs()

const content = ref('')
const loading = ref(false)
const selectedModel = ref('GPT-4')
const modalOpen = ref(false)
const models = ref<string[]>(['GPT-4', 'Claude 3', 'Gemini'])
const outputTypes = ref<{ key: string; label: string; prompt: string }[]>([])
const selectedType = ref('text')
const sendMode = ref<'replace' | 'append'>('replace')

interface UploadImage {
  id: number
  name: string
  dataUrl: string
}
const images = ref<UploadImage[]>([])
let imageCounter = 0

const previewImg = ref<UploadImage | null>(null)
const editableRef = ref<HTMLDivElement | null>(null)
const modalEditableRef = ref<HTMLDivElement | null>(null)
const showMention = ref(false)
const mentionFilter = ref('')
const mentionAnchor = ref<'inline' | 'modal'>('inline')
const contentPlain = ref('')

const connectedImages = ref<Map<string, UploadImage>>(new Map())

// 连线输入：资产图片
watch(() => props.nodeInputs, (inputs) => {
  if (!inputs) return
  const currentEdgeIds = new Set<string>()
  for (const inp of inputs) {
    if ((inp.sourceNodeType === 'asset' || inp.sourceNodeType === 'image') && inp.data?.dataUrl) {
      currentEdgeIds.add(inp.edgeId)
      if (!connectedImages.value.has(inp.edgeId)) {
        imageCounter++
        compressImage(inp.data.dataUrl).then(compressed => {
          const img = { id: imageCounter, name: `图片${imageCounter}`, dataUrl: compressed }
          connectedImages.value.set(inp.edgeId, img)
          images.value.push(img)
        })
      }
    }
  }
  for (const [edgeId, img] of connectedImages.value) {
    if (!currentEdgeIds.has(edgeId)) {
      connectedImages.value.delete(edgeId)
      images.value = images.value.filter(i => i.id !== img.id)
    }
  }
}, { immediate: true, deep: true })

// 加载节点数据
watch(() => props.node, (n) => {
  if (n) {
    modalOpen.value = false
    const typeModels = getModels(n.node_type)
    models.value = typeModels.length > 0 ? typeModels : ['GPT-4', 'Claude 3', 'Gemini']
    if (!models.value.includes(selectedModel.value)) {
      selectedModel.value = models.value[0] || 'GPT-4'
    }
    const roles = getRoles(n.node_type)
    outputTypes.value = roles.length > 0 ? roles : [{ key: 'text', label: '通用', prompt: '' }]
    if (!outputTypes.value.find(r => r.key === selectedType.value)) {
      selectedType.value = outputTypes.value[0]?.key || 'text'
    }
    const connIds = new Set([...connectedImages.value.values()].map(i => i.id))
    images.value = images.value.filter(i => {
      const isConnected = [...connectedImages.value.values()].some(ci => ci.id === i.id)
      return isConnected ? connIds.has(i.id) : true
    })
    // 加载时只显示提示词部分（---之前）
    const raw = n.content || ''
    const sepIdx = raw.indexOf('\n\n---\n\n')
    const prompt = sepIdx < 0 ? raw : raw.slice(0, sepIdx)
    content.value = prompt
    nextTick(() => {
      if (editableRef.value) editableRef.value.innerHTML = prompt
      if (modalEditableRef.value) modalEditableRef.value.innerHTML = prompt
      syncContent('inline')
    })
  }
}, { immediate: true })

function syncContent(anchor: 'inline' | 'modal') {
  const el = anchor === 'inline' ? editableRef.value : modalEditableRef.value
  if (el) {
    content.value = el.innerHTML
    const div = document.createElement('div')
    div.innerHTML = el.innerHTML
    contentPlain.value = (div.textContent || '').trim()
  }
}

function onEditableInput(anchor: 'inline' | 'modal') {
  syncContent(anchor)
  handleMention(anchor)
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const max = 512
        let w = img.width, h = img.height
        if (w > h && w > max) { h = Math.round(h * max / w); w = max }
        else if (h > max) { w = Math.round(w * max / h); h = max }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function handleMention(anchor: 'inline' | 'modal') {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) { showMention.value = false; return }
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) { showMention.value = false; return }
  const text = node.textContent || ''
  const cursorPos = range.startOffset
  const beforeCursor = text.slice(0, cursorPos)
  const atMatch = beforeCursor.match(/@([^\s@]*)$/)
  if (atMatch) {
    mentionFilter.value = atMatch[1]
    showMention.value = true
    mentionAnchor.value = anchor
  } else {
    showMention.value = false
  }
}

function insertMention(img: { id: any; name: string; src: string }) {
  const el = mentionAnchor.value === 'inline' ? editableRef.value : modalEditableRef.value
  if (!el) return
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return
  const text = node.textContent || ''
  const cursorPos = range.startOffset
  const beforeCursor = text.slice(0, cursorPos)
  const atMatch = beforeCursor.match(/@([^\s@]*)$/)
  if (!atMatch) return
  const atIdx = beforeCursor.length - atMatch[0].length
  range.setStart(node, atIdx)
  range.setEnd(node, cursorPos)
  range.deleteContents()
  const chip = document.createElement('span')
  chip.className = 'inline-flex items-center gap-0.5 align-middle'
  chip.contentEditable = 'false'
  chip.innerHTML = `<img src="${img.src}" class="inline w-4 h-4 rounded object-cover" /><span class="text-blue-400">@${img.name}</span>`
  chip.setAttribute('data-mention', img.name)
  const space = document.createTextNode(' ')
  range.insertNode(space)
  range.insertNode(chip)
  sel.removeAllRanges()
  range.setStartAfter(space)
  range.collapse(true)
  sel.addRange(range)
  showMention.value = false
  syncContent(mentionAnchor.value)
  const exists = images.value.some(i => i.id === img.id || i.dataUrl === img.src)
  if (!exists) {
    if (img.src.startsWith('data:')) {
      compressImage(img.src).then(compressed => {
        images.value.push({ id: images.value.length + 1, name: img.name, dataUrl: compressed })
      })
    } else {
      imageCounter++
      const placeholder = { id: imageCounter, name: img.name, dataUrl: img.src }
      images.value.push(placeholder)
      const fullUrl = img.src.startsWith('http') ? img.src : `${window.location.origin}${img.src}`
      fetch(fullUrl).then(r => r.blob()).then(blob => new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })).then(compressImage).then(dataUrl => {
        placeholder.dataUrl = dataUrl
      }).catch(() => {})
    }
  }
}

function onAddImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = () => {
    const files = input.files
    if (!files) return
    for (const file of files) {
      imageCounter++
      const name = `图片${imageCounter}`
      const reader = new FileReader()
      reader.onload = () => {
        compressImage(reader.result as string).then(compressed => {
          images.value.push({ id: imageCounter, name, dataUrl: compressed })
        })
      }
      reader.readAsDataURL(file)
      addAsset(file)
    }
  }
  input.click()
}

function removeImage(img: UploadImage) {
  images.value = images.value.filter(i => i.id !== img.id)
  for (const [edgeId, connImg] of connectedImages.value) {
    if (connImg.id === img.id) {
      connectedImages.value.delete(edgeId)
      emit('remove-connected-edge', edgeId)
      break
    }
  }
}

async function onSend() {
  if (!props.node || loading.value) return

  const promptText = contentPlain.value
  if (!promptText) return

  loading.value = true
  let fullText = ''

  const messages: { role: string; content: any }[] = []
  const typeInfo = outputTypes.value.find(t => t.key === selectedType.value)
  if (typeInfo?.prompt) {
    messages.push({ role: 'system', content: typeInfo.prompt })
  }

  const nodeType = props.node.node_type || 'agent'
  const modelConfig = getModelConfig(nodeType, selectedModel.value)
  const supportsVision = modelConfig?.parameters?.supports_vision === true

  // 收集上游文本输入
  const inputs = props.nodeInputs ?? []
  const contextParts: string[] = [promptText]
  for (const inp of inputs) {
    if (inp.sourceNodeType === 'text' && inp.data && typeof inp.data === 'string') {
      contextParts.unshift(`[上游节点输出]\n${inp.data}`)
    }
  }
  const userText = contextParts.join('\n\n')

  if (supportsVision && images.value.length > 0) {
    const userContent: any[] = [{ type: 'text', text: userText }]
    for (const img of images.value) {
      userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } })
    }
    messages.push({ role: 'user', content: userContent })
  } else {
    messages.push({ role: 'user', content: userText })
  }

  try {
    if (supportsVision && images.value.length > 0) {
      // 多模态用非流式，避免 SSE 开销触发网关超时
      const res = await chatWithLLM(selectedModel.value, messages, modelConfig) as any
      fullText = res.choices?.[0]?.message?.content || ''
    } else {
      for await (const chunk of chatWithLLMStream(selectedModel.value, messages, modelConfig)) {
        fullText += chunk
      }
    }
    const result = promptText + '\n\n---\n\n' + fullText
    emit('save', result)
  } catch (e: any) {
    // 错误不混入节点内容，仅显示在编辑器
    const errDiv = document.createElement('div')
    errDiv.textContent = '**错误:** ' + (e.message || '未知错误')
    contentPlain.value = promptText + '\n\n' + errDiv.textContent
    if (editableRef.value) editableRef.value.textContent = contentPlain.value
  } finally {
    loading.value = false
  }
}

watch(modalOpen, async (v) => {
  if (v) {
    await nextTick()
    if (modalEditableRef.value) {
      modalEditableRef.value.innerHTML = content.value
    }
  } else {
    if (editableRef.value && modalEditableRef.value) {
      editableRef.value.innerHTML = modalEditableRef.value.innerHTML
      syncContent('inline')
    }
  }
})
</script>

<template>
  <div v-if="node" :style="panelStyle" class="pointer-events-auto" @pointerdown.stop>
    <div class="bg-neutral-900/95 backdrop-blur rounded-2xl border border-white/20 p-3 relative">
      <button class="btn btn-xs btn-square absolute top-2 right-2 bg-white/10 border border-white/30 text-white hover:bg-white/20" title="放大编辑" @click="modalOpen = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>

      <!-- 图片输入行 -->
      <div class="flex items-center gap-1.5 mb-2">
        <div class="shrink-0 w-10 h-10 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2"/></svg>
          <span class="text-[8px] leading-none">识图</span>
        </div>
        <div
          v-for="img in images" :key="img.id"
          class="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-white/50 transition-colors"
          @click.stop="previewImg = img"
        >
          <img :src="img.dataUrl" class="w-full h-full object-cover" />
          <span class="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/60 text-white/80 truncate px-0.5 leading-tight">{{ img.name }}</span>
          <button class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-800 border border-white/20 text-white/60 hover:text-white flex items-center justify-center text-[10px] leading-none" @click.stop="removeImage(img)">×</button>
        </div>
        <button class="shrink-0 w-10 h-10 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 hover:text-white/60 hover:border-white/25 transition-colors gap-0.5" @click="onAddImage">
          <span class="text-sm leading-none">+</span>
          <span class="text-[8px] leading-none">添加</span>
        </button>
      </div>

      <div v-if="showMention" class="relative">
        <MentionDropdown :connected-images="images" :filter="mentionFilter" @insert="insertMention" />
      </div>

      <div ref="editableRef" contenteditable="true" class="w-full bg-transparent outline-0 text-white text-sm px-1 min-h-[60px] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入指令...'] empty:before:text-white/30" @input="onEditableInput('inline')" @keydown.enter="onEditableInput('inline')" />

      <!-- LLM 控制栏 -->
      <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
        <div class="flex items-center gap-2 min-w-0">
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-white/30 shrink-0">类型:</span>
            <div class="relative flex items-center">
              <select v-model="selectedType" class="appearance-none bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 pl-2 pr-6 py-1.5 outline-none cursor-pointer hover:bg-white/10 hover:border-white/20 transition-colors">
                <option v-for="t in outputTypes" :key="t.key" :value="t.key" class="bg-neutral-800 text-white">{{ t.label }}</option>
              </select>
              <svg class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-white/30 shrink-0">模型:</span>
            <div class="relative flex items-center">
              <select v-model="selectedModel" class="appearance-none bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 pl-2 pr-7 py-1.5 outline-none cursor-pointer hover:bg-white/10 hover:border-white/20 transition-colors w-auto max-w-[120px] truncate">
                <option v-for="m in models" :key="m" :value="m" class="bg-neutral-800 text-white">{{ m }}</option>
              </select>
              <svg class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-white/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-white/30 shrink-0">模式:</span>
            <div class="flex rounded-lg border border-white/10 overflow-hidden">
              <button class="text-[10px] px-1.5 py-1 transition-colors" :class="sendMode === 'replace' ? 'bg-white/15 text-white' : 'bg-transparent text-white/40 hover:text-white/60'" @click="sendMode = 'replace'">替换</button>
              <button class="text-[10px] px-1.5 py-1 transition-colors border-l border-white/10" :class="sendMode === 'append' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-transparent text-white/40 hover:text-white/60'" @click="sendMode = 'append'">追加</button>
            </div>
          </div>
        </div>
        <button class="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-900 hover:bg-neutral-200 transition-colors disabled:opacity-50" :disabled="loading" @click="onSend">
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          <span v-else class="loading loading-spinner loading-xs" />
        </button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="previewImg" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" @click="previewImg = null">
      <img :src="previewImg.dataUrl" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" @click.stop />
      <button class="absolute top-4 right-4 btn btn-sm btn-circle bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="previewImg = null">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div v-if="modalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" @click.self="modalOpen = false">
      <div class="bg-neutral-900 border border-white/20 rounded-2xl w-[640px] max-h-[85vh] flex flex-col shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span class="text-sm font-medium text-white/70">智能体编辑</span>
          <button class="btn btn-xs btn-square bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="modalOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div ref="modalEditableRef" contenteditable="true" class="flex-1 p-5 text-white text-sm outline-none overflow-y-auto min-h-[260px] whitespace-pre-wrap break-words" @input="onEditableInput('modal')" />
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-t border-white/10">
          <div class="flex items-center gap-2 min-w-0">
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-white/30 shrink-0">类型:</span>
              <div class="relative flex items-center">
                <select v-model="selectedType" class="appearance-none bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 pl-2 pr-6 py-1.5 outline-none cursor-pointer hover:bg-white/10 hover:border-white/20 transition-colors">
                  <option v-for="t in outputTypes" :key="t.key" :value="t.key" class="bg-neutral-800 text-white">{{ t.label }}</option>
                </select>
                <svg class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-white/30 shrink-0">模型:</span>
              <div class="relative flex items-center">
                <select v-model="selectedModel" class="appearance-none bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 pl-2 pr-7 py-1.5 outline-none cursor-pointer hover:bg-white/10 hover:border-white/20 transition-colors w-auto max-w-[120px] truncate">
                  <option v-for="m in models" :key="m" :value="m" class="bg-neutral-800 text-white">{{ m }}</option>
                </select>
                <svg class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-white/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-white/30 shrink-0">模式:</span>
              <div class="flex rounded-lg border border-white/10 overflow-hidden">
                <button class="text-[10px] px-1.5 py-1 transition-colors" :class="sendMode === 'replace' ? 'bg-white/15 text-white' : 'bg-transparent text-white/40 hover:text-white/60'" @click="sendMode = 'replace'">替换</button>
                <button class="text-[10px] px-1.5 py-1 transition-colors border-l border-white/10" :class="sendMode === 'append' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-transparent text-white/40 hover:text-white/60'" @click="sendMode = 'append'">追加</button>
              </div>
            </div>
          </div>
          <button class="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-900 hover:bg-neutral-200 transition-colors disabled:opacity-50" :disabled="loading" @click="onSend">
            <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            <span v-else class="loading loading-spinner loading-xs" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

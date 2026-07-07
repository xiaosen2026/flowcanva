<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Node } from '../../types'
import MentionDropdown from '../MentionDropdown.vue'
import { useNodeConfigs } from '../../composables/useNodeConfigs'

const props = defineProps<{
  node: Node | null
  panelStyle: Record<string, string>
  nodeInputs?: { edgeId: string; sourceNodeId: string; sourceNodeType: string; data: any }[]
}>()

const emit = defineEmits<{
  (e: 'save', content: string): void
  (e: 'remove-connected-edge', edgeId: string): void
}>()

const { getModels, getModelConfig } = useNodeConfigs()

const prompt = ref('')
const promptHtml = ref('')
const loading = ref(false)
const modalOpen = ref(false)
const images = ref<{ id: number; url: string; name?: string }[]>([])
const generatedImages = ref<{ id: number; url: string }[]>([])
const connectedImages = ref<Map<string, { id: number; url: string }>>(new Map())
let imageCounter = 0
const previewImg = ref<{ id: number; url: string } | null>(null)

const selectedModel = ref('dall-e-3')
const models = ref<string[]>(['dall-e-3'])
const selectedRatio = ref('1:1')
const selectedResolution = ref('1K')
const selectedCount = ref(1)
const selectedPreset = ref('')

const ratioOptions = ['自适应', '1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16', '5:4', '4:5', '21:9']
const resolutionOptions = ['1K', '2K', '4K']
const countOptions = [1, 2, 4]

const presets = ref<{ id: string; name: string; prompt: string; category: string; scope: string }[]>([])
const presetCategories = ref<string[]>([])

const editableRef = ref<HTMLDivElement | null>(null)
const modalContentEditable = ref<HTMLDivElement | null>(null)
const showMention = ref(false)
const mentionFilter = ref('')
const mentionAnchor = ref<'inline' | 'modal'>('inline')

const allDisplayImages = ref<{ id: number; url: string; label: string; isRef: boolean }[]>([])

function rebuildDisplay() {
  const list: { id: number; url: string; label: string; isRef: boolean }[] = []
  for (const [, img] of connectedImages.value) {
    list.push({ id: img.id, url: img.url, label: '参考', isRef: true })
  }
  for (const img of images.value) {
    list.push({ id: img.id, url: img.url, label: img.name || '上传', isRef: false })
  }
  allDisplayImages.value = list
}

watch(() => props.nodeInputs, (inputs) => {
  if (!inputs) return
  const currentEdgeIds = new Set<string>()
  for (const inp of inputs) {
    if ((inp.sourceNodeType === 'asset' || inp.sourceNodeType === 'image') && inp.data?.dataUrl) {
      currentEdgeIds.add(inp.edgeId)
      if (!connectedImages.value.has(inp.edgeId)) {
        imageCounter++
        connectedImages.value.set(inp.edgeId, { id: imageCounter, url: inp.data.dataUrl })
      }
    }
  }
  for (const [edgeId] of connectedImages.value) {
    if (!currentEdgeIds.has(edgeId)) {
      connectedImages.value.delete(edgeId)
    }
  }
  rebuildDisplay()
}, { immediate: true, deep: true })

watch(() => props.node, (n) => {
  if (n) {
    const typeModels = getModels(n.node_type)
    models.value = typeModels.length > 0 ? typeModels : ['dall-e-3']
    if (!models.value.includes(selectedModel.value)) {
      selectedModel.value = models.value[0] || 'dall-e-3'
    }
    try {
      const data = n.content ? JSON.parse(n.content) : null
      if (data) {
        prompt.value = data.prompt || ''
        promptHtml.value = data.promptHtml || ''
        images.value = data.images || []
        generatedImages.value = data.generated_images || []
      } else {
        prompt.value = n.content || ''
        promptHtml.value = ''
        images.value = []
        generatedImages.value = []
      }
    } catch {
      prompt.value = n.content || ''
      promptHtml.value = ''
      images.value = []
      generatedImages.value = []
    }
    rebuildDisplay()
    nextTick(() => {
      if (editableRef.value) {
        if (promptHtml.value) {
          editableRef.value.innerHTML = promptHtml.value
          syncPrompt()
        } else {
          editableRef.value.textContent = prompt.value
        }
      }
    })
    loadPresets()
  }
}, { immediate: true })

let promptSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(prompt, () => {
  if (promptSaveTimer) clearTimeout(promptSaveTimer)
  promptSaveTimer = setTimeout(() => {
    const existing: any = {}
    try { if (props.node?.content) Object.assign(existing, JSON.parse(props.node.content)) } catch {}
    emit('save', buildContent({ images: existing.images || images.value, generated_images: existing.generated_images || generatedImages.value }))
  }, 800)
})

async function loadPresets() {
  if (!props.node?.canvas_id) return
  try {
    const [globalRes, canvasRes] = await Promise.all([
      fetch('/api/admin/presets?scope=global'),
      fetch(`/api/admin/presets?scope=canvas&canvas_id=${props.node.canvas_id}`),
    ])
    const g = await globalRes.json(); const c = await canvasRes.json()
    const all = [...(Array.isArray(c) ? c : []), ...(Array.isArray(g) ? g : [])].filter((p: any) => (p.preset_type || 'image') === 'image')
    presets.value = all
    presetCategories.value = [...new Set(all.map((p: any) => p.category))]
  } catch {}
}

function syncPrompt(anchor?: 'inline' | 'modal') {
  const el = anchor === 'modal' ? modalContentEditable.value : editableRef.value
  if (el) {
    const div = document.createElement('div')
    div.innerHTML = el.innerHTML
    prompt.value = (div.textContent || '').trim()
    promptHtml.value = el.innerHTML
  }
}

function buildContent(extras: Record<string, any> = {}) {
  return JSON.stringify({ prompt: prompt.value, promptHtml: promptHtml.value, ...extras })
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const max = 1024; let w = img.width, h = img.height
      if (w > h && w > max) { h = Math.round(h * max / w); w = max }
      else if (h > max) { w = Math.round(w * max / h); h = max }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function onAddImage() {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true
  input.onchange = () => {
    if (!input.files) return
    for (const file of input.files) {
      imageCounter++
      const name = `图片${imageCounter}`
      const reader = new FileReader()
      reader.onload = () => {
        compressImage(reader.result as string).then(compressed => {
          images.value.push({ id: imageCounter, name, url: compressed })
          rebuildDisplay()
          emit('save', JSON.stringify({ prompt: prompt.value, images: images.value, generated_images: generatedImages.value }))
        })
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

function applyPreset() {
  if (!selectedPreset.value) return
  const p = presets.value.find(pr => pr.id === selectedPreset.value)
  if (p) {
    prompt.value = p.prompt + ', ' + prompt.value
    if (editableRef.value) editableRef.value.textContent = prompt.value
    selectedPreset.value = ''
    syncPrompt()
  }
}

function onInput() {
  syncPrompt()
  handleMention('inline')
}

function onModalInput() {
  syncPrompt('modal')
  handleMention('modal')
}

function handleMention(anchor: 'inline' | 'modal') {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) { showMention.value = false; return }
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) { showMention.value = false; return }
  const text = node.textContent || ''
  const cursorPos = range.startOffset
  const before = text.slice(0, cursorPos)
  const m = before.match(/@([^\s@]*)$/)
  if (m) { mentionFilter.value = m[1]; showMention.value = true; mentionAnchor.value = anchor }
  else { showMention.value = false }
}

function insertMention(img: { id: any; name: string; src: string }) {
  const el = mentionAnchor.value === 'modal' ? modalContentEditable.value : editableRef.value; if (!el) return
  const sel = window.getSelection(); if (!sel?.rangeCount) return
  const range = sel.getRangeAt(0); const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return
  const text = node.textContent || ''; const pos = range.startOffset
  const m = text.slice(0, pos).match(/@([^\s@]*)$/); if (!m) return
  range.setStart(node, pos - m[0].length); range.setEnd(node, pos); range.deleteContents()
  const chip = document.createElement('span')
  chip.className = 'inline-flex items-center gap-0.5 align-middle'; chip.contentEditable = 'false'
  chip.innerHTML = `<img src="${img.src}" class="inline w-4 h-4 rounded object-cover" /><span class="text-blue-400">@${img.name}</span>`
  chip.setAttribute('data-mention', img.name)
  const space = document.createTextNode(' ')
  range.insertNode(space); range.insertNode(chip)
  sel.removeAllRanges(); range.setStartAfter(space); range.collapse(true); sel.addRange(range)
  showMention.value = false; syncPrompt(mentionAnchor.value)
}

async function generate() {
  if (!prompt.value || loading.value) return
  loading.value = true
  const modelConfig = getModelConfig(props.node?.node_type || 'image', selectedModel.value)
  try {
    const sizeBase = { '1K': 1024, '2K': 2048, '4K': 4096 }[selectedResolution.value] || 1024
    const ratioMap: Record<string, [number, number]> = { '1:1': [1,1], '4:3': [4,3], '3:4': [3,4], '3:2': [3,2], '2:3': [2,3], '16:9': [16,9], '9:16': [9,16], '5:4': [5,4], '4:5': [4,5], '21:9': [21,9] }
    const [rw, rh] = ratioMap[selectedRatio.value] || [1, 1]
    let w = Math.round(sizeBase * rw / rh)
    let h = sizeBase
    if (rw < rh) { w = sizeBase; h = Math.round(sizeBase * rh / rw) }
    // 确保最少像素（doubao 需要 ~3.7M）
    while (w * h < 3686400) { w = Math.round(w * 1.3); h = Math.round(h * 1.3) }
    const size = `${w}x${h}`
    const body: Record<string, any> = { model: selectedModel.value, prompt: prompt.value, n: selectedCount.value, size, aspect_ratio: selectedRatio.value, image_size: selectedResolution.value }
    if (modelConfig) {
      if (modelConfig.channel) body.channel = modelConfig.channel
      if (modelConfig.base_url) body.base_url = modelConfig.base_url
      if (modelConfig.api_key) body.api_key = modelConfig.api_key
      if (modelConfig.path) body.path = modelConfig.path
      if (modelConfig.protocol) body.protocol = modelConfig.protocol
    }
    // 传入连线参考图
    const refImages: string[] = []
    for (const [, img] of connectedImages.value) refImages.push(img.url)
    for (const img of images.value) refImages.push(img.url)
    if (refImages.length > 0) {
      body.image = refImages[0]
      body.path = '/images/edits'
    }

    // 先清空旧图，保存到节点让画布显示空白/加载状态
    generatedImages.value = []
    emit('save', buildContent({ images: images.value, generated_images: [] }))

    const res = await fetch('/api/images/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(typeof err.error === 'string' ? err.error : (err.error?.message || res.statusText))
    }
    const data = await res.json()
    if (data.data && Array.isArray(data.data)) {
      for (let i = 0; i < data.data.length; i++) generatedImages.value.push({ id: Date.now() + i, url: data.data[i].url || data.data[i].b64_json || '' })
    }
    emit('save', buildContent({ images: images.value, generated_images: generatedImages.value }))
  } catch (e: any) {
    prompt.value = prompt.value + '\n\n**错误:** ' + (e.message || '未知错误')
    promptHtml.value = prompt.value
    if (editableRef.value) editableRef.value.textContent = prompt.value
  } finally { loading.value = false }
}

function removeGenerated(img: { id: number; url: string }) {
  images.value = images.value.filter(i => i.id !== img.id)
  rebuildDisplay()
  emit('save', JSON.stringify({ prompt: prompt.value, images: images.value, generated_images: generatedImages.value }))
}

watch(modalOpen, async (v) => {
  if (v) {
    await nextTick()
    if (modalContentEditable.value) {
      modalContentEditable.value.innerHTML = promptHtml.value || prompt.value
    }
  } else {
    if (editableRef.value && modalContentEditable.value) {
      editableRef.value.innerHTML = modalContentEditable.value.innerHTML
      syncPrompt()
    }
  }
})
</script>

<template>
  <div v-if="node" :style="panelStyle" class="pointer-events-auto" @pointerdown.stop>
    <div class="bg-neutral-900/95 backdrop-blur rounded-2xl border border-white/20 p-3 relative">
      <button class="btn btn-xs btn-square absolute top-2 right-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 z-10" title="放大编辑" @click="modalOpen = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
      </button>

      <div class="flex items-center gap-1.5 mb-2">
        <div class="shrink-0 w-10 h-10 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2"/></svg>
          <span class="text-[8px] leading-none">识图</span>
        </div>
        <div v-for="img in allDisplayImages" :key="img.id" class="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-white/50 transition-colors" @click.stop="previewImg = img">
          <img :src="img.url" class="w-full h-full object-cover" />
          <span class="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/60 text-white/80 truncate px-0.5 leading-tight">{{ img.label }}</span>
          <button v-if="!img.isRef" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-800 border border-white/20 text-white/60 hover:text-white flex items-center justify-center text-[10px] leading-none" @click.stop="removeGenerated({ id: img.id, url: img.url })">×</button>
        </div>
        <button class="shrink-0 w-10 h-10 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 hover:text-white/60 hover:border-white/25 transition-colors gap-0.5" @click="onAddImage">
          <span class="text-sm leading-none">+</span>
          <span class="text-[8px] leading-none">添加</span>
        </button>
      </div>

      <div v-if="showMention" class="relative">
        <MentionDropdown :connected-images="allDisplayImages.map(i => ({ id: i.id, name: i.label, dataUrl: i.url }))" :filter="mentionFilter" @insert="insertMention" />
      </div>

      <div ref="editableRef" contenteditable="true" class="w-full bg-transparent outline-0 text-white text-sm px-1 min-h-[60px] max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入图片提示词...'] empty:before:text-white/30" @input="onInput" />

      <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-white/30 ml-1">模型</span>
          <div class="relative inline-flex items-center">
            <select v-model="selectedModel" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-6 w-[96px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="m in models" :key="m" :value="m" class="bg-neutral-900 text-white">{{ m }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <span class="text-[10px] text-white/30">比例</span>
          <div class="relative inline-flex items-center">
            <select v-model="selectedRatio" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-5 w-[42px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="r in ratioOptions" :key="r" :value="r" class="bg-neutral-900 text-white">{{ r }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <span class="text-[10px] text-white/30">像素</span>
          <div class="relative inline-flex items-center">
            <select v-model="selectedResolution" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-5 w-[36px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="r in resolutionOptions" :key="r" :value="r" class="bg-neutral-900 text-white">{{ r }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <span class="text-[10px] text-white/30">数量</span>
          <div class="relative inline-flex items-center">
            <select v-model="selectedCount" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-5 w-[36px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="c in countOptions" :key="c" :value="c" class="bg-neutral-900 text-white">{{ c }}x</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <span class="text-[10px] text-white/30">预设</span>
          <div class="relative inline-flex items-center">
            <select v-model="selectedPreset" @change="applyPreset" class="text-xs bg-transparent border-0 text-white/50 hover:text-white h-6 py-0 pl-0 pr-6 w-[56px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option value="" class="bg-neutral-900 text-white/40">预设</option>
              <optgroup v-for="cat in presetCategories" :key="cat" :label="cat">
                <option v-for="pr in presets.filter(p => p.category === cat)" :key="pr.id" :value="pr.id" class="bg-neutral-900 text-white">{{ pr.name }}</option>
              </optgroup>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <button class="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-900 hover:bg-neutral-200 transition-colors disabled:opacity-50" :disabled="loading" @click="generate">
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          <span v-else class="loading loading-spinner loading-xs" />
        </button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="modalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" @click.self="modalOpen = false">
      <div class="bg-neutral-900 border border-white/20 rounded-2xl w-[600px] max-h-[85vh] flex flex-col shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span class="text-sm font-medium text-white/70">图片生成</span>
          <button class="btn btn-xs btn-square bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="modalOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-5 space-y-3">
          <div ref="modalContentEditable" contenteditable="true" class="w-full bg-transparent outline-0 text-white text-sm min-h-[120px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入图片提示词...'] empty:before:text-white/30" @input="onModalInput" />
          <div v-if="allDisplayImages.length > 0" class="flex flex-wrap gap-2">
            <div v-for="img in allDisplayImages" :key="img.id" class="relative w-16 h-16 rounded-lg overflow-hidden border border-white/15 cursor-pointer" @click="previewImg = img">
              <img :src="img.url" class="w-full h-full object-cover" />
              <span class="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/60 text-white/80 truncate px-0.5">{{ img.label }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-t border-white/10">
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-white/30">模型</span>
            <select v-model="selectedModel" class="appearance-none bg-white/5 border border-white/10 rounded text-xs text-white/80 pl-1.5 pr-4 py-1.5"><option v-for="m in models" :key="m" :value="m" class="bg-neutral-800">{{ m }}</option></select>
            <span class="text-[10px] text-white/30">比例</span>
            <select v-model="selectedRatio" class="appearance-none bg-white/5 border border-white/10 rounded text-xs text-white/80 pl-1.5 pr-3 py-1.5"><option v-for="r in ratioOptions" :key="r" :value="r" class="bg-neutral-800">{{ r }}</option></select>
            <span class="text-[10px] text-white/30">像素</span>
            <select v-model="selectedResolution" class="appearance-none bg-white/5 border border-white/10 rounded text-xs text-white/80 pl-1.5 pr-3 py-1.5"><option v-for="r in resolutionOptions" :key="r" :value="r" class="bg-neutral-800">{{ r }}</option></select>
            <span class="text-[10px] text-white/30">数量</span>
            <select v-model="selectedCount" class="appearance-none bg-white/5 border border-white/10 rounded text-xs text-white/80 pl-1.5 pr-3 py-1.5"><option v-for="c in countOptions" :key="c" :value="c" class="bg-neutral-800">{{ c }}x</option></select>
            <span class="text-[10px] text-white/30">预设</span>
            <select v-model="selectedPreset" @change="applyPreset" class="appearance-none bg-white/5 border border-white/10 rounded text-xs text-white/50 pl-1.5 pr-4 py-1.5"><option value="" class="bg-neutral-800 text-white/40">预设</option><optgroup v-for="cat in presetCategories" :key="cat" :label="cat"><option v-for="pr in presets.filter(p => p.category === cat)" :key="pr.id" :value="pr.id" class="bg-neutral-800 text-white">{{ pr.name }}</option></optgroup></select>
          </div>
          <button class="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-900 hover:bg-neutral-200 disabled:opacity-50" :disabled="loading" @click="generate">
            <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            <span v-else class="loading loading-spinner loading-xs" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="previewImg" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" @click="previewImg = null">
      <img :src="previewImg.url" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" @click.stop />
      <button class="absolute top-4 right-4 btn btn-sm btn-circle bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="previewImg = null">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </Teleport>
</template>

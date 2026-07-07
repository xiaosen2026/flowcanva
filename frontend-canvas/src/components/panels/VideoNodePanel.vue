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
const videos = ref<{ id: number; url: string }[]>([])
const selectedModel = ref('doubao-seedance-2-0-260128')
const models = ref<string[]>(['doubao-seedance-2-0-260128'])
const selectedRatio = ref('9:16')
const selectedResolution = ref('720p')
const selectedDuration = ref('10')
const selectedCount = ref(1)
const selectedMode = ref('文生视频')

const allModes = ['全能参考', '文生视频', '首帧', '首尾帧']
const modeRules: Record<string, (n: number) => boolean> = {
  '文生视频': (n) => n === 0,
  '首帧': (n) => n === 1,
  '首尾帧': (n) => n === 2,
  '全能参考': (n) => n >= 1,
}

function updateModeByImages() {
  const n = images.value.length
  if (!modeRules[selectedMode.value]?.(n)) {
    if (n === 0) selectedMode.value = '文生视频'
    else selectedMode.value = '全能参考'
  }
}

const ratioOptions = ['9:16', '16:9', '1:1']
const resolutionOptions = ['480p', '720p', '1080p']
const durationOptions = ['4', '5', '6', '8', '10', '12', '15']
const countOptions = [1, 2]

interface UploadImage { id: number; name: string; dataUrl: string; mediaType: 'image' | 'video' | 'audio' }
const images = ref<UploadImage[]>([])
let imageCounter = 0
const connectedImages = ref<Map<string, UploadImage>>(new Map())

watch(() => images.value.length, () => {
  updateModeByImages()
})
const previewImg = ref<UploadImage | null>(null)
const modalOpen = ref(false)

const editableRef = ref<HTMLDivElement | null>(null)
const modalEditableRef = ref<HTMLDivElement | null>(null)
const showMention = ref(false)
const mentionFilter = ref('')
const mentionAnchor = ref<'inline' | 'modal'>('inline')

function syncPrompt(anchor?: 'inline' | 'modal') {
  const el = anchor === 'modal' ? modalEditableRef.value : editableRef.value
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
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const max = 512; let w = img.width, h = img.height
        if (w > h && w > max) { h = Math.round(h * max / w); w = max }
        else if (h > max) { w = Math.round(w * max / h); h = max }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', 0.7))
      } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

watch(() => props.nodeInputs, (inputs) => {
  if (!inputs) return
  const currentEdgeIds = new Set<string>()
  for (const inp of inputs) {
    if ((inp.sourceNodeType === 'asset' || inp.sourceNodeType === 'image') && inp.data?.dataUrl) {
      currentEdgeIds.add(inp.edgeId)
      if (!connectedImages.value.has(inp.edgeId)) {
        imageCounter++
        const localId = imageCounter
        compressImage(inp.data.dataUrl).then(compressed => {
          const img = { id: localId, name: `图片${localId}`, dataUrl: compressed, mediaType: 'image' as const }
          connectedImages.value.set(inp.edgeId, img)
          images.value.push(img)
          images.value.sort((a, b) => a.id - b.id)
          images.value.forEach((img, i) => { img.name = `图片${i + 1}` })
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
  updateModeByImages()
}, { immediate: true, deep: true })

watch(() => props.node, (n) => {
  if (n) {
    const typeModels = getModels(n.node_type)
    models.value = typeModels.length > 0 ? typeModels : ['doubao-seedance-2-0-260128']
    if (!models.value.includes(selectedModel.value)) {
      selectedModel.value = models.value[0] || 'doubao-seedance-2-0-260128'
    }
    try {
      const data = n.content ? JSON.parse(n.content) : null
      if (data) { prompt.value = data.prompt || ''; promptHtml.value = data.promptHtml || ''; videos.value = data.videos || []; loading.value = data._loading || false }
      else { prompt.value = n.content || ''; promptHtml.value = ''; videos.value = [] }
      if (loading.value) { loading.value = false; emit('save', buildContent({ videos: videos.value, _loading: false })) }
    } catch { prompt.value = n.content || ''; videos.value = [] }
    const connIds = new Set([...connectedImages.value.values()].map(i => i.id))
    // 保留未连线的手动上传图片，仅删除已断开的连线图片
    images.value = images.value.filter(i => {
      const isConnected = [...connectedImages.value.values()].some(ci => ci.id === i.id)
      return isConnected ? connIds.has(i.id) : true
    })
    updateModeByImages()
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
  }
}, { immediate: true })

let promptSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(prompt, () => {
  if (promptSaveTimer) clearTimeout(promptSaveTimer)
  promptSaveTimer = setTimeout(() => {
    const existing: any = {}
    try { if (props.node?.content) Object.assign(existing, JSON.parse(props.node.content)) } catch {}
    emit('save', buildContent({ videos: existing.videos || videos.value, _loading: false }))
  }, 800)
})

function handleMention(anchor: 'inline' | 'modal') {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) { showMention.value = false; return }
  const range = sel.getRangeAt(0); const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) { showMention.value = false; return }
  const text = node.textContent || ''; const cursorPos = range.startOffset
  const before = text.slice(0, cursorPos)
  const m = before.match(/@([^\s@]*)$/)
  if (m) { mentionFilter.value = m[1]; showMention.value = true; mentionAnchor.value = anchor }
  else { showMention.value = false }
}

function insertMention(img: { id: any; name: string; src: string }) {
  const el = mentionAnchor.value === 'modal' ? modalEditableRef.value : editableRef.value; if (!el) return
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
  showMention.value = false; syncPrompt()
}

function onAddMedia() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*,audio/*'
  input.multiple = true
  input.onchange = () => {
    if (!input.files) return
    for (const file of input.files) {
      imageCounter++
      const name = file.name || `文件${imageCounter}`
      const reader = new FileReader()
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const mediaType: 'image' | 'video' | 'audio' = isImage ? 'image' : isVideo ? 'video' : 'audio'
      if (isImage) {
        reader.onload = () => {
          compressImage(reader.result as string).then(compressed => {
            images.value.push({ id: imageCounter, name, dataUrl: compressed, mediaType })
            images.value.sort((a, b) => a.id - b.id)
            images.value.forEach((img, i) => { img.name = `文件${i + 1}` })
          })
        }
        reader.readAsDataURL(file)
      } else {
        reader.onload = () => {
          images.value.push({ id: imageCounter, name, dataUrl: reader.result as string, mediaType })
          images.value.sort((a, b) => a.id - b.id)
          images.value.forEach((img, i) => { img.name = `文件${i + 1}` })
        }
        reader.readAsDataURL(file)
      }
    }
  }
  input.click()
}

function removeImage(img: UploadImage) {
  images.value = images.value.filter(i => i.id !== img.id)
  for (const [edgeId, connImg] of connectedImages.value) {
    if (connImg.id === img.id) { connectedImages.value.delete(edgeId); emit('remove-connected-edge', edgeId); break }
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

async function uploadToImageHost(dataUrl: string): Promise<string> {
  const res = await fetch('/api/upload-image-host', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_url: dataUrl }),
  })
  console.log('[video] proxy upload status:', res.status)
  if (!res.ok) throw new Error('upload failed')
  const data = await res.json()
  console.log('[video] proxy upload result:', JSON.stringify(data).substring(0, 100))
  return data.url
}

async function generate() {
  if (!prompt.value || loading.value) return
  loading.value = true
  const modelConfig = getModelConfig(props.node?.node_type || 'video', selectedModel.value)
  try {
    console.log('[video] generate start, mode:', selectedMode.value, 'prompt:', prompt.value)
    const body: Record<string, any> = { model: selectedModel.value, prompt: prompt.value, seconds: selectedDuration.value, ratio: selectedRatio.value, resolution: selectedResolution.value, n: selectedCount.value, mode: selectedMode.value }
    if (modelConfig) {
      if (modelConfig.channel) body.channel = modelConfig.channel
      if (modelConfig.base_url) body.base_url = modelConfig.base_url
      if (modelConfig.api_key) body.api_key = modelConfig.api_key
    }
    // 只用 images.value（已排序），过滤 image 类型用于上传图床，video/audio 直接传 URL
    const imgUrls = images.value.filter(i => i.mediaType === 'image').map(i => i.dataUrl).filter(Boolean)
    const vidRefs = images.value.filter(i => i.mediaType === 'video').map(i => i.dataUrl).filter(Boolean)
    const audRefs = images.value.filter(i => i.mediaType === 'audio').map(i => i.dataUrl).filter(Boolean)
    if (vidRefs.length > 0) body.video_urls = vidRefs
    if (audRefs.length > 0) body.audio_urls = audRefs
    console.log('[video] collected images:', imgUrls.length, 'videos:', vidRefs.length, 'audio:', audRefs.length)
    const uploadedUrls: string[] = []
    for (const url of imgUrls) {
      try {
        if (url.startsWith('data:')) {
          console.log('[video] uploading to image host, length:', url.length)
          const uploaded = await uploadToImageHost(url)
          console.log('[video] uploaded:', uploaded.substring(0, 60))
          uploadedUrls.push(uploaded)
        } else {
          console.log('[video] using existing url:', url.substring(0, 60))
          uploadedUrls.push(url)
        }
      } catch (e) { console.error('[video] upload failed, fallback:', e); uploadedUrls.push(url) }
    }
    console.log('[video] final uploadedUrls:', uploadedUrls.length, 'urls')
    if (selectedMode.value !== '文生视频' && uploadedUrls.length > 0) {
      if (selectedMode.value === '首帧') body.image_url = uploadedUrls[0]
      else if (selectedMode.value === '首尾帧') body.image_urls = uploadedUrls.slice(0, 2)
      else if (selectedMode.value === '全能参考') body.image_urls = uploadedUrls
    }

    const vidUrls: string[] = []
    const audUrls: string[] = []
    if (props.nodeInputs) for (const inp of props.nodeInputs) {
      if (inp.sourceNodeType === 'video' && inp.data && typeof inp.data === 'string') vidUrls.push(inp.data)
    }
    if (vidUrls.length > 0) body.video_urls = vidUrls
    if (audUrls.length > 0) body.audio_urls = audUrls

    emit('save', buildContent({ videos: videos.value, _loading: true }))

    const res = await fetch('/api/video/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(typeof err.error === 'string' ? err.error : (err.error?.message || res.statusText)) }
    const data = await res.json()
    if (data.videos && Array.isArray(data.videos)) {
      videos.value = []
      for (let i = 0; i < data.videos.length; i++) videos.value.push({ id: Date.now() + i, url: data.videos[i] })
    }
    emit('save', buildContent({ videos: videos.value, _loading: false }))
  } catch (e: any) {
    prompt.value = prompt.value + '\n\n**错误:** ' + (e.message || '未知错误')
    promptHtml.value = prompt.value
    if (editableRef.value) editableRef.value.textContent = prompt.value
    emit('save', buildContent({ videos: videos.value, _loading: false }))
  } finally {
    loading.value = false
  }
}

watch(modalOpen, async (v) => {
  if (v) {
    await nextTick()
    if (modalEditableRef.value) {
      modalEditableRef.value.innerHTML = promptHtml.value || prompt.value
    }
  } else {
    if (editableRef.value && modalEditableRef.value) {
      editableRef.value.innerHTML = modalEditableRef.value.innerHTML
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

      <!-- 模式 tabs -->
      <div class="flex gap-1 mb-2">
        <button v-for="m in allModes" :key="m"
          class="text-[10px] px-2 py-0.5 rounded transition-colors"
          :class="modeRules[m](images.length) ? (selectedMode === m ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60') : 'text-white/15 cursor-not-allowed'"
          :disabled="!modeRules[m](images.length)"
          @click="selectedMode = m"
        >{{ m }}</button>
      </div>

      <div class="flex items-center gap-1.5 mb-2">
        <div class="shrink-0 w-10 h-10 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 gap-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2"/></svg>
          <span class="text-[8px] leading-none">识图</span>
        </div>
        <div v-for="(img, i) in images" :key="img.id" class="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-white/50 transition-colors" @click.stop="previewImg = img">
          <img v-if="img.mediaType === 'image'" :src="img.dataUrl" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center text-white/20">
            <svg v-if="img.mediaType === 'video'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </div>
          <span class="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/60 text-white/80 truncate px-0.5 leading-tight">{{ `文件${i+1}` }}</span>
          <button class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-800 border border-white/20 text-white/60 hover:text-white flex items-center justify-center text-[10px] leading-none" @click.stop="removeImage(img)">×</button>
        </div>
        <button class="shrink-0 w-10 h-10 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 hover:text-white/60 hover:border-white/25 transition-colors gap-0.5" @click="onAddMedia">
          <span class="text-sm leading-none">+</span>
          <span class="text-[8px] leading-none">添加</span>
        </button>
      </div>

      <div v-if="showMention" class="relative">
        <MentionDropdown :connected-images="images" :filter="mentionFilter" @insert="insertMention" />
      </div>

      <div ref="editableRef" contenteditable="true" class="w-full bg-transparent outline-0 text-white text-sm px-1 min-h-[60px] max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入视频提示词...'] empty:before:text-white/30" @input="onInput" />

      <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
        <div class="flex items-center gap-1">
          <div class="relative inline-flex items-center">
            <select v-model="selectedModel" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-6 w-[120px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="m in models" :key="m" :value="m" class="bg-neutral-900 text-white">{{ m }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="relative inline-flex items-center">
            <select v-model="selectedRatio" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-5 w-[38px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="r in ratioOptions" :key="r" :value="r" class="bg-neutral-900 text-white">{{ r }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="relative inline-flex items-center">
            <select v-model="selectedResolution" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-5 w-[48px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="r in resolutionOptions" :key="r" :value="r" class="bg-neutral-900 text-white">{{ r }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="relative inline-flex items-center">
            <select v-model="selectedDuration" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-5 w-[38px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="d in durationOptions" :key="d" :value="d" class="bg-neutral-900 text-white">{{ d }}s</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="relative inline-flex items-center">
            <select v-model="selectedCount" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-4 w-[28px] outline-none appearance-none cursor-pointer [color-scheme:dark]">
              <option v-for="c in countOptions" :key="c" :value="c" class="bg-neutral-900 text-white">{{ c }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <button class="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-900 hover:bg-neutral-200 disabled:opacity-50" :disabled="loading" @click="generate">
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
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
  </Teleport>

  <Teleport to="body">
    <div v-if="modalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" @click.self="modalOpen = false">
      <div class="bg-neutral-900 border border-white/20 rounded-2xl w-[720px] max-h-[85vh] flex flex-col shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span class="text-sm font-medium text-white/70">视频生成</span>
          <button class="btn btn-xs btn-square bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="modalOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-5 space-y-3">
          <div class="flex gap-1">
            <button v-for="m in allModes" :key="m"
              class="text-xs px-2 py-0.5 rounded transition-colors"
              :class="modeRules[m](images.length) ? (selectedMode === m ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60') : 'text-white/15 cursor-not-allowed'"
              :disabled="!modeRules[m](images.length)"
              @click="selectedMode = m"
            >{{ m }}</button>
          </div>
          <div v-if="images.length > 0" class="flex flex-wrap gap-2">
            <div v-for="(img, i) in images" :key="img.id" class="relative w-16 h-16 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-white/50 transition-colors" @click.stop="previewImg = img">
              <img v-if="img.mediaType === 'image'" :src="img.dataUrl" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-white/20">
                <svg v-if="img.mediaType === 'video'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </div>
              <span class="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/60 text-white/80 truncate px-0.5">{{ `文件${i+1}` }}</span>
            </div>
          </div>
          <div ref="modalEditableRef" contenteditable="true" class="w-full bg-transparent outline-0 text-white text-sm min-h-[120px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入视频提示词...'] empty:before:text-white/30" @input="onModalInput" />
        </div>
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-t border-white/10">
          <div class="flex items-center gap-1 flex-wrap">
            <div class="relative inline-flex items-center">
              <select v-model="selectedModel" class="text-xs bg-white/5 border border-white/10 rounded text-white/70 hover:text-white h-7 py-0 pl-1.5 pr-6 outline-none appearance-none cursor-pointer [color-scheme:dark]">
                <option v-for="m in models" :key="m" :value="m" class="bg-neutral-900 text-white">{{ m }}</option>
              </select>
              <svg class="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="relative inline-flex items-center">
              <select v-model="selectedRatio" class="text-xs bg-white/5 border border-white/10 rounded text-white/70 hover:text-white h-7 py-0 pl-1.5 pr-5 outline-none appearance-none cursor-pointer [color-scheme:dark]">
                <option v-for="r in ratioOptions" :key="r" :value="r" class="bg-neutral-900 text-white">{{ r }}</option>
              </select>
              <svg class="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-white/70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="relative inline-flex items-center">
              <select v-model="selectedResolution" class="text-xs bg-white/5 border border-white/10 rounded text-white/70 hover:text-white h-7 py-0 pl-1.5 pr-5 outline-none appearance-none cursor-pointer [color-scheme:dark]">
                <option v-for="r in resolutionOptions" :key="r" :value="r" class="bg-neutral-900 text-white">{{ r }}</option>
              </select>
              <svg class="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-white/70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="relative inline-flex items-center">
              <select v-model="selectedDuration" class="text-xs bg-white/5 border border-white/10 rounded text-white/70 hover:text-white h-7 py-0 pl-1.5 pr-5 outline-none appearance-none cursor-pointer [color-scheme:dark]">
                <option v-for="d in durationOptions" :key="d" :value="d" class="bg-neutral-900 text-white">{{ d }}s</option>
              </select>
              <svg class="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-white/70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="relative inline-flex items-center">
              <select v-model="selectedCount" class="text-xs bg-white/5 border border-white/10 rounded text-white/70 hover:text-white h-7 py-0 pl-1.5 pr-4 outline-none appearance-none cursor-pointer [color-scheme:dark]">
                <option v-for="c in countOptions" :key="c" :value="c" class="bg-neutral-900 text-white">{{ c }}</option>
              </select>
              <svg class="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-white/70" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <button class="shrink-0 w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-900 hover:bg-neutral-200 disabled:opacity-50" :disabled="loading" @click="generate">
            <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            <span v-else class="loading loading-spinner loading-xs" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

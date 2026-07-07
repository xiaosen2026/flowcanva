<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import type { Node, Asset } from '../../types'
import MentionDropdown from '../MentionDropdown.vue'
import { useAssets } from '../../composables/useAssets'
import { useNodeConfigs } from '../../composables/useNodeConfigs'

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
const { getModels } = useNodeConfigs()

const content = ref('')
const selectedModel = ref('GPT-4')
const modalOpen = ref(false)

const models = ref<string[]>(['GPT-4', 'Claude 3', 'Gemini'])

interface UploadImage {
  id: number
  name: string
  dataUrl: string
}
const images = ref<UploadImage[]>([])
let imageCounter = 0
const connectedImages = ref<Map<string, UploadImage>>(new Map())

const previewImg = ref<UploadImage | null>(null)
const editableRef = ref<HTMLDivElement | null>(null)
const modalEditableRef = ref<HTMLDivElement | null>(null)
const showMention = ref(false)
const mentionFilter = ref('')
const mentionAnchor = ref<'inline' | 'modal'>('inline')

const filteredImages = computed(() => {
  const f = mentionFilter.value.toLowerCase()
  if (!f) return images.value
  return images.value.filter(img => img.name.toLowerCase().includes(f))
})

const plainText = computed(() => {
  const div = document.createElement('div')
  div.innerHTML = content.value
  return (div.textContent || '').trim()
})

watch(() => props.node, (n) => {
  if (n) {
    content.value = n.content
    modalOpen.value = false
    const typeModels = getModels(n.node_type)
    models.value = typeModels.length > 0 ? typeModels : ['GPT-4', 'Claude 3', 'Gemini']
    if (!models.value.includes(selectedModel.value)) {
      selectedModel.value = models.value[0] || 'GPT-4'
    }
    const connIds = new Set([...connectedImages.value.values()].map(i => i.id))
    images.value = images.value.filter(i => {
      const isConnected = [...connectedImages.value.values()].some(ci => ci.id === i.id)
      return isConnected ? connIds.has(i.id) : true
    })
    nextTick(() => {
      if (editableRef.value) editableRef.value.innerHTML = n.content || ''
      if (modalEditableRef.value) modalEditableRef.value.innerHTML = n.content || ''
    })
  }
}, { immediate: true })

watch(() => props.nodeInputs, (inputs) => {
  if (!inputs) return
  const currentEdgeIds = new Set<string>()
  for (const inp of inputs) {
    if ((inp.sourceNodeType === 'asset' || inp.sourceNodeType === 'image') && inp.data?.dataUrl) {
      currentEdgeIds.add(inp.edgeId)
      if (!connectedImages.value.has(inp.edgeId)) {
        imageCounter++
        const img = { id: imageCounter, name: `图片${imageCounter}`, dataUrl: inp.data.dataUrl }
        connectedImages.value.set(inp.edgeId, img)
        images.value.push(img)
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
        images.value.push({ id: imageCounter, name, dataUrl: reader.result as string })
      }
      reader.readAsDataURL(file)
      addAsset(file)
    }
  }
  input.click()
}

function removeImage(img: UploadImage) {
  images.value = images.value.filter(i => i.id !== img.id)
}

function syncContent(anchor: 'inline' | 'modal') {
  const el = anchor === 'inline' ? editableRef.value : modalEditableRef.value
  if (el) content.value = el.innerHTML
}

function onEditableInput(anchor: 'inline' | 'modal') {
  syncContent(anchor)
  onTextInput(anchor)
}

function onTextInput(anchor: 'inline' | 'modal') {
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

  const space = document.createTextNode(' ')

  range.insertNode(space)
  range.insertNode(chip)

  sel.removeAllRanges()
  range.setStartAfter(space)
  range.collapse(true)
  sel.addRange(range)

  showMention.value = false
  syncContent(mentionAnchor.value)
}

function onSend() {
  if (!props.node) return
  emit('save', content.value)
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

      <!-- @提及下拉 -->
      <div v-if="showMention" class="relative">
        <MentionDropdown
          :connected-images="images"
          :filter="mentionFilter"
          @insert="insertMention"
          @remove-asset="(id: string) => emit('remove-asset', id)"
          @update-asset="(id: string, data: any) => emit('update-asset', id, data)"
        />
      </div>

      <!-- 行内输入 -->
      <div class="relative">
        <div
          ref="editableRef"
          contenteditable="true"
          class="w-full bg-transparent outline-0 text-white text-sm px-1 min-h-[80px] max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入剧本配置...'] empty:before:text-white/30"
          @input="onEditableInput('inline')"
          @keydown.enter="onEditableInput('inline')"
        />
      </div>

      <!-- 底部 -->
      <div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
        <div class="relative inline-flex items-center">
          <select v-model="selectedModel" class="text-xs bg-transparent border-0 text-white/70 hover:text-white h-6 py-0 pl-0 pr-6 w-auto outline-none focus:outline-none [color-scheme:dark] appearance-none cursor-pointer">
            <option v-for="m in models" :key="m" :value="m" class="bg-neutral-900 text-white">{{ m }}</option>
          </select>
          <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <button class="btn btn-sm btn-circle h-9 w-9 bg-white border-0 text-neutral-900 hover:bg-neutral-200 shrink-0" @click="onSend">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- 图片预览弹窗 -->
  <Teleport to="body">
    <div v-if="previewImg" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" @click="previewImg = null">
      <img :src="previewImg.dataUrl" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" @click.stop />
      <button class="absolute top-4 right-4 btn btn-sm btn-circle bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="previewImg = null">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </Teleport>

  <!-- 放大编辑弹窗 -->
  <Teleport to="body">
    <div v-if="modalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center" @click.self="modalOpen = false">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div class="relative w-[720px] max-w-[95vw] max-h-[90vh] bg-neutral-900/95 backdrop-blur rounded-2xl border border-white/20 p-6 shadow-sm flex flex-col">
        <button class="btn btn-sm btn-square absolute top-3 right-3 bg-white/10 border border-white/30 text-white hover:bg-white/20" title="关闭" @click="modalOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <!-- 图片输入行 -->
        <div class="flex items-center gap-2 mb-3">
          <div class="shrink-0 w-14 h-14 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2"/></svg>
            <span class="text-[10px] leading-none">识图</span>
          </div>
          <div
            v-for="img in images" :key="img.id"
            class="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/15 cursor-pointer hover:border-white/50 transition-colors"
            @click.stop="previewImg = img"
          >
            <img :src="img.dataUrl" class="w-full h-full object-cover" />
            <span class="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/60 text-white/80 truncate px-1 leading-tight">{{ img.name }}</span>
            <button class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-neutral-800 border border-white/20 text-white/60 hover:text-white flex items-center justify-center text-xs leading-none" @click.stop="removeImage(img)">×</button>
          </div>
          <button class="shrink-0 w-14 h-14 rounded-lg border border-white/15 flex flex-col items-center justify-center text-white/40 hover:text-white/60 hover:border-white/25 transition-colors gap-1" @click="onAddImage">
            <span class="text-lg leading-none">+</span>
            <span class="text-[10px] leading-none">添加</span>
          </button>
        </div>

        <!-- 放大编辑输入 -->
        <div class="relative flex-1">
          <div
            ref="modalEditableRef"
            contenteditable="true"
            class="w-full h-full bg-transparent outline-0 text-white text-base px-1 overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入剧本配置...'] empty:before:text-white/30"
            @input="onEditableInput('modal')"
            @keydown.enter="onEditableInput('modal')"
          />
        </div>

        <div class="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
          <div class="relative inline-flex items-center">
            <select v-model="selectedModel" class="text-sm bg-transparent border-0 text-white/70 hover:text-white h-8 py-0 pl-0 pr-7 w-auto outline-none focus:outline-none [color-scheme:dark] appearance-none cursor-pointer">
              <option v-for="m in models" :key="m" :value="m" class="bg-neutral-900 text-white">{{ m }}</option>
            </select>
            <svg class="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-white/70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          <button class="btn btn-md btn-circle h-11 w-11 bg-white border-0 text-neutral-900 hover:bg-neutral-200 shrink-0" @click="onSend">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

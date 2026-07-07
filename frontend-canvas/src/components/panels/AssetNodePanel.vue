<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Node, Asset } from '../../types'
import { useAssets } from '../../composables/useAssets'

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

interface UploadImage {
  name: string
  dataUrl: string
  size: number
}
const image = ref<UploadImage | null>(null)
const previewOpen = ref(false)
const isDragOver = ref(false)

watch(() => props.node, (n) => {
  if (n) {
    image.value = null
    nextTick(() => {
      if (n.content) {
        try {
          const parsed = JSON.parse(n.content)
          if (parsed && parsed.dataUrl) {
            image.value = parsed
          }
        } catch {}
      }
    })
  }
}, { immediate: true })

function onSelectImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      image.value = {
        name: file.name,
        dataUrl: reader.result as string,
        size: file.size,
      }
      emit('save', JSON.stringify(image.value))
    }
    reader.readAsDataURL(file)
    addAsset(file)
  }
  input.click()
}

function onRemove() {
  image.value = null
  emit('save', '')
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    image.value = {
      name: file.name,
      dataUrl: reader.result as string,
      size: file.size,
    }
    emit('save', JSON.stringify(image.value))
  }
  reader.readAsDataURL(file)
  addAsset(file)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}
</script>

<template>
  <div v-if="node" :style="panelStyle" class="pointer-events-auto" @pointerdown.stop>
    <div class="bg-neutral-900/95 backdrop-blur rounded-2xl border border-white/20 p-4 relative">
      <!-- 未上传：拖放/点击区域 -->
      <div v-if="!image"
        class="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
        :class="isDragOver ? 'border-blue-400 bg-blue-400/10' : 'border-white/15 hover:border-white/30'"
        @click="onSelectImage"
        @drop.prevent="onDrop"
        @dragover.prevent="onDragOver"
        @dragleave="isDragOver = false"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 text-white/30">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="text-white/50 text-sm">拖放图片到此处，或点击上传</p>
        <p class="text-white/20 text-xs mt-1">支持 PNG / JPG / WebP / GIF</p>
      </div>

      <!-- 已上传：单图预览 -->
      <div v-else class="source-image-preview is-loaded rounded-xl overflow-hidden border border-white/15 bg-neutral-800">
        <img
          :src="image.dataUrl"
          :alt="image.name"
          class="w-full object-contain max-h-[360px] cursor-pointer"
          @click="previewOpen = true"
        />
        <div class="flex items-center justify-between px-3 py-2 border-t border-white/10">
          <div class="min-w-0 flex-1">
            <p class="text-xs text-white/80 truncate">{{ image.name }}</p>
            <p class="text-[10px] text-white/40">{{ formatSize(image.size) }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="btn btn-xs bg-white/10 border border-white/20 text-white/60 hover:text-white hover:bg-white/20"
              @click="onSelectImage"
            >
              更换
            </button>
            <button
              class="btn btn-xs bg-white/10 border border-white/20 text-white/60 hover:text-white hover:bg-red-500/20 hover:border-red-500/30"
              @click="onRemove"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 大图预览弹窗 -->
  <Teleport to="body">
    <div v-if="previewOpen && image" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" @click="previewOpen = false">
      <img :src="image.dataUrl" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" @click.stop />
      <button class="absolute top-4 right-4 btn btn-sm btn-circle bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="previewOpen = false">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </Teleport>
</template>

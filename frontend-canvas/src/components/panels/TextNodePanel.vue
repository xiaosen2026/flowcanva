<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { marked } from 'marked'
import type { Node } from '../../types'

const props = defineProps<{
  node: Node | null
  panelStyle: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'save', content: string): void
}>()

const content = ref('')
const contentPlain = ref('')
const modalOpen = ref(false)

const editableRef = ref<HTMLDivElement | null>(null)
const modalEditableRef = ref<HTMLDivElement | null>(null)

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
}

watch(() => props.node, (n) => {
  if (n) {
    modalOpen.value = false
    nextTick(() => {
      if (editableRef.value) editableRef.value.textContent = n.content || ''
      if (modalEditableRef.value) modalEditableRef.value.textContent = n.content || ''
      syncContent('inline')
    })
  }
}, { immediate: true })

let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(contentPlain, () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (props.node) {
      emit('save', contentPlain.value)
    }
  }, 500)
})

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
      <button class="btn btn-xs btn-square absolute top-2 right-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 z-10" title="放大编辑" @click="modalOpen = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>

      <div ref="editableRef" contenteditable="true" class="w-full bg-transparent outline-0 text-white text-sm px-1 min-h-[60px] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-['输入文本内容...'] empty:before:text-white/30" @input="onEditableInput('inline')" @keydown.enter="onEditableInput('inline')" />

      <div class="mt-3 pt-3 border-t border-white/10" />
    </div>
  </div>

  <Teleport to="body">
    <div v-if="modalOpen" class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70" @click.self="modalOpen = false">
      <div class="bg-neutral-900 border border-white/20 rounded-2xl w-[640px] max-h-[85vh] flex flex-col shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span class="text-sm font-medium text-white/70">文本编辑</span>
          <button class="btn btn-xs btn-square bg-white/10 border border-white/30 text-white hover:bg-white/20" @click="modalOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div ref="modalEditableRef" contenteditable="true" class="flex-1 p-5 text-white text-sm outline-none overflow-y-auto min-h-[260px] whitespace-pre-wrap break-words" @input="onEditableInput('modal')" />
      </div>
    </div>
  </Teleport>
</template>

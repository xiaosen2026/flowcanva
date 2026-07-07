<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { fetchAssets, uploadAsset, deleteAsset, updateAsset } from '../api'
import type { Asset } from '../types'

const ASSET_CATEGORIES = ['全部', '人物', '场景', '物品', '视频', '音频', '风格', '其他'] as const
const PAGE_SIZE = 24

const assets = ref<Asset[]>([])
const totalCount = ref(0)
const activeCategory = ref<string>('全部')
const isDragOver = ref(false)
const uploading = ref(false)
const page = ref(1)
const previewAsset = ref<Asset | null>(null)
const selectedIds = ref<Set<string>>(new Set())

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

async function loadAssets(p: number = page.value, cat: string = activeCategory.value) {
  try {
    const res = await fetchAssets({
      page: p,
      page_size: PAGE_SIZE,
      category: cat !== '全部' ? cat : undefined,
    })
    assets.value = res.items
    totalCount.value = res.total
    page.value = res.page
    selectedIds.value.clear()
  } catch (e) {
    console.error(e)
  }
}

onMounted(() => loadAssets())

watch(activeCategory, () => {
  page.value = 1
  loadAssets(1, activeCategory.value)
})

watch(page, () => {
  loadAssets(page.value, activeCategory.value)
})

const selectedCount = computed(() => selectedIds.value.size)
const isAllSelected = computed(() => assets.value.length > 0 && assets.value.every(a => selectedIds.value.has(a.id)))
const isPartialSelected = computed(() => !isAllSelected.value && assets.value.some(a => selectedIds.value.has(a.id)))

function toggleSelectAll() {
  if (isAllSelected.value) {
    for (const a of assets.value) selectedIds.value.delete(a.id)
  } else {
    for (const a of assets.value) selectedIds.value.add(a.id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

async function batchDelete() {
  if (selectedIds.value.size === 0) return
  if (!confirm(`确定删除选中的 ${selectedIds.value.size} 个素材？`)) return
  for (const id of selectedIds.value) {
    await deleteAsset(id).catch(() => {})
  }
  selectedIds.value = new Set()

  // if current page is now empty, go to previous page
  if (assets.value.length === selectedIds.value.size && page.value > 1) {
    page.value--
  } else {
    loadAssets()
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除此素材？')) return
  await deleteAsset(id)
  if (assets.value.length === 1 && page.value > 1) {
    page.value--
  } else {
    loadAssets()
  }
}

function triggerUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*,audio/*'
  input.multiple = true
  input.onchange = async () => {
    const files = input.files
    if (!files) return
    uploading.value = true
    for (let i = 0; i < files.length; i++) {
      await uploadAsset(files[i])
    }
    uploading.value = false
    page.value = 1
    loadAssets(1, activeCategory.value)
  }
  input.click()
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (!files) return
  uploading.value = true
  for (let i = 0; i < files.length; i++) {
    await uploadAsset(files[i])
  }
  uploading.value = false
  page.value = 1
  loadAssets(1, activeCategory.value)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

async function handleCategoryChange(id: string, category: string) {
  await updateAsset(id, { category })
  const a = assets.value.find(x => x.id === id)
  if (a) a.category = category
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

const previewIndex = computed(() => {
  if (!previewAsset.value) return -1
  return assets.value.findIndex(a => a.id === previewAsset.value!.id)
})

function openPreview(asset: Asset) {
  previewAsset.value = asset
}

function closePreview() {
  previewAsset.value = null
}

function nextPreview() {
  const idx = previewIndex.value
  if (idx < assets.value.length - 1) {
    previewAsset.value = assets.value[idx + 1]
  }
}

function prevPreview() {
  const idx = previewIndex.value
  if (idx > 0) {
    previewAsset.value = assets.value[idx - 1]
  }
}

function onPreviewKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePreview()
  if (e.key === 'ArrowRight') nextPreview()
  if (e.key === 'ArrowLeft') prevPreview()
}

watch(previewAsset, (val) => {
  if (val) {
    document.addEventListener('keydown', onPreviewKeydown)
  } else {
    document.removeEventListener('keydown', onPreviewKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onPreviewKeydown)
})
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto space-y-8">
    <!-- Header 说明区域 -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-base-200/80">
      <div class="space-y-1.5">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6.5 h-6.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90">素材库</h1>
            <p class="text-xs text-base-content/40 font-medium">共 {{ totalCount.toLocaleString() }} 个资产项目</p>
          </div>
        </div>
        <p class="text-sm text-base-content/40 max-w-2xl leading-relaxed">
          统一管理并检索画布创作中使用到的多媒体资产、模型输出和创意参考素材，支持分类打标与批量管理。
        </p>
      </div>
    </div>

    <!-- 拖拽上传卡片 -->
    <div
      class="border border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer"
      :class="isDragOver ? 'border-primary bg-primary/5 shadow-md scale-[1.005]' : 'border-base-300 bg-base-100 hover:border-primary/30 hover:shadow-sm'"
      @click="triggerUpload"
      @drop.prevent="onDrop"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
    >
      <template v-if="uploading">
        <div class="flex flex-col items-center justify-center gap-3 py-2">
          <span class="loading loading-spinner loading-md text-primary" />
          <span class="text-xs font-bold text-primary animate-pulse">正在上传素材到文件服务器...</span>
        </div>
      </template>
      <template v-else>
        <div class="w-12 h-12 rounded-full bg-base-200/50 flex items-center justify-center mx-auto mb-3 text-base-content/30 group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="text-base-content/50 text-sm font-semibold">拖放图片/视频/音频到此处，或点击选择文件</p>
        <p class="text-base-content/25 text-xs mt-1">支持图片 / 视频 / 音频等多种多媒体资源批量上传</p>
      </template>
    </div>

    <!-- 操作与过滤栏 -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <!-- 分类 tab -->
      <div class="flex flex-wrap gap-1.5 bg-base-200/45 p-1 rounded-xl w-fit">
        <button
          v-for="cat in ASSET_CATEGORIES" :key="cat"
          class="px-4 py-1.5 text-xs rounded-lg transition-all font-semibold"
          :class="activeCategory === cat
            ? 'bg-base-100 text-primary shadow-sm border border-base-200/30'
            : 'text-base-content/50 hover:text-base-content/80 bg-transparent'"
          @click="activeCategory = cat"
        >{{ cat }}</button>
      </div>

      <!-- 全选开关 -->
      <div v-if="assets.length > 0" class="flex items-center gap-2 px-1">
        <label class="label cursor-pointer gap-2 py-0">
          <input type="checkbox" :checked="isAllSelected" class="checkbox checkbox-xs checkbox-primary rounded" @change="toggleSelectAll" />
          <span class="label-text text-xs text-base-content/40 font-bold">全选当前页</span>
        </label>
      </div>
    </div>

    <!-- 批量选择操作浮层 -->
    <div v-if="selectedCount > 0" class="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-2xl animate-fade-in">
      <span class="text-xs font-bold text-primary">已选择 {{ selectedCount }} 项素材</span>
      <button class="btn btn-xs bg-error/10 hover:bg-error hover:text-error-content text-error border-none rounded-lg" @click="batchDelete">批量删除</button>
      <button class="btn btn-xs btn-ghost text-base-content/40 hover:bg-base-200/50 rounded-lg ml-auto" @click="selectedIds.clear()">取消选择</button>
    </div>

    <!-- 资产网格列表 -->
    <div>
      <div v-if="assets.length === 0" class="flex flex-col items-center justify-center text-base-content/20 py-24 bg-base-100 border border-base-200/80 rounded-2xl shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="mb-4 text-base-content/15">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <p class="text-xs font-bold text-base-content/35">当前分类暂无任何资产，快去拖拽上传吧</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        <div
          v-for="a in assets" :key="a.id"
          class="group card bg-base-100 border overflow-hidden transition-all duration-300 rounded-2xl relative"
          :class="selectedIds.has(a.id) ? 'border-primary/40 shadow-sm ring-1 ring-primary/10' : 'border-base-200 hover:border-primary/20 hover:shadow-sm'"
        >
          <!-- 选中框（常驻或Hover时优雅浮现） -->
          <div class="absolute top-2 left-2 z-10">
            <input type="checkbox" :checked="selectedIds.has(a.id)" class="checkbox checkbox-xs checkbox-primary rounded transition-all" :class="selectedIds.has(a.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-base-100/90'" @change="toggleSelect(a.id)" />
          </div>

          <div class="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden relative border-b border-base-200">
            <img :src="a.url" class="w-full h-full object-contain cursor-pointer transition-transform duration-500 group-hover:scale-[1.03]" :alt="a.filename" loading="lazy" @click="openPreview(a)" />
          </div>

          <div class="p-3 space-y-1.5 bg-base-100">
            <p class="text-[11px] font-bold text-base-content/85 truncate" :title="a.filename">{{ a.filename }}</p>
            <p class="text-[9px] text-base-content/30 font-mono font-bold">{{ formatSize(a.size) }}</p>
            <div class="flex items-center gap-1">
              <select
                class="flex-1 bg-base-200/50 hover:bg-base-200 border border-transparent rounded-lg text-[10px] px-1.5 py-1 outline-none font-bold text-base-content/65 cursor-pointer transition-colors"
                :value="a.category || '其他'"
                @click.stop
                @change="handleCategoryChange(a.id, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="cat in ASSET_CATEGORIES.filter(c => c !== '全部')" :key="cat" :value="cat">{{ cat }}</option>
              </select>
              <button
                class="btn btn-ghost hover:bg-error/10 hover:text-error btn-xs h-6.5 w-6.5 min-h-0 p-0 text-base-content/25 rounded-md flex items-center justify-center font-bold"
                title="删除素材"
                @click="handleDelete(a.id)"
              >✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 pt-8 border-t border-base-200/60 mt-10">
        <button class="btn btn-xs btn-ghost border border-base-200" :disabled="page <= 1" @click="page--; loadAssets()">上一页</button>
        <span class="text-xs text-base-content/40 font-semibold">{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-xs btn-ghost border border-base-200" :disabled="page >= totalPages" @click="page++; loadAssets()">下一页</button>
      </div>
    </div>

    <!-- 图片预览灯箱 -->
    <Teleport to="body">
      <div
        v-if="previewAsset"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xs"
        @click.self="closePreview"
      >
        <button class="absolute top-4 right-4 btn btn-sm btn-circle bg-white/10 border-none text-white hover:bg-white/20 z-10" @click="closePreview">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button
          v-if="previewIndex > 0"
          class="absolute left-4 top-1/2 -translate-y-1/2 btn btn-md btn-circle bg-white/10 border-none text-white hover:bg-white/20 z-10"
          @click.stop="prevPreview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button
          v-if="previewIndex < assets.length - 1"
          class="absolute right-4 top-1/2 -translate-y-1/2 btn btn-md btn-circle bg-white/10 border-none text-white hover:bg-white/20 z-10"
          @click.stop="nextPreview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <img :src="previewAsset.url" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" :alt="previewAsset.filename" />
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-semibold bg-black/40 backdrop-blur-md py-1.5 px-4 rounded-full">
          {{ previewAsset.filename }} &middot; {{ formatSize(previewAsset.size) }} &middot; {{ previewIndex + 1 }} / {{ assets.length }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

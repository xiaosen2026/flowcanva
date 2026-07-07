<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAssets, ASSET_CATEGORIES } from '../composables/useAssets'

interface MentionImage {
  id: number | string
  name: string
  src: string
}

const props = defineProps<{
  connectedImages: { id: number; name: string; dataUrl: string }[]
  filter: string
}>()

const emit = defineEmits<{
  (e: 'insert', img: MentionImage): void
}>()

const { assets, loadAssets } = useAssets()
const activeCategory = ref<string>('全部')
const librarySearch = ref('')
const PAGE_SIZE = 20
const visibleCount = ref(PAGE_SIZE)

// 首次打开时加载资产库
loadAssets()

// 切换分类或搜索词时重置分页
watch([activeCategory, librarySearch], () => {
  visibleCount.value = PAGE_SIZE
})

const f = computed(() => props.filter.toLowerCase())

const filteredConnected = computed(() => {
  if (!f.value) return props.connectedImages
  return props.connectedImages.filter(img => img.name.toLowerCase().includes(f.value))
})

const filteredAssets = computed(() => {
  let list = assets.value
  if (activeCategory.value !== '全部') {
    list = list.filter(a => a.category === activeCategory.value)
  }
  const s = librarySearch.value.toLowerCase()
  if (s) {
    list = list.filter(a => a.filename.toLowerCase().includes(s))
  } else if (f.value) {
    list = list.filter(a => a.filename.toLowerCase().includes(f.value))
  }
  return list
})

const displayAssets = computed(() => filteredAssets.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredAssets.value.length)

function loadMore() {
  visibleCount.value += PAGE_SIZE
}

function selectImg(item: { id: any; name: string; src: string }) {
  emit('insert', { id: item.id, name: item.name, src: item.src })
}
</script>

<template>
  <div class="absolute bottom-full left-0 mb-1 bg-neutral-800 border border-white/15 rounded-lg py-1 min-w-[240px] max-h-[360px] flex flex-col z-30 shadow-sm">
    <!-- 已连节点（固定高度） -->
    <div class="shrink-0">
      <div class="px-2 pt-1 pb-0.5 text-[10px] text-white/40 uppercase tracking-wide">已连节点</div>
      <button
        v-for="img in filteredConnected" :key="`c-${img.id}`"
        class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10"
        @click="selectImg({ id: img.id, name: img.name, src: img.dataUrl })"
      >
        <img :src="img.dataUrl" class="w-5 h-5 rounded object-cover shrink-0" />
        <span>@{{ img.name }}</span>
      </button>
      <div v-if="filteredConnected.length === 0" class="px-3 py-1 text-[11px] text-white/25">无</div>
    </div>

    <div class="mx-2 my-1 border-t border-white/10 shrink-0" />

    <!-- 个人资产库（可滚动区域） -->
    <div class="px-2 pt-1 pb-0.5 text-[10px] text-white/40 uppercase tracking-wide shrink-0">个人资产库</div>

    <!-- 搜索栏 -->
    <div class="px-2 pb-1 shrink-0">
      <input
        v-model="librarySearch"
        type="text"
        placeholder="搜索资产..."
        class="w-full bg-neutral-700 border border-white/10 rounded-md text-xs text-white/90 px-2 py-1 outline-none focus:border-white/20 placeholder:text-white/25"
        @pointerdown.stop
        @keydown.stop
        @input.stop
      />
    </div>

    <!-- 二级分类 tab -->
    <div class="flex flex-wrap gap-0.5 px-2 pb-1.5 shrink-0">
      <button
        v-for="cat in ASSET_CATEGORIES" :key="cat"
        class="px-1.5 py-0.5 text-[10px] rounded border transition-colors"
        :class="activeCategory === cat
          ? 'bg-white/20 border-white/40 text-white'
          : 'bg-transparent border-white/10 text-white/50 hover:text-white/80'"
        @click="activeCategory = cat"
      >{{ cat }}</button>
    </div>

    <!-- 资产列表（滚动区） -->
    <div class="overflow-y-auto flex-1 min-h-0">
      <button
        v-for="a in displayAssets" :key="`a-${a.id}`"
        class="group flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/10"
        @click="selectImg({ id: a.id, name: a.filename, src: a.url })"
      >
        <img :src="a.url" class="w-5 h-5 rounded object-cover shrink-0" />
        <span class="flex-1 truncate">{{ a.filename }}</span>
      </button>
      <div v-if="displayAssets.length === 0" class="px-3 py-1 text-[11px] text-white/25">无</div>

      <!-- 加载更多 -->
      <div
        v-if="hasMore"
        class="px-3 py-1.5 text-center text-[11px] text-white/40 hover:text-white/70 cursor-pointer border-t border-white/5"
        @click.stop="loadMore"
      >
        加载更多（{{ filteredAssets.length - visibleCount }} 张）
      </div>
    </div>
  </div>
</template>

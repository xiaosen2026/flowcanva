<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchCanvases, createCanvas, deleteCanvas, renameCanvas } from '../api'
import type { Canvas } from '../types'

const CANVAS_APP_URL = '/canvas'
const PAGE_SIZE = 20

const canvases = ref<Canvas[]>([])
const totalCount = ref(0)
const page = ref(1)
const loading = ref(false)
const showCreate = ref(false)
const newName = ref('')
const editingId = ref<string | null>(null)
const editName = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

function formatDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  try {
    const res = await fetchCanvases({ page: page.value, page_size: PAGE_SIZE, project_type: 'canvas' })
    canvases.value = res.items
    totalCount.value = res.total
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  const name = newName.value.trim()
  if (!name) return
  try {
    await createCanvas(name, 'canvas')
    newName.value = ''
    showCreate.value = false
    page.value = 1
    await load()
  } catch (e) {
    console.error(e)
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除该画布？')) return
  try {
    await deleteCanvas(id)
    await load()
  } catch (e) {
    console.error(e)
  }
}

function startRename(c: Canvas) {
  editingId.value = c.id
  editName.value = c.name
}

async function confirmRename() {
  if (!editingId.value || !editName.value.trim()) return
  try {
    await renameCanvas(editingId.value, editName.value.trim())
    editingId.value = null
    await load()
  } catch (e) {
    console.error(e)
  }
}

function cancelRename() { editingId.value = null }

function enterCanvas(id: string) {
  window.open(`${CANVAS_APP_URL}#/?canvas=${id}`, '_blank')
}

onMounted(load)
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <!-- Header 头部渐变区 -->
    <div class="rounded-3xl bg-gradient-to-br from-primary/8 via-primary/3 to-transparent border border-primary/10 p-8 mb-8">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div class="space-y-2">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
            </div>
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight text-base-content/90">画布项目</h1>
              <p class="text-sm text-base-content/50 font-semibold">{{ totalCount.toLocaleString() }} 个项目</p>
            </div>
          </div>
          <p class="text-sm text-base-content/45 max-w-2xl leading-relaxed pl-[72px]">
            FlowCanva 自由编排，随心所欲摆放、连线和控制各类内容与多媒体节点。
          </p>
        </div>

      <button class="btn btn-primary btn-md gap-2 rounded-2xl font-bold tracking-wide shadow-sm hover:shadow-md transition-all duration-300 active:scale-[0.98] shrink-0 self-start md:self-center" @click="showCreate = true">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        新建画布
      </button>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="space-y-8">
      <div v-if="loading && canvases.length === 0" class="flex items-center justify-center py-24">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <template v-else>
        <div v-if="canvases.length === 0" class="text-center py-20 bg-base-100 border border-base-200/80 rounded-2xl shadow-sm max-w-lg mx-auto">
          <div class="w-20 h-20 mx-auto mb-5 rounded-3xl bg-base-200/40 flex items-center justify-center border border-base-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-base-content/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          </div>
          <p class="text-xs text-base-content/30 font-bold mb-4">暂无任何画布项目</p>
          <button class="btn btn-primary btn-sm rounded-lg font-bold" @click="showCreate = true">立即创建</button>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div
            v-for="cv in canvases" :key="cv.id"
            class="card bg-base-100 border border-base-200/80 shadow-sm hover:border-primary/30 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group rounded-2xl overflow-hidden"
            @click="enterCanvas(cv.id)"
          >
            <div class="card-body p-5 space-y-4">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
                  </div>
                  <div v-if="editingId === cv.id" class="min-w-0 flex-1" @click.stop>
                    <input v-model="editName" class="input input-xs input-bordered w-full font-bold text-xs" @keydown.enter="confirmRename" @keydown.escape="cancelRename" />
                    <div class="flex gap-1.5 mt-2 justify-end">
                      <button class="btn btn-xs btn-ghost h-6 min-h-0 py-0 px-2 rounded-md font-bold text-success hover:bg-success/10 text-[10px]" @click="confirmRename">确认</button>
                      <button class="btn btn-xs btn-ghost h-6 min-h-0 py-0 px-2 rounded-md font-bold text-base-content/50 text-[10px]" @click="cancelRename">取消</button>
                    </div>
                  </div>
                  <div v-else class="min-w-0 flex-1">
                    <h2 class="font-bold text-sm text-base-content/85 truncate group-hover:text-base-content transition-colors">{{ cv.name }}</h2>
                  </div>
                </div>
                <div class="dropdown dropdown-end shrink-0" @click.stop>
                  <button tabindex="0" class="btn btn-ghost btn-xs btn-square hover:bg-base-200 opacity-0 group-hover:opacity-100 transition-opacity font-bold">···</button>
                  <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-xl z-20 w-36 p-1.5 shadow-md border border-base-200">
                    <li><button class="text-xs font-semibold py-2" @click="startRename(cv)">重命名</button></li>
                    <li><button class="text-error text-xs font-semibold py-2" @click="handleDelete(cv.id)">删除项目</button></li>
                  </ul>
                </div>
              </div>

              <!-- 缩略图占位层 -->
              <div class="bg-slate-50/50 rounded-xl border border-base-200 aspect-video flex items-center justify-center group-hover:border-primary/15 transition-colors duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-base-content/10 group-hover:text-primary/20 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
              </div>

              <div class="flex items-center justify-between border-t border-base-200/50 pt-3 text-[10px] font-medium text-base-content/30">
                <span class="font-mono tracking-wider">{{ cv.id }}</span>
                <span class="font-medium">{{ formatDate(cv.updated_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 pt-8 border-t border-base-200/60 mt-10">
          <button class="btn btn-xs btn-ghost border border-base-200" :disabled="page <= 1" @click="page--; load()">上一页</button>
          <span class="text-xs text-base-content/40 font-semibold">{{ page }} / {{ totalPages }}</span>
          <button class="btn btn-xs btn-ghost border border-base-200" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
        </div>
      </template>
    </div>

    <!-- 创建 Modal -->
    <dialog :class="{ 'modal': true, 'modal-open': showCreate }">
      <div class="modal-box rounded-2xl border border-base-200/80 p-6 max-w-md shadow-lg">
        <h3 class="text-base font-bold text-base-content/90 mb-4 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          新建画布项目
        </h3>
        <input v-model="newName" class="input input-bordered w-full text-sm font-medium focus:ring-2 focus:ring-primary/10" placeholder="请输入画布名称" @keydown.enter="handleCreate" />
        <div class="modal-action gap-2 mt-6">
          <button class="btn btn-ghost btn-sm px-4 rounded-xl font-bold" @click="showCreate = false">取消</button>
          <button class="btn btn-primary btn-sm px-4 rounded-xl font-bold shadow-sm" @click="handleCreate" :disabled="!newName.trim()">确认创建</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop bg-black/40 backdrop-blur-xs"><button @click="showCreate = false">关闭</button></form>
    </dialog>
  </div>
</template>

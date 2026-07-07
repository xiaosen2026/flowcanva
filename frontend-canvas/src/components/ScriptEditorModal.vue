<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Node } from '../types'

const DEFAULT_COLS = ['镜号', '时长', '画面描述', '角色1', '角色描述1', '角色图1参考', '景别', '角色动作', '情绪', '场景标签', '光影氛围', '音效', '对白', '分镜提示词', '视频运动提示词']

const props = defineProps<{
  node: Node | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', content: string): void
}>()

const cols = ref<string[]>([...DEFAULT_COLS])
const colWidths = ref<number[]>([])
const rows = ref<string[][]>([])
const editingCell = ref<{ r: number; c: number } | null>(null)
const resizingCol = ref<number | null>(null)
let resizeStartX = 0, resizeStartW = 0

function loadData() {
  if (!props.node) return
  try {
    const d = JSON.parse(props.node.content || '{}')
    cols.value = d.cols?.length ? d.cols : [...DEFAULT_COLS]
    colWidths.value = d.colWidths?.length ? d.colWidths : cols.value.map(() => 120)
    rows.value = d.rows || []
  } catch {
    cols.value = [...DEFAULT_COLS]
    colWidths.value = cols.value.map(() => 120)
    rows.value = []
  }
}

watch(() => props.node, loadData, { immediate: true })

function save() {
  emit('save', JSON.stringify({ cols: cols.value, colWidths: colWidths.value, rows: rows.value }))
}

function startResizeCol(ci: number, e: PointerEvent) {
  resizingCol.value = ci
  resizeStartX = e.clientX
  resizeStartW = colWidths.value[ci] || 120
  const target = e.currentTarget as HTMLElement
  target.addEventListener('pointermove', onResizeMove)
  target.addEventListener('pointerup', onResizeEnd)
  target.setPointerCapture(e.pointerId)
}

function onResizeMove(e: PointerEvent) {
  if (resizingCol.value === null) return
  const ci = resizingCol.value
  colWidths.value[ci] = Math.max(40, resizeStartW + e.clientX - resizeStartX)
}

function onResizeEnd(e: PointerEvent) {
  const target = e.currentTarget as HTMLElement
  target.removeEventListener('pointermove', onResizeMove)
  target.removeEventListener('pointerup', onResizeEnd)
  resizingCol.value = null
}

// 插入行: at=undefined 末尾; mode 'after' 在 at 行后, 'before' 在 at 行前
function addRow(at?: number, mode: 'after' | 'before' = 'after') {
  const newRow = new Array(cols.value.length).fill('')
  if (cols.value.length > 0) newRow[0] = String(rows.value.length + 1)
  const idx = at === undefined ? rows.value.length : (mode === 'after' ? at + 1 : at)
  rows.value.splice(idx, 0, newRow)
  renumberRows()
}

function removeRow(idx: number) {
  rows.value.splice(idx, 1)
  renumberRows()
}

function renumberRows() {
  rows.value.forEach((row, i) => { row[0] = String(i + 1) })
}

function updateColName(idx: number, e: Event) {
  cols.value[idx] = (e.target as HTMLInputElement).value
  save()
}

// 插入列: at=undefined 末尾; mode 'after' 在 at 列后, 'before' 在 at 列前
function addCol(at?: number, mode: 'after' | 'before' = 'after') {
  const name = `列${cols.value.length + 1}`
  const idx = at === undefined ? cols.value.length : (mode === 'after' ? at + 1 : at)
  cols.value.splice(idx, 0, name)
  for (const row of rows.value) row.splice(idx, 0, '')
}

function removeCol(idx: number) {
  cols.value.splice(idx, 1)
  for (const row of rows.value) row.splice(idx, 1)
}

// 粘贴识别: 剪贴板含 Tab/换行时按 TSV 解析,从当前单元格起铺开,不足的行列自动补齐
function onCellPaste(r: number, c: number, e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') || ''
  if (!text.includes('\t') && !text.includes('\n')) return  // 普通文本交给默认行为
  e.preventDefault()
  const lines = text.replace(/\r/g, '').split('\n')
  // Excel 粘贴常带尾部空行,去掉一个
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const matrix = lines.map(l => l.split('\t'))
  const needRows = r + matrix.length
  const needCols = c + Math.max(...matrix.map(row => row.length))
  while (rows.value.length < needRows) addRow()
  while (cols.value.length < needCols) addCol()
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      rows.value[r + i][c + j] = matrix[i][j]
    }
  }
  save()
}

function startEdit(r: number, c: number) {
  editingCell.value = { r, c }
  nextTick(() => {
    const el = document.getElementById(`cell-${r}-${c}`)
    if (el) (el as HTMLInputElement).focus()
  })
}

function endEdit(r: number, c: number, e: Event) {
  rows.value[r][c] = (e.target as HTMLInputElement).value
  editingCell.value = null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[10000] flex flex-col bg-neutral-950" @keydown="onKeydown">
      <!-- 工具栏 -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
        <span class="text-white/70 text-sm">剧本编辑器 — {{ rows.length }} 行 × {{ cols.length }} 列</span>
        <div class="flex items-center gap-2">
          <button class="h-7 px-3 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors" :title="editingCell ? '在光标行下方插入' : '末尾插入'" @click="editingCell ? addRow(editingCell.r, 'after') : addRow()">+ 行</button>
          <button class="h-7 px-3 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors" :title="editingCell ? '在光标列右侧插入' : '末尾插入'" @click="editingCell ? addCol(editingCell.c, 'after') : addCol()">+ 列</button>
          <button class="h-7 px-3 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors" @click="save()">保存 Ctrl+S</button>
          <button class="h-7 px-3 text-xs rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors" @click="emit('close')">关闭 Esc</button>
        </div>
      </div>

      <!-- 表格 -->
      <div class="flex-1 overflow-auto min-h-0">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th class="p-1 text-white/30 text-[10px] w-10 border-r border-white/15 shrink-0">#</th>
              <th v-for="(col, ci) in cols" :key="'h'+ci" class="p-1 border-r border-white/15 text-left relative group overflow-visible" :style="{ width: (colWidths[ci] || 120) + 'px', minWidth: (colWidths[ci] || 120) + 'px' }">
                <input :value="col" @change="updateColName(ci, $event)" class="bg-transparent text-white/60 text-xs font-medium outline-none w-full p-0.5 rounded hover:bg-white/5" />
                <button class="absolute right-1 top-0 w-4 h-4 rounded text-white/20 hover:text-red-400 text-[10px] leading-none opacity-0 group-hover:opacity-100" title="删除列" @click="removeCol(ci)">×</button>
                <div class="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-cyan-400/20" @pointerdown.stop="startResizeCol(ci, $event)" />
                <!-- 分隔线 + 号: hover 列底显示,点击右侧插入列 -->
                <button class="absolute left-1/2 -translate-x-1/2 -bottom-3 w-5 h-5 rounded-full bg-neutral-700 text-white/70 hover:text-white hover:bg-neutral-600 opacity-0 group-hover:opacity-100 text-xs leading-none flex items-center justify-center z-10 shadow-md" title="右侧插入列" @click.stop="addCol(ci, 'after')">+</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in rows" :key="'r'+ri" class="hover:bg-white/[0.02] group">
              <td class="p-1 text-white/20 text-[10px] text-center border-r border-white/15 align-top relative overflow-visible">
                <div class="flex flex-col items-center gap-0.5">
                  <span>{{ ri + 1 }}</span>
                  <button class="w-4 h-4 rounded text-white/30 hover:text-red-400 text-[10px] leading-none opacity-0 group-hover:opacity-100" title="删除行" @click="removeRow(ri)">×</button>
                </div>
                <!-- 分隔线 + 号: hover 行底显示,点击下方插入行 -->
                <button class="absolute left-1/2 -translate-x-1/2 -bottom-2.5 w-5 h-5 rounded-full bg-neutral-700 text-white/70 hover:text-white hover:bg-neutral-600 opacity-0 group-hover:opacity-100 text-xs leading-none flex items-center justify-center z-10 shadow-md" title="下方插入行" @click.stop="addRow(ri, 'after')">+</button>
              </td>
              <td v-for="(cell, ci) in row" :key="'c'+ri+'-'+ci" class="p-0 border-r border-white/15" :class="ci === 0 ? 'cursor-default' : 'cursor-text'" @click="ci !== 0 && startEdit(ri, ci)">
                <textarea
                  v-if="ci !== 0 && editingCell?.r === ri && editingCell?.c === ci"
                  :id="'cell-'+ri+'-'+ci"
                  :value="cell"
                  @blur="endEdit(ri, ci, $event)"
                  @paste="onCellPaste(ri, ci, $event)"
                  @keydown="(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { rows[ri][ci] = (e.target as HTMLTextAreaElement).value; editingCell = null; e.preventDefault() } }"
                  class="w-full bg-cyan-500/10 text-white/90 text-sm outline-none p-2 resize-y min-h-[64px]"
                />
                <div v-else class="p-1.5 text-sm whitespace-pre-wrap align-top" :class="ci === 0 ? 'text-white/30' : 'text-white/70'">{{ cell || '&nbsp;' }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Teleport>
</template>

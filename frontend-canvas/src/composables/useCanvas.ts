import { reactive, computed, readonly } from 'vue'
import type { ViewportState } from '../types'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 5

export function useCanvas() {
  const viewport = reactive<ViewportState>({ ox: 0, oy: 0, zoom: 1 })

  let isPanning = false
  let lastX = 0
  let lastY = 0

  const worldStyle = computed(() => ({
    position: 'absolute' as const,
    left: '0',
    top: '0',
    transformOrigin: '0 0',
    transform: `translate(${viewport.ox}px, ${viewport.oy}px) scale(${viewport.zoom})`,
    width: '0',
    height: '0',
    overflow: 'visible' as const,
  }))

  // 预计算 backgroundImage，避免每次移动都重新拼接字符串
  const GRID_BG = [
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
    'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
  ].join(',')

  const gridStyle = computed(() => {
    const gs = 24 * viewport.zoom
    const ox = viewport.ox % gs
    const oy = viewport.oy % gs
    const gs2 = gs * 4
    const size = `${gs}px ${gs}px`
    const size2 = `${gs2}px ${gs2}px`
    const pos = `${ox}px ${oy}px`
    return {
      position: 'absolute' as const,
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none' as const,
      backgroundImage: GRID_BG,
      backgroundSize: `${size}, ${size}, ${size2}, ${size2}`,
      backgroundPosition: `${pos}, ${pos}, ${pos}, ${pos}`,
    }
  })

  function screenToWorld(sx: number, sy: number) {
    return {
      wx: (sx - viewport.ox) / viewport.zoom,
      wy: (sy - viewport.oy) / viewport.zoom,
    }
  }

  function worldToScreen(wx: number, wy: number) {
    return {
      sx: wx * viewport.zoom + viewport.ox,
      sy: wy * viewport.zoom + viewport.oy,
    }
  }

  function zoomAt(px: number, py: number, factor: number) {
    const worldX = (px - viewport.ox) / viewport.zoom
    const worldY = (py - viewport.oy) / viewport.zoom
    viewport.zoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    viewport.ox = px - worldX * viewport.zoom
    viewport.oy = py - worldY * viewport.zoom
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      zoomAt(px, py, e.deltaY < 0 ? 1.08 : 0.93)
    } else {
      viewport.ox -= e.deltaX
      viewport.oy -= e.deltaY
    }
  }

  function onPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('.canvas-node, button, a, [role="button"], input, select, textarea')) return

    isPanning = true
    lastX = e.clientX
    lastY = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'grabbing'
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return
    viewport.ox += e.clientX - lastX
    viewport.oy += e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
  }

  function onPointerUp(e: PointerEvent) {
    if (!isPanning) return
    isPanning = false
    ;(e.currentTarget as HTMLElement)?.releasePointerCapture(e.pointerId)
    document.body.style.cursor = ''
  }

  function resetView() {
    viewport.ox = 0
    viewport.oy = 0
    viewport.zoom = 1
  }

  function zoomIn() {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    zoomAt(cx, cy, 1.25)
  }

  function zoomOut() {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    zoomAt(cx, cy, 0.8)
  }

  function navigateTo(wx: number, wy: number) {
    viewport.ox = window.innerWidth / 2 - wx * viewport.zoom
    viewport.oy = window.innerHeight / 2 - wy * viewport.zoom
  }

  return {
    viewport: readonly(viewport) as ViewportState,
    worldStyle,
    gridStyle,
    screenToWorld,
    worldToScreen,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetView,
    zoomIn,
    zoomOut,
    zoomAt,
    navigateTo,
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

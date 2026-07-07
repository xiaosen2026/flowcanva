import { computed } from 'vue'
import type { ViewportState, Node } from '../types'

export function useMinimap(getViewport: () => ViewportState, getNodes: () => Node[]) {
  const bounds = computed(() => {
    const nodes = getNodes()
    if (nodes.length === 0) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500, width: 1000, height: 1000 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x + n.width > maxX) maxX = n.x + n.width
      if (n.y + n.height > maxY) maxY = n.y + n.height
    }
    const pad = 300
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: (maxX - minX) + pad * 2,
      height: (maxY - minY) + pad * 2,
    }
  })

  const viewportRect = computed(() => {
    const viewport = getViewport()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const b = bounds.value
    const ww = vw / viewport.zoom
    const wh = vh / viewport.zoom
    const wx = -viewport.ox / viewport.zoom
    const wy = -viewport.oy / viewport.zoom
    return {
      left: ((wx - b.minX) / b.width) * 100 + '%',
      top: ((wy - b.minY) / b.height) * 100 + '%',
      width: (ww / b.width) * 100 + '%',
      height: (wh / b.height) * 100 + '%',
    }
  })

  function nodeStyle(n: Node) {
    const b = bounds.value
    return {
      left: ((n.x - b.minX) / b.width) * 100 + '%',
      top: ((n.y - b.minY) / b.height) * 100 + '%',
      width: (n.width / b.width) * 100 + '%',
      height: (n.height / b.height) * 100 + '%',
    }
  }

  return { bounds, viewportRect, nodeStyle }
}

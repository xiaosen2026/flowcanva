import { ref } from 'vue'
import type { Edge } from '../types'
import { fetchEdges, createEdge, deleteEdge } from '../api'

export function useEdges() {
  const edges = ref<Edge[]>([])
  const canvasId = ref<string | null>(null)

  async function loadEdges(cid: string) {
    canvasId.value = cid
    edges.value = await fetchEdges(cid)
  }

  async function addEdge(sourceNodeId: string, targetNodeId: string) {
    if (!canvasId.value) return
    // 不允许自连接
    if (sourceNodeId === targetNodeId) return
    // 不允许重复连接
    const exists = edges.value.find(
      e => e.source_node_id === sourceNodeId && e.target_node_id === targetNodeId
    )
    if (exists) return
    // 不允许形成环路（BFS 检测 targetNodeId 是否已能到达 sourceNodeId）
    if (hasPath(targetNodeId, sourceNodeId)) return

    const e = await createEdge(canvasId.value, sourceNodeId, targetNodeId)
    edges.value.push(e)
    return e
  }

  // BFS 检测 from 是否能沿边到达 to
  function hasPath(from: string, to: string): boolean {
    const visited = new Set<string>()
    const queue = [from]
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (cur === to) return true
      if (visited.has(cur)) continue
      visited.add(cur)
      for (const e of edges.value) {
        if (e.source_node_id === cur && !visited.has(e.target_node_id)) {
          queue.push(e.target_node_id)
        }
      }
    }
    return false
  }

  async function removeEdge(edgeId: string) {
    if (!canvasId.value) return
    await deleteEdge(canvasId.value, edgeId)
    edges.value = edges.value.filter(e => e.id !== edgeId)
  }

  function removeNodeEdges(nodeId: string) {
    edges.value = edges.value.filter(
      e => e.source_node_id !== nodeId && e.target_node_id !== nodeId
    )
  }

  return {
    edges,
    canvasId,
    loadEdges,
    addEdge,
    removeEdge,
    removeNodeEdges,
  }
}

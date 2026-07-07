import type { Canvas, Node, Edge, Asset } from '../types'

const BASE = '/api'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const msg = typeof body.error === 'string' ? body.error : (body.error?.message || body.error?.msg || res.statusText)
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// Canvas
export function fetchCanvases() {
  return req<Canvas[]>(`${BASE}/canvases`)
}

export function createCanvas(name: string) {
  return req<Canvas>(`${BASE}/canvases`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function fetchCanvas(id: string) {
  return req<Canvas>(`${BASE}/canvases/${id}`)
}

export function updateCanvas(id: string, name: string) {
  return req<Canvas>(`${BASE}/canvases/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

// Nodes
export function createNode(canvasId: string, data: Partial<Node>) {
  return req<Node>(`${BASE}/canvases/${canvasId}/nodes`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateNode(canvasId: string, id: string, data: Partial<Node>) {
  return req<Node>(`${BASE}/canvases/${canvasId}/nodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteNode(canvasId: string, id: string) {
  return req<void>(`${BASE}/canvases/${canvasId}/nodes/${id}`, {
    method: 'DELETE',
  })
}

// Edges
export function fetchEdges(canvasId: string) {
  return req<Edge[]>(`${BASE}/canvases/${canvasId}/edges`)
}

export function createEdge(canvasId: string, sourceNodeId: string, targetNodeId: string) {
  return req<Edge>(`${BASE}/canvases/${canvasId}/edges`, {
    method: 'POST',
    body: JSON.stringify({ source_node_id: sourceNodeId, target_node_id: targetNodeId }),
  })
}

export function deleteEdge(canvasId: string, edgeId: string) {
  return req<void>(`${BASE}/canvases/${canvasId}/edges/${edgeId}`, {
    method: 'DELETE',
  })
}

// Assets (personal asset library)
export function fetchAssets() {
  return req<any>(`/api/admin/assets?page_size=10000`).then(r => r.items || r)
}

// Node configs
export function fetchNodeConfigs() {
  return req<any[]>(`/api/admin/node-configs`)
}

export function uploadAsset(file: File): Promise<Asset> {
  const fd = new FormData()
  fd.append('file', file)
  return fetch('/api/admin/assets/upload', { method: 'POST', body: fd }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || r.statusText)
    }
    return r.json()
  })
}

export function updateAsset(id: string, data: { category?: string; tags?: string }) {
  return req<void>(`/api/admin/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteAsset(id: string) {
  return req<void>(`/api/admin/assets/${id}`, { method: 'DELETE' })
}

// LLM
export function chatWithLLM(model: string, messages: { role: string; content: any }[], modelConfig?: { channel?: string; base_url?: string; api_key?: string; parameters?: Record<string, any> } | null) {
  const body: Record<string, any> = { model, messages }
  if (modelConfig) {
    if (modelConfig.channel) body.channel = modelConfig.channel
    if (modelConfig.base_url) body.base_url = modelConfig.base_url
    if (modelConfig.api_key) body.api_key = modelConfig.api_key
    if (modelConfig.parameters) body.parameters = modelConfig.parameters
  }
  return req<any>(`${BASE}/llm/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function* chatWithLLMStream(model: string, messages: { role: string; content: any }[], modelConfig?: { channel?: string; base_url?: string; api_key?: string; parameters?: Record<string, any> } | null) {
  const body: Record<string, any> = { model, messages, stream: true }
  if (modelConfig) {
    if (modelConfig.channel) body.channel = modelConfig.channel
    if (modelConfig.base_url) body.base_url = modelConfig.base_url
    if (modelConfig.api_key) body.api_key = modelConfig.api_key
    if (modelConfig.parameters) body.parameters = modelConfig.parameters
  }
  const res = await fetch(`${BASE}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    const msg = typeof body.error === 'string' ? body.error : (body.error?.message || body.error?.msg || res.statusText)
    throw new Error(msg)
  }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch { /* skip unparseable chunks */ }
      }
    }
  }
}

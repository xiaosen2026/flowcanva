import type { Canvas, NodeConfig, LogEntry, Asset, AssetListResponse } from '../types'

const BASE = '/api/admin'
const API = '/api'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// Node configs
export function fetchNodeConfigs() {
  return req<NodeConfig[]>(`${BASE}/node-configs`)
}

export function fetchNodeConfig(nodeType: string) {
  return req<NodeConfig>(`${BASE}/node-configs/${nodeType}`)
}

export function updateNodeConfig(nodeType: string, data: Partial<NodeConfig>) {
  return req<NodeConfig>(`${BASE}/node-configs/${nodeType}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Logs
export function fetchLogs(params?: { level?: string; module?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams()
  if (params?.level) search.set('level', params.level)
  if (params?.module) search.set('module', params.module)
  if (params?.limit) search.set('limit', String(params.limit))
  if (params?.offset) search.set('offset', String(params.offset))
  const qs = search.toString()
  return req<LogEntry[]>(`${BASE}/logs${qs ? '?' + qs : ''}`)
}

// Assets
export function fetchAssets(params?: { page?: number; page_size?: number; category?: string }) {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.page_size) search.set('page_size', String(params.page_size))
  if (params?.category) search.set('category', params.category)
  const qs = search.toString()
  return req<AssetListResponse>(`${BASE}/assets${qs ? '?' + qs : ''}`)
}

export function uploadAsset(file: File) {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE}/assets/upload`, { method: 'POST', body: form }).then(r => r.json())
}

export function deleteAsset(id: string) {
  return req<void>(`${BASE}/assets/${id}`, { method: 'DELETE' })
}

export function updateAsset(id: string, data: { category?: string; tags?: string }) {
  return req<void>(`${BASE}/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Canvases
export function fetchCanvases(params?: { page?: number; page_size?: number; project_type?: string }) {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.page_size) search.set('page_size', String(params.page_size))
  if (params?.project_type) search.set('project_type', params.project_type)
  const qs = search.toString()
  return req<{ items: Canvas[]; total: number; page: number; page_size: number }>(`${API}/canvases${qs ? '?' + qs : ''}`)
}

export function createCanvas(name: string, projectType: string = 'canvas') {
  return req<Canvas>(`${API}/canvases`, {
    method: 'POST',
    body: JSON.stringify({ name, project_type: projectType }),
  })
}

export function deleteCanvas(id: string) {
  return req<void>(`${API}/canvases/${id}`, { method: 'DELETE' })
}

export function renameCanvas(id: string, name: string) {
  return req<Canvas>(`${API}/canvases/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

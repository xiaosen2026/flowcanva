import { ref } from 'vue'
import type { Asset } from '../types'
import { fetchAssets, uploadAsset, updateAsset, deleteAsset } from '../api'

export const ASSET_CATEGORIES = ['全部', '人物', '场景', '物品', '视频', '音频', '风格', '其他'] as const
export type AssetCategory = typeof ASSET_CATEGORIES[number]

const assets = ref<Asset[]>([])
const loaded = ref(false)
let nameCounter = 0

async function loadAssets() {
  if (loaded.value) return
  try {
    assets.value = await fetchAssets()
    // 从已有资产数量初始化计数器
    nameCounter = assets.value.length
    loaded.value = true
  } catch (e) {
    console.error('load assets failed', e)
  }
}

async function addAsset(file: File): Promise<Asset | null> {
  try {
    nameCounter++
    const ext = file.name.split('.').pop() || 'png'
    const newName = `资产${nameCounter}.${ext}`
    const renamed = new File([file], newName, { type: file.type || 'image/png' })
    const a = await uploadAsset(renamed)
    assets.value.unshift(a)
    return a
  } catch (e) {
    console.error('upload asset failed', e)
    return null
  }
}

async function setCategory(id: string, category: string) {
  await updateAsset(id, { category })
  const a = assets.value.find(x => x.id === id)
  if (a) a.category = category
}

async function removeAsset(id: string) {
  await deleteAsset(id)
  assets.value = assets.value.filter(x => x.id !== id)
}

export function useAssets() {
  return { ASSET_CATEGORIES, assets, loadAssets, addAsset, setCategory, removeAsset }
}

import { ref, watch, nextTick, type Ref } from 'vue'
import { marked } from 'marked'
import { useAssets } from './useAssets'
import { useNodeConfigs } from './useNodeConfigs'
import { chatWithLLMStream } from '../api'

interface UploadImage {
  id: number
  name: string
  dataUrl: string
}

interface ConnectedInput {
  edgeId: string
  sourceNodeId: string
  sourceNodeType: string
  data: any
}

const DEFAULT_MODELS = ['GPT-4', 'Claude 3', 'Gemini']

export function useNodeEditor(
  getNode: () => { content: string; node_type?: string } | null,
  onSave: (content: string) => void,
  placeholder: string = '输入文本内容...',
  nodeInputs?: () => ConnectedInput[],
) {
  const { addAsset } = useAssets()
  const { getModels, getModelConfig, getRoles } = useNodeConfigs()

  const activeTab = ref<'text' | 'llm'>('text')
  const content = ref('')
  const contentPlain = ref('')
  const outputHtml = ref('')
  const loading = ref(false)
  const selectedModel = ref('GPT-4')
  const modalOpen = ref(false)

  const models = ref<string[]>([...DEFAULT_MODELS])

  const sendMode = ref<'replace' | 'append'>('replace')

  type OutputType = { key: string; label: string; prompt: string }
  const outputTypes = ref<OutputType[]>([
    { key: 'text', label: '文本', prompt: '' },
  ])
  const selectedType = ref('text')

  const images = ref<UploadImage[]>([])
  let imageCounter = 0

  const previewImg = ref<UploadImage | null>(null)
  const editableRef = ref<HTMLDivElement | null>(null)
  const modalEditableRef = ref<HTMLDivElement | null>(null)
  const showMention = ref(false)
  const mentionFilter = ref('')
  const mentionAnchor = ref<'inline' | 'modal'>('inline')

  watch(getNode, (n) => {
    if (n) {
      content.value = n.content || ''
      contentPlain.value = n.content || ''
      modalOpen.value = false
      activeTab.value = 'text'
      images.value = []
      imageCounter = 0
      outputHtml.value = ''
      const typeModels = getModels(n.node_type || 'text')
      models.value = typeModels.length > 0 ? typeModels : DEFAULT_MODELS
      if (!models.value.includes(selectedModel.value)) {
        selectedModel.value = models.value[0] || DEFAULT_MODELS[0]
      }
      const roles = getRoles(n.node_type || 'text')
      outputTypes.value = roles.length > 0 ? roles : [{ key: 'text', label: '文本', prompt: '' }]
      if (!outputTypes.value.find(r => r.key === selectedType.value)) {
        selectedType.value = outputTypes.value[0]?.key || 'text'
      }
      nextTick(() => {
        // 如果有 --- 分隔符，仅显示提示词部分到编辑器
        const sepIdx = (n.content || '').indexOf('\n\n---\n\n')
        const promptText = sepIdx < 0 ? (n.content || '') : (n.content || '').slice(0, sepIdx)
        if (editableRef.value) editableRef.value.textContent = promptText
        if (modalEditableRef.value) modalEditableRef.value.textContent = promptText
        updateTextPreview()
      })
    }
  }, { immediate: true })

  function renderMarkdown(text: string): string {
    if (!text) return '<p class="text-white/30">暂无内容</p>'
    return marked(text) as string
  }

  function updateTextPreview() {
    const div = document.createElement('div')
    div.innerHTML = content.value
    contentPlain.value = (div.innerText || '').trim()
    if (activeTab.value === 'text') {
      outputHtml.value = renderMarkdown(contentPlain.value)
    }
  }

  function onAddImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.onchange = () => {
      const files = input.files
      if (!files) return
      for (const file of files) {
        imageCounter++
        const name = `图片${imageCounter}`
        const reader = new FileReader()
        reader.onload = () => {
          images.value.push({ id: imageCounter, name, dataUrl: reader.result as string })
        }
        reader.readAsDataURL(file)
        addAsset(file)
      }
    }
    input.click()
  }

  function removeImage(img: UploadImage) {
    images.value = images.value.filter(i => i.id !== img.id)
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function syncContent(anchor: 'inline' | 'modal') {
    const el = anchor === 'inline' ? editableRef.value : modalEditableRef.value
    if (el) content.value = el.innerHTML
  }

  function onEditableInput(anchor: 'inline' | 'modal') {
    syncContent(anchor)
    updateTextPreview()
    onTextInput(anchor)
    if (activeTab.value === 'text') {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        onSave(contentPlain.value)
      }, 300)
    }
  }

  function onTextInput(anchor: 'inline' | 'modal') {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) { showMention.value = false; return }
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) { showMention.value = false; return }
    const text = node.textContent || ''
    const cursorPos = range.startOffset
    const beforeCursor = text.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@([^\s@]*)$/)
    if (atMatch) {
      mentionFilter.value = atMatch[1]
      showMention.value = true
      mentionAnchor.value = anchor
    } else {
      showMention.value = false
    }
  }

  function insertMention(img: { id: any; name: string; src: string }) {
    const el = mentionAnchor.value === 'inline' ? editableRef.value : modalEditableRef.value
    if (!el) return
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== Node.TEXT_NODE) return

    const text = node.textContent || ''
    const cursorPos = range.startOffset
    const beforeCursor = text.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@([^\s@]*)$/)
    if (!atMatch) return

    const atIdx = beforeCursor.length - atMatch[0].length
    range.setStart(node, atIdx)
    range.setEnd(node, cursorPos)
    range.deleteContents()

    const chip = document.createElement('span')
    chip.className = 'inline-flex items-center gap-0.5 align-middle'
    chip.contentEditable = 'false'
    chip.innerHTML = `<img src="${img.src}" class="inline w-4 h-4 rounded object-cover" /><span class="text-blue-400">@${img.name}</span>`
    chip.setAttribute('data-mention', img.name)

    const space = document.createTextNode(' ')
    range.insertNode(space)
    range.insertNode(chip)

    sel.removeAllRanges()
    range.setStartAfter(space)
    range.collapse(true)
    sel.addRange(range)

    showMention.value = false
    syncContent(mentionAnchor.value)
    updateTextPreview()

    // 确保图片在 images.value 中，用于多模态提交
    const exists = images.value.some(i => i.id === img.id || i.dataUrl === img.src)
    if (!exists) {
      if (img.src.startsWith('data:')) {
        images.value.push({ id: images.value.length + 1, name: img.name, dataUrl: img.src })
      } else {
        // URL 类型：fetch 转 base64
        imageCounter++
        const placeholder = { id: imageCounter, name: img.name, dataUrl: img.src }
        images.value.push(placeholder)
        const fullUrl = img.src.startsWith('http') ? img.src : `${window.location.origin}${img.src}`
        fetch(fullUrl)
          .then(r => r.blob())
          .then(blob => new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          }))
          .then(dataUrl => {
            placeholder.dataUrl = dataUrl
          })
          .catch(() => {})
      }
    }
  }

  function switchTab(tab: 'text' | 'llm') {
    activeTab.value = tab
    if (tab === 'text') {
      updateTextPreview()
    }
  }

  async function onSend() {
    if (activeTab.value !== 'llm' || !contentPlain.value) return

    loading.value = true
    const prevContent = sendMode.value === 'append' ? (getNode()?.content || '') : ''
    let fullText = ''
    const messages: { role: string; content: string | any[] }[] = []
    const typeInfo = outputTypes.value.find(t => t.key === selectedType.value)
    if (typeInfo?.prompt) {
      messages.push({ role: 'system', content: typeInfo.prompt })
    }

    const nodeType = getNode()?.node_type || 'text'
    const modelConfig = getModelConfig(nodeType, selectedModel.value)
    const supportsVision = modelConfig?.parameters?.supports_vision === true

    // 构造用户消息
    const userTextParts: string[] = [contentPlain.value]
    const inputs = nodeInputs?.() ?? []
    for (const inp of inputs) {
      if (inp.sourceNodeType === 'text' && inp.data && typeof inp.data === 'string') {
        userTextParts.unshift(`[上游节点输出]\n${inp.data}`)
      }
    }
    const userText = userTextParts.join('\n\n')

    if (supportsVision && images.value.length > 0) {
      const userContent: any[] = [{ type: 'text', text: userText }]
      for (const img of images.value) {
        userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } })
      }
      messages.push({ role: 'user', content: userContent })
    } else {
      messages.push({ role: 'user', content: userText })
    }

    try {
      for await (const chunk of chatWithLLMStream(selectedModel.value, messages, modelConfig)) {
        fullText += chunk
      }
      if (fullText) {
        const prefix = sendMode.value === 'replace' ? contentPlain.value : (prevContent || '')
        onSave(prefix + '\n\n---\n\n' + fullText)
      } else {
        onSave(contentPlain.value || prevContent || '无响应')
      }
    } catch (e: any) {
      onSave(prevContent || `**错误:** ${e.message}`)
    } finally {
      loading.value = false
    }
  }

  return {
    activeTab, content, contentPlain, outputHtml, loading, selectedModel, modalOpen, models,
    outputTypes, selectedType, sendMode,
    images, previewImg, editableRef, modalEditableRef,
    showMention, mentionFilter, placeholder,
    onAddImage, removeImage, onEditableInput, insertMention,
    switchTab, onSend,
  }
}

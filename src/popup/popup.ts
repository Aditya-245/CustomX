interface StateMsg {
  origin: string
  enabled: boolean
  editMode: boolean
  darkMode: boolean
  dragAnywhere: boolean
  rules: Array<{ id: string; action: string; selector: string }>
  shortcuts: Array<{ id: string; name: string }>
  clones: Array<{ id: string; name: string }>
}

const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null

let tabId: number | null = null
let darkBtn: HTMLButtonElement | null = null
let dragBtn: HTMLButtonElement | null = null

async function send<T = unknown>(message: Record<string, unknown>): Promise<T | null> {
  if (tabId == null) return null
  try {
    return ((await chrome.tabs.sendMessage(tabId, message)) as T) ?? null
  } catch {
    return null
  }
}

async function refresh(): Promise<void> {
  const state = await send<StateMsg>({ type: 'CUSTOMX_GET_STATE' })
  const originEl = $('origin')
  if (originEl) originEl.textContent = state ? state.origin : 'CustomX is not available on this page.'
  if (darkBtn) darkBtn.textContent = `Dark mode: ${state?.darkMode ? 'On' : 'Off'}`
  if (dragBtn) dragBtn.textContent = `Drag anywhere: ${state?.dragAnywhere ? 'On' : 'Off'}`
}

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  tabId = tab?.id ?? null

  // Fallback origin display when no content script (e.g. unloaded tab).
  const originEl = $('origin')
  if (originEl && tab?.url && !tab.url.startsWith('chrome')) {
    try {
      originEl.textContent = new URL(tab.url).origin
    } catch {
      /* ignore */
    }
  }

  const main = document.querySelector('main')
  if (!main) return
  main.replaceChildren()

  const recordBtn = document.createElement('button')
  recordBtn.textContent = 'Record session'
  recordBtn.className = 'primary'
  recordBtn.addEventListener('click', async () => {
    await send({ type: 'CUSTOMX_START_RECORDING' })
    window.close()
  })

  darkBtn = document.createElement('button')
  darkBtn.textContent = 'Dark mode: …'
  darkBtn.addEventListener('click', async () => {
    const state = await send<StateMsg>({ type: 'CUSTOMX_GET_STATE' })
    const next = !state?.darkMode
    await send({ type: 'CUSTOMX_SET_DARK', enabled: next })
    if (darkBtn) darkBtn.textContent = `Dark mode: ${next ? 'On' : 'Off'}`
  })

  dragBtn = document.createElement('button')
  dragBtn.textContent = 'Drag anywhere: …'
  dragBtn.addEventListener('click', async () => {
    const state = await send<StateMsg>({ type: 'CUSTOMX_GET_STATE' })
    const next = !state?.dragAnywhere
    await send({ type: 'CUSTOMX_SET_DRAG', enabled: next })
    if (dragBtn) dragBtn.textContent = `Drag anywhere: ${next ? 'On' : 'Off'}`
  })

  const editBtn = document.createElement('button')
  editBtn.textContent = 'Edit layout'
  editBtn.addEventListener('click', async () => {
    await send({ type: 'CUSTOMX_TOGGLE_EDIT' })
    setTimeout(() => window.close(), 150)
  })

  main.append(recordBtn, darkBtn, dragBtn, editBtn)
  void refresh()
}

void init()

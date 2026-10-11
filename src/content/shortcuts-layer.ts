import { getPendingClone, getSiteConfig, saveSiteConfig, setPendingClone } from '../shared/storage'
import type { Clone, Position } from '../shared/types'
import { setDarkMode } from './dark-mode'
import { runReplay } from './replay'
import { startRecording } from './recorder'
import { waitForSelector } from './selectors'
import { h, mountRoot } from './ui'

/** CustomX mark: two sliders (customization) rendered in the current accent colour. */
const LOGO_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
     stroke-linecap="round" aria-hidden="true">
  <line x1="4" y1="7.5" x2="20" y2="7.5" />
  <circle cx="9" cy="7.5" r="2.4" fill="#1e1e2e" />
  <line x1="4" y1="16.5" x2="20" y2="16.5" />
  <circle cx="15" cy="16.5" r="2.4" fill="#1e1e2e" />
</svg>`

/**
 * Widget = a small draggable ⚡ handle pinned to the page. The shortcuts panel
 * is hidden until the user double-clicks the handle; it closes on outside
 * click or Escape. Each shortcut/clone row has a ✕ remove button.
 */
export async function renderShortcutsLayer(): Promise<void> {
  document.querySelector('.customx-shortcuts-layer')?.remove()
  const config = await getSiteConfig(location.origin)
  if (!config.enabled) return

  const root = mountRoot('customx-shortcuts-layer')
  let shortcuts = config.shortcuts
  let clones = config.clones
  let darkOn = Boolean(config.uiStyle?.darkMode)

  // Search state
  let searchQuery = ''

  // ── Handle ────────────────────────────────────────────────────────────────
  const handle = h('div', { class: 'customx-handle', title: 'Double-click to open CustomX' })
  handle.innerHTML = LOGO_SVG
  root.append(handle)

  const pos: Position =
    config.widgetPos ?? { left: window.innerWidth - 60, top: Math.round(window.innerHeight * 0.7) }
  Object.assign(handle.style, {
    left: `${Math.max(8, Math.min(pos.left, window.innerWidth - 60))}px`,
    top: `${Math.max(8, Math.min(pos.top, window.innerHeight - 60))}px`,
    position: 'fixed'
  })

  let panel: HTMLElement | null = null

  function closePanel(): void {
    panel?.remove()
    panel = null
    document.removeEventListener('click', onOutsideClick, true)
    document.removeEventListener('keydown', onPanelKeydown, true)
  }

  function onOutsideClick(e: MouseEvent): void {
    if (!panel) return
    const path = e.composedPath() as EventTarget[]
    if (path.includes(panel) || path.includes(handle)) return
    closePanel()
  }

  function onPanelKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      closePanel()
    }
  }

  function openPanel(): void {
    if (panel) return // toggle off handled by dblclick
    panel = h('div', { class: 'customx-layer' })
    const body = h('div', {})

    // Search input
    const searchInput = h('input', {
      class: 'new-sc',
      placeholder: 'Search shortcuts and clones...',
      value: searchQuery
    })
    searchInput.addEventListener('input', () => {
      searchQuery = (searchInput as HTMLInputElement).value
      renderBody()
    })

    function renderBody(): void {
      body.replaceChildren()
      // Add search input at top
      body.append(searchInput)
      
      // Filter shortcuts and clones
      const filteredShortcuts = shortcuts.filter(sc => 
        sc.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      const filteredClones = clones.filter(clone => 
        clone.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        clone.url.toLowerCase().includes(searchQuery.toLowerCase())
      )

      for (const sc of filteredShortcuts) {
        body.append(row('▶ ' + sc.name, sc.name, async () => {
          await runReplay(sc.steps)
        }, () => removeShortcut(sc.id)))
      }
      for (const clone of filteredClones) {
        body.append(row('⧉ ' + clone.name, `${clone.name} — ${clone.url}`, async () => {
          await activateClone(clone)
        }, () => removeClone(clone.id)))
      }
      if (filteredShortcuts.length === 0 && filteredClones.length === 0) {
        body.append(h('div', { class: 'customx-empty-note' }, 'No results found'))
      }
      const newBtn = h('button', { class: 'new-sc' }, '+ Record new shortcut')
      newBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        void startRecording()
        closePanel()
      })
      body.append(newBtn)

      const darkBtn = h('button', { class: 'new-sc' }, `Dark mode: ${darkOn ? 'On' : 'Off'}`)
      darkBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        darkOn = !darkOn
        void setDarkMode(darkOn)
        darkBtn.textContent = `Dark mode: ${darkOn ? 'On' : 'Off'}`
      })
      body.append(darkBtn)
    }
    renderBody()
    panel.append(h('div', { class: 'header' }, h('span', {}, 'SHORTCUTS')), body)
    Object.assign(panel.style, {
      position: 'fixed',
      left: `${Math.max(8, parseFloat(handle.style.left) - 210)}px`,
      top: `${Math.max(8, parseFloat(handle.style.top) - estimateHeight(shortcuts.length, clones.length))}px`
    })
    root.append(panel)
    document.addEventListener('click', onOutsideClick, true)
    document.addEventListener('keydown', onPanelKeydown, true)
  }

  handle.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (panel) closePanel()
    else openPanel()
  })

  // Drag the handle to reposition.
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    const rect = handle.getBoundingClientRect()
    const offX = e.clientX - rect.left
    const offY = e.clientY - rect.top
    let moved = false
    const onMove = (ev: PointerEvent): void => {
      moved = true
      handle.style.left = `${Math.max(0, ev.clientX - offX)}px`
      handle.style.top = `${Math.max(0, ev.clientY - offY)}px`
    }
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      if (moved) void persistPos()
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  })

  function estimateHeight(sc: number, cl: number): number {
    return Math.min(360, 46 + (sc + cl) * 38 + 50)
  }

  async function persistPos(): Promise<void> {
    const fresh = await getSiteConfig(location.origin)
    fresh.widgetPos = {
      left: parseInt(handle.style.left, 10),
      top: parseInt(handle.style.top, 10)
    }
    await saveSiteConfig(fresh)
  }

  async function removeShortcut(id: string): Promise<void> {
    const fresh = await getSiteConfig(location.origin)
    fresh.shortcuts = fresh.shortcuts.filter((s) => s.id !== id)
    await saveSiteConfig(fresh)
  }

  async function removeClone(id: string): Promise<void> {
    const fresh = await getSiteConfig(location.origin)
    fresh.clones = fresh.clones.filter((c) => c.id !== id)
    await saveSiteConfig(fresh)
  }

  chrome.storage.onChanged.addListener(async (_c, area) => {
    if (area !== 'sync') return
    const fresh = await getSiteConfig(location.origin)
    shortcuts = fresh.shortcuts
    clones = fresh.clones
    if (panel) {
      closePanel()
      openPanel()
    }
  })
}

function row(
  label: string,
  title: string,
  run: () => Promise<void>,
  remove: () => Promise<void>
): HTMLElement {
  const nameBtn = h('button', { class: 'sc' }, label)
  nameBtn.title = title
  nameBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    void run().then(() => {})
  })
  const del = h('button', { class: 'del', title: 'Remove' }, '✕')
  del.addEventListener('click', (e) => {
    e.stopPropagation()
    void remove()
  })
  return h('div', { class: 'customx-row' }, nameBtn, del)
}

/**
 * Clone activation: navigate to the source page and click the element there;
 * resumed by resumePendingClone() after navigation completes.
 */
export async function activateClone(clone: Pick<Clone, 'url' | 'selector'>): Promise<void> {
  const samePage = clone.url === location.href
  if (samePage) return fireCloneTarget(clone.selector)
  await setPendingClone({ url: clone.url, selector: clone.selector })
  location.href = clone.url
}

/** Called from boot after navigation: find the cloned element, flash it, click it. */
export async function resumePendingClone(): Promise<boolean> {
  const pending = await getPendingClone()
  if (!pending) return false
  if (pending.url !== location.href) return false
  await waitForSelector(pending.selector, 15000)
  await setPendingClone(null)
  await fireCloneTarget(pending.selector)
  return true
}

async function fireCloneTarget(selector: string): Promise<void> {
  const el = await waitForSelector(selector, 15000)
  if (!(el instanceof HTMLElement)) {
    toast('CustomX: cloned element not found.')
    return
  }
  el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  el.style.setProperty('outline', '3px solid #6c5ce7', 'important')
  el.style.setProperty('outline-offset', '2px', 'important')
  setTimeout(() => {
    el.style.removeProperty('outline')
    el.style.removeProperty('outline-offset')
  }, 900)
  await new Promise((r) => setTimeout(r, 500))
  const opts: MouseEventInit = { bubbles: true, cancelable: true, view: window }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, opts))
  }
}

function toast(message: string): void {
  const t = mountRoot('customx-layer customx-toast')
  t.style.cssText += 'left:50%;top:16px;transform:translateX(-50%);padding:10px 14px;'
  t.textContent = message
  setTimeout(() => t.remove(), 4000)
}

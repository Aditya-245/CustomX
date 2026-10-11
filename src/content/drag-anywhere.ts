import { getSiteConfig, saveSiteConfig } from '../shared/storage'
import { isPicking } from './edit-mode'
import { beginDrag, toast } from './move'
import { isRecordingActive } from './recorder'
import { RuleEngine } from './rules'
import { h, mountRoot } from './ui'

let active = false

export function isDragAnywhereEnabled(): boolean {
  return active
}

/** Restores all moved elements, regardless of whether drag-anywhere is on. */
export async function resetAllMoves(): Promise<void> {
  const count = await RuleEngine.resetAllMoves()
  toast(count > 0 ? `CustomX: reset ${count} element${count === 1 ? '' : 's'} to their original position.` : 'CustomX: nothing moved.')
}

function showBadge(): void {
  if (document.querySelector('.customx-drag-badge')) return
  const badge = mountRoot('customx-drag-badge')
  const label = h('span', { class: 'label' }, 'Drag anywhere: ON')
  const reset = h('button', { class: 'reset-moves', title: 'Restore every moved element to its original position' }, 'Reset all')
  reset.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void resetAllMoves()
  })
  badge.append(label, reset)
}

function hideBadge(): void {
  document.querySelector('.customx-drag-badge')?.remove()
}

/** Attaches/detaches the global drag handler and cursor affordance. */
export function applyDragAnywhere(enabled: boolean): void {
  if (enabled === active) return
  active = enabled
  document.documentElement.classList.toggle('customx-drag-anywhere', enabled)
  if (enabled) {
    document.addEventListener('pointerdown', onPointerDown, true)
    showBadge()
  } else {
    document.removeEventListener('pointerdown', onPointerDown, true)
    hideBadge()
  }
}

function onPointerDown(e: PointerEvent): void {
  if (!active || e.button !== 0) return
  if (isPicking() || isRecordingActive()) return
  const target = e.target instanceof Element ? e.target : null
  if (!target || target.closest('[data-customx-root]')) return
  const el = target as HTMLElement
  // Never drag the page container itself.
  if (el === document.body || el === document.documentElement) return
  beginDrag(el, e)
}

/** Applies the site's saved preference on load. */
export async function initDragAnywhere(): Promise<void> {
  const config = await getSiteConfig(location.origin)
  applyDragAnywhere(Boolean(config.uiStyle?.dragAnywhere))
}

/** Toggles drag-anywhere for this site, persists the choice, applies it live. */
export async function setDragAnywhere(enabled: boolean): Promise<boolean> {
  const config = await getSiteConfig(location.origin)
  config.uiStyle = { ...config.uiStyle, dragAnywhere: enabled }
  await saveSiteConfig(config)
  applyDragAnywhere(enabled)
  toast(enabled ? 'CustomX: drag anywhere enabled.' : 'CustomX: drag anywhere disabled.')
  return enabled
}

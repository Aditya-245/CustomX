import { RuleEngine, pinAt } from './rules'
import { getSelectorInfo } from './selectors'
import { mountRoot } from './ui'

export interface DragHooks {
  /** Fired after a successful drop + persist. */
  onDone?: () => void
  /** Fired when the drag is cancelled with Escape. */
  onCancel?: () => void
}

/** Small transient status pill, shown at the top of the page. */
export function toast(message: string): void {
  const t = mountRoot('customx-toast')
  t.textContent = message
  setTimeout(() => t.remove(), 3000)
}

/**
 * Pins `el` and lets the user reposition it anywhere on the page, persisting the
 * result as a `move` rule.
 *
 * - `beginDrag(el)` — modal: the user grabs the element with a pointer press.
 * - `beginDrag(el, pointerEvent)` — starts dragging immediately from that event.
 *
 * Grab offset is preserved so the element doesn't jump. **Ctrl** snaps to an 8px
 * grid, arrow keys nudge (Shift = 10px), Enter/release drops, Escape cancels.
 */
export function beginDrag(el: HTMLElement, start?: PointerEvent, hooks: DragHooks = {}): void {
  const rect = el.getBoundingClientRect()
  let docX = rect.left + window.scrollX
  let docY = rect.top + window.scrollY
  let grabX = rect.width / 2
  let grabY = rect.height / 2
  let dragging = false
  let finished = false

  const original = {
    position: el.style.getPropertyValue('position'),
    left: el.style.getPropertyValue('left'),
    top: el.style.getPropertyValue('top'),
    zIndex: el.style.getPropertyValue('z-index')
  }

  pinAt(el, docX, docY)
  el.classList.add('customx-moving')

  const hint = start ? null : mountRoot('customx-move-hint customx-layer')
  if (hint) hint.textContent = 'Drag to move · Ctrl snap · Arrows nudge · Enter drop · Esc cancel'

  const apply = (x: number, y: number): void => {
    docX = x
    docY = y
    pinAt(el, docX, docY)
  }

  const cleanup = (): void => {
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('pointerup', onUp, true)
    document.removeEventListener('keydown', onKey, true)
    hint?.remove()
    el.classList.remove('customx-moving')
  }

  const restore = (): void => {
    if (original.position) el.style.setProperty('position', original.position)
    else el.style.removeProperty('position')
    if (original.left) el.style.setProperty('left', original.left)
    else el.style.removeProperty('left')
    if (original.top) el.style.setProperty('top', original.top)
    else el.style.removeProperty('top')
    if (original.zIndex) el.style.setProperty('z-index', original.zIndex)
    else el.style.removeProperty('z-index')
  }

  const grab = (e: PointerEvent): void => {
    const r = el.getBoundingClientRect()
    grabX = e.clientX - r.left
    grabY = e.clientY - r.top
    dragging = true
  }

  async function commit(): Promise<void> {
    if (finished) return
    finished = true
    const { css } = getSelectorInfo(el)
    if (!css) {
      cleanup()
      restore()
      toast('CustomX: could not generate a stable selector for this element.')
      return
    }
    cleanup()
    await RuleEngine.addOrUpdate({
      id: RuleEngine.newId(),
      selector: css,
      action: 'move',
      position: { left: docX, top: docY },
      createdAt: Date.now()
    })
    toast('CustomX: element moved.')
    hooks.onDone?.()
  }

  function onDown(e: PointerEvent): void {
    if ((e.target as Element | null)?.closest?.('[data-customx-root]')) return
    grab(e)
    e.preventDefault()
    e.stopImmediatePropagation()
  }

  function onMove(e: PointerEvent): void {
    if (!dragging) return
    let x = e.clientX + window.scrollX - grabX
    let y = e.clientY + window.scrollY - grabY
    if (e.ctrlKey) {
      x = Math.round(x / 8) * 8
      y = Math.round(y / 8) * 8
    }
    apply(x, y)
  }

  function onUp(e: PointerEvent): void {
    if (!dragging) return
    dragging = false
    e.preventDefault()
    e.stopImmediatePropagation()
    void commit()
  }

  function onKey(e: KeyboardEvent): void {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'Escape') {
      finished = true
      cleanup()
      restore()
      toast('CustomX: move cancelled.')
      hooks.onCancel?.()
    } else if (e.key === 'Enter') {
      void commit()
    } else if (e.key === 'ArrowUp') {
      apply(docX, docY - step)
    } else if (e.key === 'ArrowDown') {
      apply(docX, docY + step)
    } else if (e.key === 'ArrowLeft') {
      apply(docX - step, docY)
    } else if (e.key === 'ArrowRight') {
      apply(docX + step, docY)
    } else {
      return
    }
    e.preventDefault()
    e.stopImmediatePropagation()
  }

  document.addEventListener('pointerdown', onDown, true)
  document.addEventListener('pointermove', onMove, true)
  document.addEventListener('pointerup', onUp, true)
  document.addEventListener('keydown', onKey, true)

  if (start) {
    grab(start)
    start.preventDefault()
    start.stopImmediatePropagation()
  }
}

import { RuleEngine, pinAt } from './rules'
import { getSelectorInfo } from './selectors'
import { h, mountRoot } from './ui'

/**
 * Edit mode: hover highlights elements; clicking selects and shows a toolbar
 * (Move / Hide / Exit). All site interaction is suppressed while active.
 */
export class EditMode {
  private active = false
  private highlight: HTMLElement | null = null
  private toolbar: HTMLElement | null = null
  private selected: HTMLElement | null = null
  private onExit: () => void = () => {}

  toggle(onExit: () => void = () => {}): void {
    this.active ? this.exit() : this.enter(onExit)
  }

  enter(onExit: () => void = () => {}): void {
    if (this.active) return
    this.active = true
    this.onExit = onExit
    document.documentElement.classList.add('customx-editing')
    const layer = mountRoot('customx-edit-layer')
    this.highlight = h('div', { class: 'customx-highlight' })
    this.toolbar = this.buildToolbar()
    layer.append(this.highlight, this.toolbar)

    document.addEventListener('mousemove', this.onMouseMove, true)
    document.addEventListener('click', this.onClick, true)
    document.addEventListener('keydown', this.onKeyDown, true)
  }

  exit(): void {
    if (!this.active) return
    this.active = false
    document.documentElement.classList.remove('customx-editing')
    document.removeEventListener('mousemove', this.onMouseMove, true)
    document.removeEventListener('click', this.onClick, true)
    document.removeEventListener('keydown', this.onKeyDown, true)
    this.layer()?.remove()
    this.highlight = null
    this.toolbar = null
    this.selected = null
    this.onExit()
  }

  isActive(): boolean {
    return this.active
  }

  private layer(): HTMLElement | null {
    return document.querySelector('.customx-edit-layer')
  }

  private buildToolbar(): HTMLElement {
    const moveBtn = h('button', { class: 'primary' }, 'Move')
    const hideBtn = h('button', {}, 'Hide')
    const exitBtn = h('button', {}, 'Exit edit mode')
    const bar = h('div', { class: 'customx-toolbar' }, moveBtn, hideBtn, exitBtn)
    moveBtn.addEventListener('click', (e) => {
      e.stopImmediatePropagation()
      const target = this.selected
      if (target) {
        this.exit()
        void startMove(target)
      }
    })
    hideBtn.addEventListener('click', async (e) => {
      e.stopImmediatePropagation()
      const target = this.selected
      if (!target) return
      const { css, xpath } = getSelectorInfo(target)
      if (!css) {
        alert('CustomX: could not generate a stable selector for this element.')
        return
      }
      await RuleEngine.addOrUpdate({
        id: RuleEngine.newId(),
        selector: css,
        action: 'hide'
      })
      alert(`Rule created!\nCSS Selector: ${css}\nXPath: ${xpath ?? 'N/A'}`)
      this.hideToolbar()
    })
    exitBtn.addEventListener('click', (e) => {
      e.stopImmediatePropagation()
      this.exit()
    })
    return bar
  }

  private hideToolbar(): void {
    if (this.toolbar) this.toolbar.style.display = 'none'
    if (this.highlight) this.highlight.style.display = 'none'
    this.selected = null
  }

  private isOwnEvent(e: Event): boolean {
    return (e.composedPath() as EventTarget[]).some(
      (t) => t instanceof Element && t.closest('[data-customx-root]')
    )
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.highlight || e.target instanceof Element === false) return
    if (this.isOwnEvent(e)) return
    // Don't highlight while a move-drag of a previously selected element runs.
    const target = e.target as Element
    if (target.closest('[data-customx-root]')) return
    const rect = target.getBoundingClientRect()
    Object.assign(this.highlight.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    })
  }

  private onClick = (e: MouseEvent): void => {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (this.isOwnEvent(e)) return
    const target = e.target instanceof Element ? (e.target as HTMLElement) : null
    if (!target) return
    this.selected = target
    if (!this.toolbar || !this.highlight) return
    const rect = target.getBoundingClientRect()
    Object.assign(this.highlight.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    })
    Object.assign(this.toolbar.style, {
      display: 'flex',
      left: `${Math.min(rect.left, window.innerWidth - 240)}px`,
      top: `${Math.max(rect.top - 44, 8)}px`
    })
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      this.exit()
    }
  }
}

/**
 * One-shot element picker used by flows like clone creation: hover to
 * highlight, click to select, Escape to cancel. Resolves with null on cancel.
 */
let picking = false

export function isPicking(): boolean {
  return picking
}

export function pickElement(): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    let settled = false
    picking = true
    const layer = mountRoot('customx-pick-layer')
    const highlight = h('div', { class: 'customx-highlight' })
    layer.append(highlight)
    document.documentElement.classList.add('customx-editing')

    const finish = (result: HTMLElement | null): void => {
      if (settled) return
      settled = true
      picking = false
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.documentElement.classList.remove('customx-editing')
      layer.remove()
      resolve(result)
    }

    function onMouseMove(e: MouseEvent): void {
      if (!(e.target instanceof Element)) return
      const rect = e.target.getBoundingClientRect()
      Object.assign(highlight.style, {
        display: 'block',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      })
    }
    function onClick(e: MouseEvent): void {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!(e.target instanceof HTMLElement)) return
      finish(e.target)
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        finish(null)
      }
    }

    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
  })
}

/** Move flow: element follows the cursor pinned under it; next click drops + persists. */
export function startMove(el: HTMLElement): void {
  const rect = el.getBoundingClientRect()
  let docX = rect.left + window.scrollX
  let docY = rect.top + window.scrollY

  pinAt(el, docX, docY)
  el.classList.add('customx-moving')

  const onMove = (e: MouseEvent): void => {
    docX = e.clientX + window.scrollX
    docY = e.clientY + window.scrollY
    pinAt(el, docX, docY)
  }
  const onDrop = async (e: MouseEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    cleanup()
    el.classList.remove('customx-moving')
    const { css, xpath } = getSelectorInfo(el)
    if (!css) {
      alert('CustomX: could not generate a stable selector for this element.')
      return
    }
    await RuleEngine.addOrUpdate({
      id: RuleEngine.newId(),
      selector: css,
      action: 'move',
      position: { left: docX, top: docY },
      createdAt: Date.now()
    })
    alert(`Move rule created!\nCSS Selector: ${css}\nXPath: ${xpath ?? 'N/A'}`)
  }
  function cleanup(): void {
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('click', onDrop, true)
  }
  setTimeout(() => {
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('click', onDrop, true)
  }, 0)
}

import { getPendingReplay, setPendingReplay } from '../shared/storage'
import type { MacroStep } from '../shared/types'
import { waitForSelector } from './selectors'
import { mountRoot } from './ui'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Replays are resilient to page navigations: progress is checkpointed to
 * storage.local after every step. If a step triggers a full-page load, the
 * content script on the new page resumes the replay from where it left off.
 */
export async function runReplay(steps: MacroStep[]): Promise<boolean> {
  await setPendingReplay({ steps, next: 0 })
  return continueReplay()
}

export async function continueReplay(): Promise<boolean> {
  const pending = await getPendingReplay()
  if (!pending) return false

  const toast = mountRoot('customx-replay-toast customx-layer')
  toast.style.left = '50%'
  toast.style.transform = 'translateX(-50%)'
  toast.textContent = `CustomX: running shortcut… (step ${pending.next + 1}/${pending.steps.length})`

  for (let i = pending.next; i < pending.steps.length; i++) {
    toast.textContent = `CustomX: running shortcut… (step ${i + 1}/${pending.steps.length})`
    const ok = await executeStep(pending.steps[i])
    if (!ok) {
      toast.textContent = 'CustomX: shortcut failed — an element could not be found.'
      setTimeout(() => toast.remove(), 4000)
      await setPendingReplay(null)
      return false
    }
    // Checkpoint before waiting so an imminent navigation doesn't lose progress.
    await setPendingReplay({ steps: pending.steps, next: i + 1 })
    await sleep(350)
  }

  toast.textContent = 'CustomX: shortcut completed ✓'
  setTimeout(() => toast.remove(), 2500)
  await setPendingReplay(null)
  return true
}

async function executeStep(step: MacroStep): Promise<boolean> {
  const selector = step.selector
  const el = selector ? await waitForSelector(selector, 15000) : null
  if (selector && !el) return false

  if (el instanceof HTMLElement) el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  await sleep(120)

  switch (step.kind) {
    case 'click':
      if (!el) return false
      fireClick(el)
      return true
    case 'input': {
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
        // contenteditable fallback: type via input events on the element itself.
        const editable = el as HTMLElement | null
        if (editable?.isContentEditable) {
          editable.focus()
          editable.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, data: step.text, inputType: 'insertText' }))
          editable.textContent = step.text
          editable.dispatchEvent(new InputEvent('input', { bubbles: true, data: step.text, inputType: 'insertText' }))
          return true
        }
        return false
      }
      el.focus()
      setNativeValue(el, step.text)
      return true
    }
    case 'key': {
      const target = (el ?? document.activeElement) as HTMLElement | null
      if (!target) return false
      target.focus()
      fireKey(target, step.key)
      return true
    }
    default:
      return false
  }
}

/**
 * Sets an input's value through the native prototype setter and fires bubbling
 * `input` + `change` events — required for React/Vue controlled inputs, which
 * ignore direct `.value` writes.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, text)
  else el.value = text
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function fireClick(el: Element): void {
  const opts: MouseEventInit = { bubbles: true, cancelable: true, view: window }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, opts))
  }
}

function fireKey(el: HTMLElement, key: string): void {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key
  for (const type of ['keydown', 'keypress', 'keyup']) {
    el.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key, code }))
  }
}

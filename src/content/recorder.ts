import { appendRecordingStep, getRecording, setRecording, getSiteConfig, saveSiteConfig, uid } from '../shared/storage'
import type { MacroStep } from '../shared/types'
import { getStableSelector } from './selectors'
import { isPicking } from './edit-mode'
import { h, mountRoot } from './ui'

const ACTIONABLE = 'button,a,[role="button"],[role="menuitem"],[role="tab"],[role="option"],[role="switch"],input[type="submit"],input[type="checkbox"],label,select'
const EDITABLE = 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="password"],input[type="tel"],input[type="number"],textarea,[contenteditable="true"],[contenteditable=""]'
/** Keys that trigger actions on their own (submit searches, close dialogs…). */
const ACTION_KEYS = new Set(['Enter', 'Escape', 'Tab'])

let captureAttached = false
let inputTimer: number | undefined
let pendingInput: Element | null = null

function isEditable(target: EventTarget | null): target is HTMLElement {
  return target instanceof Element && !!target.closest(EDITABLE)
}

/** True while a recording session is capturing interactions. */
export function isRecordingActive(): boolean {
  return captureAttached
}

/** Called on every page load: if a recording is in progress, resume capturing + show the dot. */
export async function resumeRecording(): Promise<void> {
  const rec = await getRecording()
  if (!rec?.active) return
  attachCapture()
  renderBar(rec.steps.length)
}

export async function startRecording(): Promise<void> {
  await setRecording({ active: true, origin: location.origin, steps: [] })
  attachCapture()
  renderBar(0)
}

/**
 * Click, input and keydown listeners are attached for the entire recording
 * session (across page loads via resumeRecording) and fully detached the
 * moment recording ends — no stray listeners left on the page.
 */
function attachCapture(): void {
  if (captureAttached) return
  captureAttached = true
  document.addEventListener('click', onClickCapture, true)
  document.addEventListener('input', onInputCapture, true)
  document.addEventListener('keydown', onKeyDownCapture, true)
}

function detachCapture(): void {
  if (!captureAttached) return
  captureAttached = false
  clearTimeout(inputTimer)
  pendingInput = null
  document.removeEventListener('click', onClickCapture, true)
  document.removeEventListener('input', onInputCapture, true)
  document.removeEventListener('keydown', onKeyDownCapture, true)
}

function onClickCapture(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null
  if (!target || target.closest('[data-customx-root]')) return
  if (isPicking()) return
  // Clicks on editable fields are recorded as focus, not as actions.
  if (isEditable(e.target)) return
  const actionable = target.closest(ACTIONABLE) ?? target
  const selector = getStableSelector(actionable)
  if (!selector) return
  void record({ kind: 'click', selector })
}

function onInputCapture(e: Event): void {
  const target = e.target instanceof Element ? e.target : null
  if (!target || target.closest('[data-customx-root]') || !isEditable(e.target)) return
  pendingInput = target
  clearTimeout(inputTimer)
  inputTimer = window.setTimeout(() => void flushPendingInput(), 700)
}

function onKeyDownCapture(e: KeyboardEvent): void {
  // Escape cancels an in-progress recording (the bar's Stop button saves it).
  if (e.key === 'Escape') {
    void finish(false)
    return
  }
  const target = e.target instanceof Element ? e.target : null
  if (!target || target.closest('[data-customx-root]') || !isEditable(e.target)) return
  if (!ACTION_KEYS.has(e.key)) return
  // Flush any unrecorded text so the input step lands BEFORE the key step.
  void flushPendingInput().then(() => {
    const selector = getStableSelector(target)
    if (!selector) return
    return record({ kind: 'key', selector, key: e.key })
  })
}

function flushPendingInput(): Promise<void> {
  clearTimeout(inputTimer)
  const target = pendingInput
  pendingInput = null
  if (!target || !document.contains(target)) return Promise.resolve()
  const text = currentValue(target)
  const selector = getStableSelector(target)
  if (!selector) return Promise.resolve()
  return record({ kind: 'input', selector, text })
}

function currentValue(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
  return el.textContent ?? ''
}

/**
 * Steps are persisted one at a time through a serial chain. Without this,
 * two rapid interactions each read-modify-write the same storage record and
 * the later write clobbers the earlier step.
 */
let writeChain: Promise<unknown> = Promise.resolve()

function record(step: MacroStep): Promise<void> {
  writeChain = writeChain.then(async () => {
    const rec = await appendRecordingStep(step)
    if (!rec) return
    const count = document.querySelector('.customx-recorder .count')
    if (count) count.textContent = String(rec.steps.length)
  })
  return writeChain as Promise<void>
}

/** Dark-themed recorder pill: pulsing dot, live step count and a Stop button. */
function renderBar(stepCount: number): void {
  document.querySelector('.customx-rec-layer')?.remove()
  const dot = h('span', { class: 'dot' })
  const count = h('span', { class: 'count' }, String(stepCount))
  const label = h('span', { class: 'label' }, 'Recording')
  const stop = h('button', { class: 'stop', title: 'Stop and save recording' }, 'Stop')
  stop.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void finish(true)
  })
  const bar = h('div', { class: 'customx-recorder', title: 'Recording in progress' }, dot, count, label, stop)
  mountRoot('customx-rec-layer').append(bar)
}

async function finish(save: boolean): Promise<void> {
  if (save) await flushPendingInput()
  detachCapture()
  const rec = await getRecording()
  await setRecording(null)
  document.querySelector('.customx-rec-layer')?.remove()
  if (!save || !rec || rec.steps.length === 0) return
  const name = window.prompt('Name this shortcut:', `Shortcut ${new Date().toLocaleTimeString()}`)
  if (!name) return
  const config = await getSiteConfig(location.origin)
  config.shortcuts.push({ id: uid(), name, steps: rec.steps, createdAt: Date.now() })
  await saveSiteConfig(config)
}
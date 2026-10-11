import { getPinHash, isSessionUnlocked, setPin, unlockSession } from '../shared/auth'
import { h, mountRoot } from './ui'

/**
 * Blocks the page behind a CustomX lock screen until:
 *  - first use: a PIN is created (stored hashed locally), or
 *  - the current browser session is unlocked with the PIN.
 * chrome.storage.session clears when the browser exits → auth every session.
 */
export async function requireAuth(onPass: () => void): Promise<void> {
  const pinHash = await getPinHash()
  if (await isSessionUnlocked()) {
    onPass()
    return
  }
  showOverlay(pinHash === null ? 'setup' : 'unlock', onPass)
}

function showOverlay(mode: 'setup' | 'unlock', onPass: () => void): void {
  const root = mountRoot('customx-auth-layer')

  const input = h('input', { type: 'password', placeholder: mode === 'setup' ? 'Create a PIN' : 'Enter your PIN' }) as HTMLInputElement
  const confirmInput = h('input', { type: 'password', placeholder: 'Confirm PIN' }) as HTMLInputElement
  const error = h('div', { class: 'customx-auth-error' })
  const button = h('button', { class: 'primary' }, mode === 'setup' ? 'Set PIN' : 'Unlock')
  const card = h('div', { class: 'customx-auth-card' }, h('div', { class: 'title' }, '⚡ CustomX'), input, ...(mode === 'setup' ? [confirmInput] : []), error, button)
  root.append(h('div', { class: 'customx-auth-backdrop' }, card))

  const submit = async (): Promise<void> => {
    error.textContent = ''
    if (mode === 'setup') {
      const pin = input.value.trim()
      if (pin.length < 4) return void (error.textContent = 'PIN must be at least 4 characters.')
      if (pin !== confirmInput.value.trim()) return void (error.textContent = 'PINs do not match.')
      await setPin(pin)
      root.remove()
      onPass()
      return
    }
    if (!(await unlockSession(input.value.trim()))) {
      error.textContent = 'Wrong PIN.'
      input.value = ''
      return
    }
    root.remove()
    onPass()
  }

  button.addEventListener('click', () => void submit())
  for (const el of [input, confirmInput]) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void submit()
      e.stopPropagation()
    })
  }
  input.focus()
}

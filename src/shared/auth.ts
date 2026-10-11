const PIN_KEY = '__customx_pin_hash'
const UNLOCK_KEY = '__customx_unlocked'

/**
 * PIN hashing. crypto.subtle requires a secure context (absent on http://
 * pages), so there is a djb2 fallback — this only needs to be strong enough
 * for a local convenience lock, not real cryptographic storage.
 */
async function digest(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return 'f' + (h >>> 0).toString(16)
}

export async function getPinHash(): Promise<string | null> {
  const data = await chrome.storage.local.get(PIN_KEY)
  return data[PIN_KEY] ?? null
}

export async function setPin(pin: string): Promise<void> {
  await chrome.storage.local.set({ [PIN_KEY]: await digest('customx:' + pin) })
}

/** Session unlock lives in chrome.storage.session, which the browser clears on exit. */
export async function isSessionUnlocked(): Promise<boolean> {
  try {
    const data = await chrome.storage.session.get(UNLOCK_KEY)
    return Boolean(data[UNLOCK_KEY])
  } catch {
    return false
  }
}

export async function unlockSession(pin: string): Promise<boolean> {
  const stored = await getPinHash()
  if (!stored || (await digest('customx:' + pin)) !== stored) return false
  await chrome.storage.session.set({ [UNLOCK_KEY]: true })
  return true
}

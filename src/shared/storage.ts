import type {
  MacroStep,
  PendingClone,
  PendingReplay,
  RecordingState,
  Shortcut,
  SiteConfig
} from './types'

const SITE_PREFIX = 'site:'
const RECORDING_KEY = '__customx_recording'
const PENDING_REPLAY_KEY = '__customx_pending_replay'
const PENDING_CLONE_KEY = '__customx_pending_clone'

function keyFor(origin: string): string {
  return SITE_PREFIX + origin
}

function defaults(origin: string): SiteConfig {
  return { origin, enabled: true, rules: [], shortcuts: [], clones: [] }
}

export async function getSiteConfig(origin: string): Promise<SiteConfig> {
  const data = await chrome.storage.sync.get(keyFor(origin))
  const config = (data[keyFor(origin)] as SiteConfig | undefined) ?? defaults(origin)
  config.rules ??= []
  config.shortcuts = (config.shortcuts ?? []).map(normalizeShortcut)
  config.clones ??= []
  return config
}

export async function saveSiteConfig(config: SiteConfig): Promise<void> {
  await chrome.storage.sync.set({ [keyFor(config.origin)]: config })
}

/** Upgrades pre-typing shortcuts ({selector}-only steps) to the tagged step union. */
export function normalizeShortcut(sc: Shortcut): Shortcut {
  sc.steps = sc.steps.map((raw) => {
    const step = raw as Partial<MacroStep>
    if (step.kind === 'click' || step.kind === 'input' || step.kind === 'key') return raw
    return { kind: 'click', selector: String((raw as { selector?: string }).selector ?? '') }
  })
  return sc
}

export async function getRecording(): Promise<RecordingState | null> {
  const data = await chrome.storage.local.get(RECORDING_KEY)
  const state = data[RECORDING_KEY] as RecordingState | undefined
  if (!state) return null
  state.steps = state.steps.map((raw) => {
    const step = raw as Partial<MacroStep>
    if (step.kind === 'click' || step.kind === 'input' || step.kind === 'key') return raw
    return { kind: 'click', selector: String((raw as { selector?: string }).selector ?? '') }
  })
  return state
}

export async function setRecording(state: RecordingState | null): Promise<void> {
  if (state) await chrome.storage.local.set({ [RECORDING_KEY]: state })
  else await chrome.storage.local.remove(RECORDING_KEY)
}

export async function appendRecordingStep(step: MacroStep): Promise<RecordingState | null> {
  const state = await getRecording()
  if (!state?.active) return null
  state.steps.push(step)
  await setRecording(state)
  return state
}

export async function getPendingReplay(): Promise<PendingReplay | null> {
  const data = await chrome.storage.local.get(PENDING_REPLAY_KEY)
  return data[PENDING_REPLAY_KEY] ?? null
}

export async function setPendingReplay(pending: PendingReplay | null): Promise<void> {
  if (pending) await chrome.storage.local.set({ [PENDING_REPLAY_KEY]: pending })
  else await chrome.storage.local.remove(PENDING_REPLAY_KEY)
}

export async function getPendingClone(): Promise<PendingClone | null> {
  const data = await chrome.storage.local.get(PENDING_CLONE_KEY)
  return data[PENDING_CLONE_KEY] ?? null
}

export async function setPendingClone(pending: PendingClone | null): Promise<void> {
  if (pending) await chrome.storage.local.set({ [PENDING_CLONE_KEY]: pending })
  else await chrome.storage.local.remove(PENDING_CLONE_KEY)
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
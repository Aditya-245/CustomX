import { getSiteConfig, saveSiteConfig } from '../shared/storage'
import type { Clone } from '../shared/types'
import { requireAuth } from './auth-gate'
import { initDarkMode, setDarkMode } from './dark-mode'
import { EditMode } from './edit-mode'
import { continueReplay, runReplay } from './replay'
import { resumeRecording, startRecording } from './recorder'
import { RuleEngine } from './rules'
import { activateClone, renderShortcutsLayer, resumePendingClone } from './shortcuts-layer'

declare global {
  interface Window {
    __customxLoaded?: boolean
  }
}

async function boot(): Promise<void> {
  // Everything below the lock screen requires a PIN unlock once per browser session.
  await requireAuth(() => void startFeatures())
}

async function startFeatures(): Promise<void> {
  const config = await getSiteConfig(location.origin)
  const engine = new RuleEngine()
  const editMode = new EditMode()

  if (config.enabled) {
    void engine.init()
    void renderShortcutsLayer()
    void initDarkMode()
    void resumeRecording()
    // Resume a replay or a cross-page clone that was interrupted by navigation.
    setTimeout(() => void continueReplay(), 800)
    setTimeout(() => void resumePendingClone(), 1200)
  }

  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== 'sync') return
    const fresh = await getSiteConfig(location.origin)
    if (!fresh.enabled && editMode.isActive()) editMode.exit()
  })

  chrome.runtime.onMessage.addListener((msg: Record<string, unknown>, _sender, sendResponse) => {
    void handleMessage(msg).then((result) => sendResponse(result ?? null))
    return true // async response
  })

  async function handleMessage(msg: Record<string, unknown>): Promise<unknown> {
    switch (msg.type) {
      case 'CUSTOMX_PING':
        return { ok: true }
      case 'CUSTOMX_GET_STATE': {
        const cfg = await getSiteConfig(location.origin)
        return {
          origin: location.origin,
          enabled: cfg.enabled,
          editMode: editMode.isActive(),
          darkMode: Boolean(cfg.uiStyle?.darkMode),
          rules: cfg.rules.map((r) => ({ id: r.id, action: r.action, selector: r.selector })),
          shortcuts: cfg.shortcuts.map((s) => ({ id: s.id, name: s.name })),
          clones: cfg.clones.map((c) => ({ id: c.id, name: c.name }))
        }
      }
      case 'CUSTOMX_TOGGLE_EDIT':
        editMode.toggle()
        return { ok: true }
      case 'CUSTOMX_SET_DARK': {
        const enabled = Boolean(msg.enabled)
        await setDarkMode(enabled)
        return { ok: true, darkMode: enabled }
      }
      case 'CUSTOMX_START_RECORDING':
        await startRecording()
        return { ok: true }
      case 'CUSTOMX_SET_ENABLED': {
        const enabled = Boolean(msg.enabled)
        if (!enabled) editMode.exit()
        const cfg = await getSiteConfig(location.origin)
        cfg.enabled = enabled
        await saveSiteConfig(cfg)
        if (enabled) {
          void engine.init()
          void renderShortcutsLayer()
        } else {
          location.reload()
        }
        return { ok: true }
      }
      case 'CUSTOMX_REMOVE_RULE':
        await RuleEngine.removeRule(String(msg.id))
        return { ok: true }
      case 'CUSTOMX_DELETE_SHORTCUT': {
        const cfg = await getSiteConfig(location.origin)
        cfg.shortcuts = cfg.shortcuts.filter((s) => s.id !== String(msg.id))
        await saveSiteConfig(cfg)
        return { ok: true }
      }
      case 'CUSTOMX_DELETE_CLONE': {
        const cfg = await getSiteConfig(location.origin)
        cfg.clones = cfg.clones.filter((c) => c.id !== String(msg.id))
        await saveSiteConfig(cfg)
        return { ok: true }
      }
      case 'CUSTOMX_RUN_SHORTCUT': {
        const cfg = await getSiteConfig(location.origin)
        const sc = cfg.shortcuts.find((s) => s.id === String(msg.id))
        if (!sc) return { ok: false, error: 'shortcut not found' }
        const okFlag = await runReplay(sc.steps)
        return { ok: okFlag }
      }
      case 'CUSTOMX_RUN_CLONE': {
        const cfg = await getSiteConfig(location.origin)
        const clone = cfg.clones.find((c) => c.id === String(msg.id))
        if (!clone) return { ok: false, error: 'clone not found' }
        await activateClone(clone as Pick<Clone, 'url' | 'selector'>)
        return { ok: true }
      }
      default:
        return null
    }
  }
}

if (!window.__customxLoaded) {
  window.__customxLoaded = true
  void boot()
}
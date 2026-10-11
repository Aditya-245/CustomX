import { getSiteConfig, saveSiteConfig, uid } from '../shared/storage'
import type { LayoutRule } from '../shared/types'
import { queryFirst } from './selectors'

export const Z_INDEX = 2147483600

let debounceTimer: number | undefined

export function pinAt(el: HTMLElement, docX: number, docY: number): void {
  el.style.setProperty('position', 'absolute', 'important')
  const parent: Element = el.offsetParent instanceof Element ? el.offsetParent : document.documentElement
  const pr = parent.getBoundingClientRect()
  el.style.setProperty('left', `${docX - pr.left - window.scrollX}px`, 'important')
  el.style.setProperty('top', `${docY - pr.top - window.scrollY}px`, 'important')
  el.style.setProperty('z-index', String(Z_INDEX), 'important')
}

/** Applies a single rule's inline styles to its element. Returns false if not found yet. */
function applyRule(rule: LayoutRule): boolean {
  if (rule.enabled === false) return false
  const el = queryFirst(rule.selector)
  if (!el) return false
  if (!(el instanceof HTMLElement)) return false
  if (rule.action === 'hide') {
    el.style.setProperty('display', 'none', 'important')
  } else if (rule.action === 'move' && rule.position) {
    pinAt(el, rule.position.left, rule.position.top)
  }
  return true
}

function clearRuleStyles(rule: LayoutRule): void {
  const el = queryFirst(rule.selector)
  if (!(el instanceof HTMLElement)) return
  el.style.removeProperty('display')
  el.style.removeProperty('position')
  el.style.removeProperty('left')
  el.style.removeProperty('top')
  el.style.removeProperty('z-index')
}

/**
 * Keeps the site's persisted layout applied. Re-tries pending rules whenever the
 * DOM mutates (frameworks re-rendering, lazy content), and reacts to live storage
 * changes from other tabs or the popup.
 */
export class RuleEngine {
  private rules: LayoutRule[] = []
  private observer: MutationObserver | null = null

  async init(): Promise<void> {
    const config = await getSiteConfig(location.origin)
    if (!config.enabled) return
    this.rules = config.rules
    this.applyAll()

    this.observer = new MutationObserver(() => {
      clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => this.applyAll(), 200)
    })
    this.observer.observe(document.documentElement, { childList: true, subtree: true })

    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area !== 'sync') return
      void this.reload()
    })
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
  }

  private async reload(): Promise<void> {
    // Only react to our origin's config changing.
    const config = await getSiteConfig(location.origin)
    const changed = JSON.stringify(config.rules) !== JSON.stringify(this.rules)
    this.rules = config.rules
    if (changed) this.applyAll()
  }

  /** Applies every rule; unapplied ones stay queued for retry on mutation. */
  applyAll(): void {
    for (const rule of this.rules) applyRule(rule)
  }

  /** Adds or replaces a rule and persists it. */
  static async addOrUpdate(rule: Omit<LayoutRule, 'createdAt'> & { createdAt?: number }): Promise<LayoutRule> {
    const config = await getSiteConfig(location.origin)
    const full: LayoutRule = { ...rule, createdAt: rule.createdAt ?? Date.now(), enabled: rule.enabled !== false }
    const existing = config.rules.find((r) => r.selector === full.selector && r.action === full.action)
    if (existing) Object.assign(existing, full)
    else config.rules.push(full)
    await saveSiteConfig(config)
    return full
  }

  static async removeRule(id: string): Promise<void> {
    const config = await getSiteConfig(location.origin)
    const rule = config.rules.find((r) => r.id === id)
    if (rule) clearRuleStyles(rule)
    config.rules = config.rules.filter((r) => r.id !== id)
    await saveSiteConfig(config)
  }

  static newId(): string {
    return uid()
  }
}
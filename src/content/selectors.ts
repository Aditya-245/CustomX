const STABLE_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy'] as const

/** Ids that look machine-generated (long digit runs / hex hashes) are unstable. */
const AUTO_ID_RE = /\d{4,}|^[0-9a-f]{10,}$/i
export const ROOT_FLAG = 'data-customx-root'

/** Generates an XPath for a given element. */
function generateXpath(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  
  while (current && current !== document.documentElement) {
    let tagName = current.tagName.toLowerCase()
    let index = 1
    
    // Count preceding siblings with same tag
    let sibling: Element | null = current.previousSibling instanceof Element ? current.previousSibling : null
    while (sibling) {
      if (sibling.tagName && sibling.tagName.toLowerCase() === tagName) index++
      sibling = sibling.previousSibling instanceof Element ? sibling.previousSibling : null
    }
    
    let pathSegment = tagName
    if (index > 1) {
      pathSegment = `${tagName}[${index}]`
    }
    parts.unshift(pathSegment)
    
    current = current.parentElement
  }
  
  return `//${parts.join('/')}`
}

function escapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeIdent(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
}

function countMatches(selector: string): number {
  try {
    return document.querySelectorAll(selector).length
  } catch {
    return -1
  }
}

function isUniqueTo(selector: string, el: Element): boolean {
  try {
    const matches = document.querySelectorAll(selector)
    return matches.length === 1 && matches[0] === el
  } catch {
    return false
  }
}

/** Builds a `tag:nth-of-type(k)` segment for the element relative to its parent. */
function segment(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const parent = el.parentElement
  if (!parent) return tag
  let idx = 1
  for (const sib of Array.from(parent.children)) {
    if (sib === el) break
    if (sib.tagName === el.tagName) idx++
  }
  return idx > 1 ? `${tag}:nth-of-type(${idx})` : tag
}

/**
 * Generates a resilient CSS selector uniquely matching `el` in the current document.
 * Prefers stable attributes (test ids, aria-label, name), then stable ids,
 * then a minimal structural path. Returns null for CustomX-owned elements.
 */
export function getStableSelector(el: Element): string | null {
  if (!(el instanceof Element)) return null
  if (el.closest(`[${ROOT_FLAG}]`)) return null
  if (!document.contains(el)) return null

  const candidates: string[] = []
  if (el.id && !AUTO_ID_RE.test(el.id)) candidates.push(`#${escapeIdent(el.id)}`)
  for (const attr of STABLE_ATTRS) {
    const value = el.getAttribute(attr)
    if (value) candidates.push(`${el.tagName.toLowerCase()}[${attr}="${escapeAttr(value)}"]`)
  }
  const label = el.getAttribute('aria-label')
  if (label && label.trim()) candidates.push(`${el.tagName.toLowerCase()}[aria-label="${escapeAttr(label.trim())}"]`)
  const name = el.getAttribute('name')
  if (name) candidates.push(`${el.tagName.toLowerCase()}[name="${escapeAttr(name)}"]`)

  for (const candidate of candidates) {
    if (isUniqueTo(candidate, el)) return candidate
  }

  // Structural path: extend upward until the accumulated selector is unique.
  let suffix = segment(el)
  if (isUniqueTo(suffix, el)) return suffix
  let node: Element | null = el.parentElement
  while (node && node !== document.documentElement) {
    const selector = `${segment(node)} > ${suffix}`
    if (isUniqueTo(selector, el)) return selector
    suffix = selector
    node = node.parentElement
  }
  return countMatches(suffix) >= 0 ? suffix : null
}

export function getSelectorInfo(el: Element): { css: string | null; xpath: string | null } {
  const css = getStableSelector(el)
  const xpath = css ? generateXpath(el) : null
  return { css, xpath }
}

export function queryFirst(selector: string): Element | null {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

/**
 * Waits until an element matching `selector` appears (SPA re-renders, navigation).
 * Uses MutationObserver plus an interval safety net; resolves with null on timeout.
 */
export function waitForSelector(selector: string, timeoutMs = 15000): Promise<Element | null> {
  const immediate = queryFirst(selector)
  if (immediate) return Promise.resolve(immediate)

  return new Promise((resolve) => {
    let settled = false
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    const interval = setInterval(check, 300)
    const timeout = setTimeout(() => finish(queryFirst(selector)), timeoutMs)

    function check(): void {
      const el = queryFirst(selector)
      if (el) finish(el)
    }
    function finish(result: Element | null): void {
      if (settled) return
      settled = true
      observer.disconnect()
      clearInterval(interval)
      clearTimeout(timeout)
      resolve(result)
    }
  })
}

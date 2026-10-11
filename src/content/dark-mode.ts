import { getSiteConfig, saveSiteConfig } from '../shared/storage'

const STYLE_ID = 'customx-dark-style'

/**
 * Generic local dark mode: invert the page (and re-invert media so photos and
 * icons keep their true colours). The filter is applied to <body> only — all
 * CustomX UI roots live directly under <html>, so our own widgets stay dark.
 */
const DARK_CSS = `
html { background-color: #11111b !important; }
body { filter: invert(1) hue-rotate(180deg) !important; }
body img, body picture, body video, body canvas, body iframe, body embed, body object,
body svg, body [style*="background-image"] {
  filter: invert(1) hue-rotate(180deg) !important;
}
`

export function applyDarkMode(enabled: boolean): void {
  const existing = document.getElementById(STYLE_ID)
  if (!enabled) {
    existing?.remove()
    document.documentElement.style.removeProperty('color-scheme')
    return
  }
  document.documentElement.style.setProperty('color-scheme', 'dark')
  if (existing) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = DARK_CSS
  document.documentElement.appendChild(style)
}

export function isDarkModeApplied(): boolean {
  return !!document.getElementById(STYLE_ID)
}

/** Applies the site's saved preference on load. */
export async function initDarkMode(): Promise<void> {
  const config = await getSiteConfig(location.origin)
  applyDarkMode(Boolean(config.uiStyle?.darkMode))
}

/** Toggles dark mode for this site, persists the choice, applies it live. */
export async function setDarkMode(enabled: boolean): Promise<boolean> {
  const config = await getSiteConfig(location.origin)
  config.uiStyle = { ...config.uiStyle, darkMode: enabled }
  await saveSiteConfig(config)
  applyDarkMode(enabled)
  return enabled
}

export type RuleAction = 'move' | 'hide'

export interface Position {
  /** Document-space X (clientX + scrollX) */
  left: number
  /** Document-space Y (clientY + scrollY) */
  top: number
}

export interface LayoutRule {
  id: string
  selector: string
  action: RuleAction
  /** Target document coordinates for 'move' rules */
  position?: Position
  createdAt: number
  /** If false, the rule is skipped (useful for disabling temporarily) */
  enabled?: boolean
  /** Optional human-readable description/note for this rule */
  description?: string
}

export type MacroStep =
  | { kind: 'click'; selector: string }
  | { kind: 'input'; selector: string; text: string }
  | { kind: 'key'; selector?: string; key: string }

export interface Shortcut {
  id: string
  name: string
  steps: MacroStep[]
  createdAt: number
}

/** A button on another page of this site, surfaced as a one-click action. */
export interface Clone {
  id: string
  name: string
  /** Full URL of the page the button lives on */
  url: string
  selector: string
  createdAt: number
}

/** Local-only visual overrides applied to every page of a site. */
export interface UiStyle {
  /** Root font-size percentage, e.g. 120 */
  fontSize?: number
  darkMode?: boolean
  /** When true, any element can be dragged/persisted directly without edit mode. */
  dragAnywhere?: boolean
  /** Raw CSS injected locally on this site */
  customCss?: string
}

/** Set when a clone is clicked from a different page; resumed after navigation. */
export interface PendingClone {
  url: string
  selector: string
}

/** Recording state for tracking user interactions. */
export interface RecordingState {
  active: boolean
  origin: string
  steps: MacroStep[]
}

/** Pending replay state for cross-page navigation resilience. */
export interface PendingReplay {
  steps: MacroStep[]
  next: number
}

/** Global site configuration stored in chrome.storage.sync. */
export interface SiteConfig {
  origin: string
  enabled: boolean
  rules: LayoutRule[]
  shortcuts: Shortcut[]
  clones: Clone[]
  uiStyle?: UiStyle
  widgetPos?: Position
}
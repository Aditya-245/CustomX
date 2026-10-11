import { ROOT_FLAG } from './selectors'

export function h(
  tag: string,
  attrs: Record<string, string | boolean> = {},
  ...children: Array<HTMLElement | string>
): HTMLElement {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue
    if (key === 'class') el.className = String(value)
    else el.setAttribute(key, String(value))
  }
  for (const child of children) {
    el.append(child instanceof HTMLElement ? child : document.createTextNode(child))
  }
  return el
}

/** Mounts a CustomX-owned fixed-position root outside <body> so site re-renders can't remove it. */
export function mountRoot(className: string): HTMLElement {
  document.getElementById('customx-style')?.remove()
  if (!document.getElementById('customx-style')) {
    const style = document.createElement('style')
    style.id = 'customx-style'
    style.textContent = CSS_TEXT
    document.documentElement.appendChild(style)
  }
  const root = h('div', { class: className, [ROOT_FLAG]: 'true' })
  document.documentElement.appendChild(root)
  return root
}

const CSS_TEXT = `
.customx-highlight {
  position: fixed; pointer-events: none; z-index: 2147483640;
  outline: 2px solid #6c5ce7; outline-offset: -1px;
  background: rgba(108, 92, 231, .15); border-radius: 2px;
}
html.customx-editing, html.customx-editing * { cursor: crosshair !important; }
.customx-toolbar {
  position: fixed; z-index: 2147483641; display: none; gap: 4px;
  background: #1e1e2e; border: 1px solid #45475a; border-radius: 8px; padding: 4px;
  box-shadow: 0 4px 16px rgba(0,0,0,.45); font-family: system-ui, sans-serif;
}
.customx-toolbar button {
  background: #313244; color: #cdd6f4; border: none; border-radius: 5px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.customx-toolbar button:hover { background: #585b70; }
.customx-toolbar button.primary { background: #6c5ce7; }
.customx-toolbar button.primary:hover { background: #7d6ff0; }
.customx-toolbar button.reset { color: #f9e2af; }
.customx-recorder {
  position: fixed; top: 16px; left: 16px; z-index: 2147483642;
  display: flex; align-items: center; gap: 9px;
  background: #1e1e2ef2; backdrop-filter: blur(6px);
  border: 1px solid #45475a; border-radius: 999px;
  padding: 6px 6px 6px 13px; font-family: system-ui, sans-serif;
  color: #cdd6f4; user-select: none;
  box-shadow: 0 6px 20px rgba(0,0,0,.5);
}
.customx-recorder .dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #f38ba8; box-shadow: 0 0 0 3px rgba(243,139,168,.25);
  animation: customx-blink 1s infinite;
}
.customx-recorder .count { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.customx-recorder .label { font-size: 12px; color: #a6adc8; }
.customx-recorder .stop {
  background: #f38ba8; color: #11111b; border: none; border-radius: 999px;
  padding: 5px 13px; font-size: 12px; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: background .12s ease;
}
.customx-recorder .stop:hover { background: #eba0ac; }
@keyframes customx-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: .25; }
}
.customx-layer {
  position: fixed; z-index: 2147483500; min-width: 190px; max-width: 260px;
  background: #1e1e2ee6; backdrop-filter: blur(6px); border: 1px solid #45475a;
  border-radius: 12px; padding: 8px; font-family: system-ui, sans-serif;
  box-shadow: 0 6px 24px rgba(0,0,0,.5); color: #cdd6f4; user-select: none;
}
.customx-layer .header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 2px 4px 8px; font-size: 12px; font-weight: 700; letter-spacing: .04em;
}
.customx-handle {
  position: fixed; z-index: 2147483500; width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #1e1e2ef2, #11111bf2); backdrop-filter: blur(8px);
  border: 1px solid #313244; border-radius: 14px; color: #cdd6f4; cursor: pointer;
  user-select: none; box-shadow: 0 6px 20px rgba(0,0,0,.55);
  transition: border-color .15s ease, color .15s ease, transform .1s ease, box-shadow .15s ease;
}
.customx-handle svg { display: block; width: 22px; height: 22px; }
.customx-handle:hover {
  border-color: #6c5ce7; color: #b7a9ff;
  box-shadow: 0 6px 22px rgba(108,92,231,.45);
}
.customx-handle:active { transform: scale(.94); }
.customx-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.customx-row button.sc { flex: 1; margin-top: 0; }
.customx-row button.del {
  background: transparent; border: none; color: #f38ba8; cursor: pointer;
  font-size: 13px; padding: 4px 6px; border-radius: 5px; font-family: inherit;
}
.customx-row button.del:hover { background: #45475a; }
.customx-empty-note { color: #a6adc8; font-size: 12px; font-style: italic; padding: 6px 2px; }
.customx-auth-backdrop {
  position: fixed; inset: 0; z-index: 2147483645;
  background: rgba(17,17,27,.72); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  font-family: system-ui, sans-serif;
}
.customx-auth-card {
  background: #1e1e2e; border: 1px solid #45475a; border-radius: 14px;
  padding: 26px 24px; width: 280px; display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,.6); color: #cdd6f4;
}
.customx-auth-card .title { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 4px; }
.customx-auth-card input {
  background: #181825; border: 1px solid #585b70; border-radius: 7px;
  color: #cdd6f4; padding: 9px 10px; font-size: 14px; outline: none; box-sizing: border-box;
}
.customx-auth-card input:focus { border-color: #6c5ce7; }
.customx-auth-card button {
  background: #6c5ce7; border: none; border-radius: 7px; color: #fff;
  font-weight: 600; padding: 9px; cursor: pointer; font-family: inherit;
}
.customx-auth-error { color: #f38ba8; font-size: 12px; min-height: 15px; }
.customx-layer button.sc {
  display: block; width: 100%; text-align: left; margin-top: 4px;
  background: #313244; color: #cdd6f4; border: none; border-radius: 7px;
  padding: 8px 10px; font-size: 13px; cursor: pointer; font-family: inherit;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.customx-layer button.sc:hover { background: #45475a; }
.customx-layer button.sc.running { outline: 2px solid #a6e3a1; }
.customx-layer .new-sc {
  margin-top: 6px; width: 100%; background: transparent; color: #89b4fa;
  border: 1px dashed #585b70; border-radius: 7px; padding: 7px;
  font-size: 12px; cursor: pointer; font-family: inherit;
}
.customx-layer .new-sc:hover { border-color: #89b4fa; }
.customx-moving {
  outline: 2px dashed #6c5ce7 !important;
  outline-offset: 2px;
  cursor: grabbing !important;
}
html.customx-drag-anywhere body * { cursor: grab !important; }
html.customx-drag-anywhere body .customx-moving { cursor: grabbing !important; }
.customx-drag-badge {
  position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
  z-index: 2147483646; padding: 7px 8px 7px 14px;
  display: flex; align-items: center; gap: 10px;
  background: #6c5ce7f2; backdrop-filter: blur(6px);
  border: 1px solid #7d6ff0; border-radius: 999px;
  color: #fff; font-family: system-ui, sans-serif; font-size: 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,.5); pointer-events: none;
  user-select: none; white-space: nowrap;
}
.customx-drag-badge button.reset-moves {
  background: #11111bcc; color: #f38ba8; border: 1px solid #45475a;
  border-radius: 999px; padding: 4px 11px; font-size: 11px; font-weight: 700;
  cursor: pointer; font-family: inherit; pointer-events: auto;
}
.customx-drag-badge button.reset-moves:hover { background: #45475a; color: #ffb3bd; }
.customx-layer button.reset-moves { color: #f38ba8; }
.customx-layer button.reset-moves:hover { border-color: #f38ba8; }
.customx-move-hint {
  left: 50%; top: 16px; transform: translateX(-50%);
  min-width: 0; max-width: none; padding: 8px 14px; font-size: 12px;
  pointer-events: none;
}
.customx-toast {
  position: fixed; left: 50%; top: 16px; transform: translateX(-50%);
  z-index: 2147483646; padding: 9px 14px;
  background: #1e1e2ef2; backdrop-filter: blur(6px);
  border: 1px solid #45475a; border-radius: 10px;
  color: #cdd6f4; font-family: system-ui, sans-serif; font-size: 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,.5); pointer-events: none;
}
`

# CustomX

A Chrome (Manifest V3) extension that lets you customize any website without touching the site itself: move elements around, record repeatable shortcuts, surface deep-action buttons, and flip a site to dark mode.

Everything is configured **per site** and stored locally via `chrome.storage.sync`.

## Features

- **Move anything, anywhere** — enter edit mode, hover to highlight an element, then drag it wherever you want. Grab-offset is preserved, **Ctrl** snaps to an 8px grid, **arrow keys** nudge (Shift = 10px), **Enter** drops and **Esc** cancels. Edit mode re-opens after each drop so you can keep moving other elements, and **Reset** removes the rules for the selected element.
- **Record shortcuts (macros)** — capture clicks, text input and key presses, then replay them with one click. A recording can span page navigations; progress is checkpointed and resumed on the next page.
- **Drag anywhere mode** — flip it on from the CustomX panel or popup, then drag *any* element straight to a new spot and release to save it (Ctrl snaps, Esc cancels). No edit mode required. A **Reset all** button in the mode badge (and the panel) restores every moved element to its original position.
- **Dark mode** — apply a local, client-side dark theme to the current site (images and media keep their true colors). Toggle it from the on-page panel or the popup.
  
## Getting started

```bash
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder

## Development

```bash
npm run dev          # rebuild popup + background on change
npm run dev:content  # rebuild content script on change
npm run typecheck    # tsc --noEmit
npm test             # vitest
```

After a build, reload the extension from `chrome://extensions` (and refresh any open tabs).

## Usage

- A draggable round handle appears on each page. **Double-click** it to open the shortcuts panel (searchable). Drag it to reposition.
- In the panel, use **+ Record new shortcut** to start a recording. A dark recorder pill shows the live step count with a **Stop** button; press **Stop** to name and save it, or **Escape** to cancel.
- Toggle **Dark mode** from the panel or the extension popup.
- Use the popup to **Record session**, **Edit layout**, or toggle **Dark mode**.

## Project structure

```
public/manifest.json          Extension manifest (MV3)
src/
  background/service-worker.ts  Service worker (storage access level, install hook)
  content/
    index.ts                  Content entry: boot, auth, message router
    auth-gate.ts              PIN lock/unlock overlay
    edit-mode.ts              Element picking, hide/move, one-shot picker
    recorder.ts               Interaction capture + shortcut saving
    replay.ts                 Step-by-step replay (navigation-resilient)
    rules.ts                  Layout rule engine (hide/move persistence)
    move.ts                   Shared drag-anywhere core (preview, snap, nudge)
    drag-anywhere.ts          Global "drag any element" mode
    selectors.ts              Stable CSS/XPath selector generation + lookup
    shortcuts-layer.ts        Floating handle + shortcuts/clones panel
    dark-mode.ts              Local per-site dark theme
    ui.ts                     DOM helpers + injected styles
  popup/                      Toolbar popup (Record / Dark mode / Edit layout)
  shared/
    auth.ts                   PIN hashing + session unlock
    storage.ts                chrome.storage wrappers (per-site config, recording state)
    types.ts                  Shared types
tests/                        Vitest unit tests (selectors, macro steps)
```

## Tech stack

- TypeScript
- [Vite](https://vitejs.dev/) 6 (content script bundled as an IIFE; popup + service worker as modules)
- [Vitest](https://vitest.dev/) + jsdom
- Chrome Extension Manifest V3

## Permissions

- `storage` — save per-site configuration and recording state
- `tabs` — talk to the active tab from the popup
- `scripting` — reserved for content script injection
- Host access to `http://*/*` and `https://*/*` — run the content script on the pages you customize

## Notes

- The PIN is a **local convenience lock**, not cryptographic protection — the hash is stored in `chrome.storage.local` and the unlock flag in `chrome.storage.session` (cleared when the browser closes).
- Dark mode uses a CSS invert filter for broad compatibility. It works well on most sites, but heavily art-directed pages may need manual tweaks.

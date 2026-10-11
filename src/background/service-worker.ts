// Allow content scripts to read/write chrome.storage.session (used for the
// per-browser-session unlock flag). Defaults to extension-pages-only.
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })

chrome.runtime.onInstalled.addListener(() => {
  console.log('[CustomX] installed')
})

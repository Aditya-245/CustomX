// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { getStableSelector } from '../src/content/selectors'

function setBody(html: string): void {
  document.body.innerHTML = html
}

beforeEach(() => setBody(''))

describe('getStableSelector', () => {
  it('returns null for CustomX-owned elements', () => {
    setBody('<div></div>')
    const root = document.createElement('div')
    root.setAttribute('data-customx-root', 'true')
    const child = document.createElement('button')
    root.append(child)
    document.documentElement.append(root)
    expect(getStableSelector(child)).toBeNull()
  })

  it('prefers a stable id', () => {
    setBody('<div id="save-btn">Save</div><div id="other"></div>')
    const el = document.getElementById('save-btn')!
    expect(getStableSelector(el)).toBe('#save-btn')
  })

  it('ignores machine-generated ids and falls back to structure', () => {
    setBody(`
      <nav>
        <div class="wrap"><button id="btn-12345678">A</button></div>
        <div class="wrap"><button id="ok-87654321">B</button></div>
      </nav>
    `)
    const el = document.querySelectorAll('button')[0]
    const sel = getStableSelector(el)!
    expect(sel).not.toContain('12345678')
    expect(document.querySelector(sel)).toBe(el)
  })

  it('uses data-testid when unique', () => {
    setBody('<button data-testid="checkout">Pay</button>')
    const el = document.querySelector('button')!
    expect(getStableSelector(el)).toBe('button[data-testid="checkout"]')
  })

  it('structural selector round-trips to the same element', () => {
    setBody(`
      <main>
        <section>
          <ul>
            <li><a>one</a></li>
            <li><a>two</a></li>
            <li><a>three</a></li>
          </ul>
        </section>
      </main>
    `)
    const links = Array.from(document.querySelectorAll('a'))
    for (const link of [links[1], links[2]]) {
      const sel = getStableSelector(link)!
      expect(document.querySelector(sel)).toBe(link)
    }
  })

  it('escapes quotes in attribute values', () => {
    setBody('<button aria-label=\'He said "hi"\'>x</button>')
    const el = document.querySelector('button')!
    const sel = getStableSelector(el)!
    expect(document.querySelector(sel)).toBe(el)
  })
})

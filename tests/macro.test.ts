import { describe, expect, it } from 'vitest'
import { normalizeShortcut } from '../src/shared/storage'

describe('normalizeShortcut', () => {
  it('migrates legacy click-only steps to tagged steps', () => {
    const legacy = {
      id: 'abc',
      name: 'Old',
      steps: [{ selector: '#a' }, { selector: 'button[data-x="1"]' }],
      createdAt: 1
    } as unknown as Parameters<typeof normalizeShortcut>[0]
    const migrated = normalizeShortcut(legacy)
    expect(migrated.steps).toEqual([
      { kind: 'click', selector: '#a' },
      { kind: 'click', selector: 'button[data-x="1"]' }
    ])
  })

  it('leaves already-tagged steps untouched', () => {
    const steps = [
      { kind: 'input', selector: '#q', text: 'wireless mouse' },
      { kind: 'key', selector: '#q', key: 'Enter' },
      { kind: 'click', selector: '.results > li:nth-of-type(2) > a' }
    ] as Parameters<typeof normalizeShortcut>[0]['steps']
    const modern = { id: 'def', name: 'New', steps, createdAt: 2 }
    const result = normalizeShortcut(modern).steps
    expect(result).toHaveLength(3)
    expect(result.every((step, i) => Object.is(step, steps[i]))).toBe(true)
  })
})

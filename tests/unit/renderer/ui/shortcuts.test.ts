// P3-0 [FR-097, FR-242]: the one table of key combinations (spec/editor.md, "Keyboard
// shortcuts"). Keys are matched by event.code, so a layout that moves the characters
// does not move the shortcut. "Mod" is Cmd on macOS and Ctrl on Windows.
import { describe, it, expect } from 'vitest'
import {
  SHORTCUTS,
  matchShortcut,
  type KeyPress,
  type Platform,
  type ShortcutName,
} from '@/renderer/ui/shortcuts'

// 'Meta+Shift+KeyZ' -> a key press with those modifiers held and that code.
function press(keys: string): KeyPress {
  const parts = keys.split('+')
  const code = parts.pop() ?? ''
  return {
    code,
    metaKey: parts.includes('Meta'),
    ctrlKey: parts.includes('Ctrl'),
    shiftKey: parts.includes('Shift'),
    altKey: parts.includes('Alt'),
  }
}

// Every row of the table, on both systems. [name, macOS presses, Windows presses]
const TABLE: [ShortcutName, string[], string[]][] = [
  ['undo', ['Meta+KeyZ'], ['Ctrl+KeyZ']],
  ['redo', ['Meta+Shift+KeyZ'], ['Ctrl+Shift+KeyZ', 'Ctrl+KeyY']],
  ['deleteLayer', ['Delete', 'Backspace'], ['Delete', 'Backspace']],
  ['duplicate', ['Meta+KeyD'], ['Ctrl+KeyD']],
  ['nudgeLeft', ['ArrowLeft'], ['ArrowLeft']],
  ['nudgeRight', ['ArrowRight'], ['ArrowRight']],
  ['nudgeUp', ['ArrowUp'], ['ArrowUp']],
  ['nudgeDown', ['ArrowDown'], ['ArrowDown']],
  ['nudgeLeftFar', ['Shift+ArrowLeft'], ['Shift+ArrowLeft']],
  ['nudgeRightFar', ['Shift+ArrowRight'], ['Shift+ArrowRight']],
  ['nudgeUpFar', ['Shift+ArrowUp'], ['Shift+ArrowUp']],
  ['nudgeDownFar', ['Shift+ArrowDown'], ['Shift+ArrowDown']],
  ['bringForward', ['Meta+BracketRight'], ['Ctrl+BracketRight']],
  ['sendBackward', ['Meta+BracketLeft'], ['Ctrl+BracketLeft']],
  ['zoomIn', ['Meta+Equal'], ['Ctrl+Equal']],
  ['zoomOut', ['Meta+Minus'], ['Ctrl+Minus']],
  ['zoomToFit', ['Meta+Digit0'], ['Ctrl+Digit0']],
  ['escape', ['Escape'], ['Escape']],
  ['applyCrop', ['Enter', 'NumpadEnter'], ['Enter', 'NumpadEnter']],
  ['saveCopy', ['Meta+Enter', 'Meta+NumpadEnter'], ['Ctrl+Enter', 'Ctrl+NumpadEnter']],
  ['nextVariantTab', ['Ctrl+Tab'], ['Ctrl+Tab']],
  ['previousVariantTab', ['Ctrl+Shift+Tab'], ['Ctrl+Shift+Tab']],
  ['nextCampaignTab', ['Meta+Shift+BracketRight'], ['Ctrl+Shift+BracketRight']],
  ['previousCampaignTab', ['Meta+Shift+BracketLeft'], ['Ctrl+Shift+BracketLeft']],
]

const ROWS: [ShortcutName, Platform, string][] = TABLE.flatMap(([name, mac, win]) => [
  ...mac.map((k): [ShortcutName, Platform, string] => [name, 'mac', k]),
  ...win.map((k): [ShortcutName, Platform, string] => [name, 'windows', k]),
])

const NAMES = Object.keys(SHORTCUTS) as ShortcutName[]

describe('keyboard shortcuts [FR-097, FR-242; spec/editor.md]', () => {
  it('has exactly the rows of the table', () => {
    expect(NAMES.sort()).toEqual(TABLE.map(([n]) => n).sort())
  })

  it.each(ROWS)('%s on %s: %s matches it and no other shortcut', (name, platform, keys) => {
    const matched = NAMES.filter((n) => matchShortcut(press(keys), n, platform))
    expect(matched).toEqual([name])
  })

  it.each([
    ['undo', 'mac', 'Ctrl+KeyZ'],
    ['undo', 'windows', 'Meta+KeyZ'],
    ['undo', 'mac', 'Alt+Meta+KeyZ'],
    ['redo', 'mac', 'Ctrl+KeyY'],
    ['redo', 'mac', 'Meta+KeyY'],
    ['bringForward', 'mac', 'Meta+Shift+BracketRight'],
    ['nudgeLeft', 'mac', 'Meta+ArrowLeft'],
    ['nextVariantTab', 'mac', 'Meta+Tab'],
    ['deleteLayer', 'windows', 'Ctrl+Delete'],
  ] as [ShortcutName, Platform, string][])(
    '%s on %s: %s does not match',
    (name, platform, keys) => {
      expect(matchShortcut(press(keys), name, platform)).toBe(false)
    },
  )

  it('matches by key place (event.code), not by the character typed', () => {
    const azerty = { ...press('Meta+BracketRight'), key: '$' }
    expect(matchShortcut(azerty, 'bringForward', 'mac')).toBe(true)
  })

  it('lets only Escape, Mod+Enter and the tab keys work inside a text field', () => {
    const inFields = NAMES.filter((n) => SHORTCUTS[n].inFields).sort()
    expect(inFields).toEqual(
      [
        'escape',
        'saveCopy',
        'nextVariantTab',
        'previousVariantTab',
        'nextCampaignTab',
        'previousCampaignTab',
      ].sort(),
    )
  })
})

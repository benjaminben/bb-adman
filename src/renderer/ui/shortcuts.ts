// spec/editor.md, "Keyboard shortcuts" [FR-097, FR-242]: the one owner of the key
// combinations. Keys are matched by event.code (the key's place), so a layout that moves the
// characters does not move the shortcut. "mod" is Cmd on macOS and Ctrl on Windows.
export type Platform = 'mac' | 'windows'

export type KeyPress = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>

// One way to press a shortcut. ctrl is the Ctrl key on both systems; only names one system.
type Combo = { codes: string[]; mod?: boolean; ctrl?: boolean; shift?: boolean; only?: Platform }

// inFields: the shortcut also works inside a text field, number field, select or text area.
type Shortcut = { combos: Combo[]; inFields: boolean }

const ENTER = ['Enter', 'NumpadEnter']

const key = (codes: string[], mods: Omit<Combo, 'codes'> = {}): Combo => ({ codes, ...mods })
const editor = (...combos: Combo[]): Shortcut => ({ combos, inFields: false })
const always = (...combos: Combo[]): Shortcut => ({ combos, inFields: true })

export const SHORTCUTS = {
  undo: editor(key(['KeyZ'], { mod: true })),
  redo: editor(
    key(['KeyZ'], { mod: true, shift: true }),
    key(['KeyY'], { ctrl: true, only: 'windows' }),
  ),
  deleteLayer: editor(key(['Delete', 'Backspace'])),
  duplicate: editor(key(['KeyD'], { mod: true })),
  nudgeLeft: editor(key(['ArrowLeft'])),
  nudgeRight: editor(key(['ArrowRight'])),
  nudgeUp: editor(key(['ArrowUp'])),
  nudgeDown: editor(key(['ArrowDown'])),
  nudgeLeftFar: editor(key(['ArrowLeft'], { shift: true })),
  nudgeRightFar: editor(key(['ArrowRight'], { shift: true })),
  nudgeUpFar: editor(key(['ArrowUp'], { shift: true })),
  nudgeDownFar: editor(key(['ArrowDown'], { shift: true })),
  bringForward: editor(key(['BracketRight'], { mod: true })),
  sendBackward: editor(key(['BracketLeft'], { mod: true })),
  zoomIn: editor(key(['Equal'], { mod: true })),
  zoomOut: editor(key(['Minus'], { mod: true })),
  zoomToFit: editor(key(['Digit0'], { mod: true })),
  escape: always(key(['Escape'])),
  applyCrop: editor(key(ENTER)),
  saveCopy: always(key(ENTER, { mod: true })),
  nextVariantTab: always(key(['Tab'], { ctrl: true })),
  previousVariantTab: always(key(['Tab'], { ctrl: true, shift: true })),
  nextCampaignTab: always(key(['BracketRight'], { mod: true, shift: true })),
  previousCampaignTab: always(key(['BracketLeft'], { mod: true, shift: true })),
  playPause: editor(key(['Space'])),
} satisfies Record<string, Shortcut>

export type ShortcutName = keyof typeof SHORTCUTS

// Every modifier must be exactly as the combo says: Mod+] does not match Mod+Shift+].
function matches(press: KeyPress, combo: Combo, platform: Platform): boolean {
  if (combo.only && combo.only !== platform) return false
  const mod = combo.mod ?? false
  const meta = platform === 'mac' && mod
  const ctrl = (combo.ctrl ?? false) || (platform === 'windows' && mod)
  return (
    combo.codes.includes(press.code) &&
    press.metaKey === meta &&
    press.ctrlKey === ctrl &&
    press.shiftKey === (combo.shift ?? false) &&
    !press.altKey
  )
}

export function matchShortcut(press: KeyPress, name: ShortcutName, platform: Platform): boolean {
  const shortcut: Shortcut = SHORTCUTS[name]
  return shortcut.combos.some((combo) => matches(press, combo, platform))
}

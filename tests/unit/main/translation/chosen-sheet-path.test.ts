// P6-7b: the sheet path the save dialog gave is remembered once, for a short time, and a newer
// choice replaces it.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CHOSEN_PATH_TTL_MS,
  forgetSheetPath,
  rememberSheetPath,
  takeSheetPath,
} from '@/main/translation/chosen-sheet-path'

beforeEach(() => forgetSheetPath())

describe('the chosen sheet path [P6-7b]', () => {
  it('refuses a path never chosen', () => {
    expect(takeSheetPath('/out/sheet.csv')).toBeNull()
  })

  it('takes the chosen path once', () => {
    rememberSheetPath('/out/sheet.csv')
    expect(takeSheetPath('/out/sheet.csv')).toBe('/out/sheet.csv')
    expect(takeSheetPath('/out/sheet.csv')).toBeNull()
  })

  it('compares the paths after resolving them', () => {
    rememberSheetPath('/out/x/../sheet.csv')
    expect(takeSheetPath('/out/./sheet.csv')).toBe('/out/sheet.csv')
  })

  it('keeps the chosen path when another is asked for', () => {
    rememberSheetPath('/out/sheet.csv')
    expect(takeSheetPath('/elsewhere/sheet.csv')).toBeNull()
    expect(takeSheetPath('/out/sheet.csv')).toBe('/out/sheet.csv')
  })

  it('lets a newer choice replace an older one', () => {
    rememberSheetPath('/out/old.csv')
    rememberSheetPath('/out/new.csv')
    expect(takeSheetPath('/out/old.csv')).toBeNull()
    expect(takeSheetPath('/out/new.csv')).toBe('/out/new.csv')
  })

  it('forgets the choice after the time limit', () => {
    rememberSheetPath('/out/sheet.csv', 1000)
    expect(takeSheetPath('/out/sheet.csv', 1000 + CHOSEN_PATH_TTL_MS + 1)).toBeNull()
    rememberSheetPath('/out/sheet.csv', 1000)
    expect(takeSheetPath('/out/sheet.csv', 1000 + CHOSEN_PATH_TTL_MS)).toBe('/out/sheet.csv')
  })
})

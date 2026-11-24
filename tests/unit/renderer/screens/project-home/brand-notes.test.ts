import { describe, it, expect } from 'vitest'
import {
  brandFileNoteLine,
  brandImportNoteLine,
  brandValueNoteLine,
} from '@/renderer/screens/project-home/brand-notes'
import type { BrandNoteReason, BrandRole } from '@/shared/schemas/commands/brief'
import type { BrandValueNote } from '@/shared/brief/brand'

describe('brandFileNoteLine: a brief brand file note [spec/brief-brand.md, "Notes"]', () => {
  it.each<[BrandRole, BrandNoteReason, string]>([
    ['logo', 'not_found', 'The logo "a.png" was not found.'],
    ['headingFont', 'not_found', 'The headline font "a.png" was not found.'],
    ['bodyFont', 'not_found', 'The text font "a.png" was not found.'],
    ['logo', 'not_a_picture', 'The logo "a.png" is not a picture Adman can use.'],
    [
      'headingFont',
      'not_a_font',
      'The file "a.png" is not a font Adman can use. Use TTF, OTF or WOFF2.',
    ],
    ['bodyFont', 'not_readable', 'The text font "a.png" could not be read.'],
    ['logo', 'not_readable', 'The logo "a.png" could not be read.'],
    [
      'headingFont',
      'not_full_path',
      'The headline font "a.png" was not used: a pasted brief has no folder, so give its full path or its asset ID.',
    ],
    [
      'logo',
      'unknown_asset',
      'No picture with the asset ID "a.png" is in this project\'s asset library.',
    ],
    [
      'bodyFont',
      'unknown_asset',
      'No font with the asset ID "a.png" is in this project\'s asset library.',
    ],
  ])('%s %s', (role, reason, line) => {
    expect(brandFileNoteLine({ role, name: 'a.png', reason })).toBe(line)
  })

  it('shows only the last part of a name that holds a folder', () => {
    expect(
      brandFileNoteLine({ role: 'logo', name: '/Users/me/private/a.png', reason: 'not_found' }),
    ).toBe('The logo "a.png" was not found.')
    expect(
      brandFileNoteLine({ role: 'bodyFont', name: 'C:\\x\\Body.woff2', reason: 'not_found' }),
    ).toBe('The text font "Body.woff2" was not found.')
  })

  it('removes hidden characters from the name', () => {
    expect(
      brandFileNoteLine({ role: 'logo', name: 'lo\u202Ego\u200B.png', reason: 'not_found' }),
    ).toBe('The logo "logo.png" was not found.')
  })
})

describe('brandImportNoteLine: a refused brand file import', () => {
  it.each<[BrandRole, string]>([
    ['logo', "The brief's logo could not be added: The disk is full."],
    ['headingFont', "The brief's headline font could not be added: The disk is full."],
    ['bodyFont', "The brief's text font could not be added: The disk is full."],
  ])('%s', (role, line) => {
    expect(brandImportNoteLine(role, 'The disk is full.')).toBe(line)
  })

  it('removes hidden characters from the message', () => {
    expect(brandImportNoteLine('logo', 'Bad\u202E file\u0007.')).toBe(
      "The brief's logo could not be added: Bad file.",
    )
  })
})

describe('brandValueNoteLine: a brand value that cannot be used', () => {
  it.each<[BrandValueNote, string]>([
    [
      { field: 'colours', text: 'teal', reason: 'not_a_colour' },
      'The colour "teal" is not a hex colour such as #0B3D2E.',
    ],
    [
      { field: 'layout', text: 'nope', reason: 'unknown_layout' },
      'The layout "nope" is not one of Adman\'s starting layouts. The default is used.',
    ],
    [
      { field: 'adsPer', text: 'banana', reason: 'unknown_ads_per' },
      'Ad sets "banana" is not "campaign" or "subject". All subjects share one set.',
    ],
  ])('%j', (note, line) => {
    expect(brandValueNoteLine(note)).toBe(line)
  })

  it('removes hidden characters from the text', () => {
    const note: BrandValueNote = {
      field: 'colours',
      text: 'te\u202Eal\u0000',
      reason: 'not_a_colour',
    }
    expect(brandValueNoteLine(note)).toBe('The colour "teal" is not a hex colour such as #0B3D2E.')
  })
})

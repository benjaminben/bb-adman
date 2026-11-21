import { describe, expect, it } from 'vitest'
import { requiredAssetsCheck, textColoursCheck } from '@/shared/checks/brand-checks'
import type { CheckInput } from '@/shared/checks/types'
import { input, picture, text, textColoured, textStyle } from './fixtures'

type Row = [
  string,
  CheckInput,
  'pass' | 'warn' | 'skipped',
  Array<{ layerId?: string; message: string }>,
]

const names = { a1: 'Quorble logo', f1: 'Zento Sans' }
const required = (layers: CheckInput['layers'], ids = ['a1']) =>
  input({ layers, assetNames: names, ruleSet: { requiredAssetIds: ids } })
const missing = [{ message: 'Quorble logo is not shown on this post.' }]
const video = { format: 'video' as const, durationMs: 5000 }

describe('required-assets [FR-110]', () => {
  it.each<Row>([
    [
      'skipped with no list',
      input(),
      'skipped',
      [{ message: 'The campaign has no required files.' }],
    ],
    [
      'skipped with only blank entries',
      required([], [' ']),
      'skipped',
      [{ message: 'The campaign has no required files.' }],
    ],
    ['passes when a shown picture uses it', required([picture('p', 'a1')]), 'pass', []],
    ['warns when no layer uses it', required([picture('p', 'a9')]), 'warn', missing],
    [
      'warns when the layer is hidden',
      required([picture('p', 'a1', { visible: false })]),
      'warn',
      missing,
    ],
    [
      'warns at opacity 0',
      required([picture('p', 'a1', { style: { opacity: 0 } })]),
      'warn',
      missing,
    ],
    [
      'warns off the canvas',
      required([picture('p', 'a1', { geometry: { x: 2000 } })]),
      'warn',
      missing,
    ],
    [
      'passes when rotated into the canvas',
      required([
        picture('p', 'a1', { geometry: { x: 300, y: -200, width: 400, height: 20, rotation: 90 } }),
      ]),
      'pass',
      [],
    ],
    [
      'passes when a shown text layer uses it as font',
      required([text('t', 'Vexlo', { style: { ...textStyle, fontAssetId: 'f1' } })], ['f1']),
      'pass',
      [],
    ],
    [
      'warns when the font layer has blank copy',
      required([text('t', ' ', { style: { ...textStyle, fontAssetId: 'f1' } })], ['f1']),
      'warn',
      [{ message: 'Zento Sans is not shown on this post.' }],
    ],
    [
      'warns when the video timing is outside the duration',
      input({
        variant: video,
        layers: [picture('p', 'a1', { timing: { startMs: 5000, endMs: 7000 } })],
        assetNames: names,
        ruleSet: { requiredAssetIds: ['a1'] },
      }),
      'warn',
      missing,
    ],
    [
      'one finding per missing asset',
      required([picture('p', 'a1')], ['a1', 'f1', 'zz']),
      'warn',
      [
        { message: 'Zento Sans is not shown on this post.' },
        { message: 'zz is not shown on this post.' },
      ],
    ],
  ])('%s', (_label, value, status, findings) => {
    const result = requiredAssetsCheck(value)
    expect(result).toMatchObject({ checkId: 'required-assets', group: 'brand-legal', status })
    expect(result.findings).toEqual(findings)
  })
})

const palette = (layers: CheckInput['layers'], colours = ['#AABBCC']) =>
  input({ layers, ruleSet: { palette: colours } })

describe('text-colours [FR-111]', () => {
  it.each<Row>([
    ['skipped with an empty palette', input(), 'skipped', [{ message: 'The palette is empty.' }]],
    [
      'passes when the colour is in the palette',
      palette([textColoured('t', '#AABBCC')]),
      'pass',
      [],
    ],
    ['ignores letter case', palette([textColoured('t', '#aabbcc')]), 'pass', []],
    [
      'warns for a colour outside the palette',
      palette([textColoured('t', '#112233', { name: 'Headline' })]),
      'warn',
      [{ layerId: 't', message: 'Headline uses #112233, which is not in the palette.' }],
    ],
    [
      'ignores a hidden text layer',
      palette([textColoured('t', '#112233', { visible: false })]),
      'pass',
      [],
    ],
    [
      'ignores an empty text layer',
      palette([textColoured('t', '#112233', { copy: '' })]),
      'pass',
      [],
    ],
  ])('%s', (_label, value, status, findings) => {
    const result = textColoursCheck(value)
    expect(result).toMatchObject({ checkId: 'text-colours', group: 'brand-legal', status })
    expect(result.findings).toEqual(findings)
  })
})

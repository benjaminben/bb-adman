// P6-7 (spec/phases/phase-06.md, design addition 4; A-164): the translation sheet as CSV.
import { describe, it, expect } from 'vitest'
import { sheetCsv } from '@/shared/translation/sheet'
import type { TranslationRow } from '@/shared/schemas/queries/translation'

const BOM = '﻿'
const HEADER = '"variant_id","title","size","language","layer","source_text","text","status"'

function row(over: Partial<TranslationRow> = {}): TranslationRow {
  return {
    directionId: 'D1',
    variantId: 'V1',
    title: 'Summer',
    sizeLabel: '1x1',
    language: 'de',
    layerId: 'L1',
    layerKey: 'headline',
    layerName: 'Headline',
    sourceText: 'Shop now',
    text: 'Jetzt kaufen',
    status: 'proposed',
    source: 'ai',
    fontAssetId: null,
    ...over,
  }
}

// The one data line of a sheet with one row.
function onlyLine(csv: string): string {
  const lines = csv.slice(BOM.length).split('\r\n')
  expect(lines).toHaveLength(3)
  expect(lines[2]).toBe('')
  return lines[1] ?? ''
}

describe('sheetCsv [P6-7, A-164]', () => {
  it('starts with the byte-order mark and the header, and ends every line with CRLF', () => {
    expect(sheetCsv([])).toBe(`${BOM}${HEADER}\r\n`)
    expect(sheetCsv([row(), row({ variantId: 'V2' })])).toBe(
      `${BOM}${HEADER}\r\n` +
        '"V1","Summer","1x1","de","Headline","Shop now","Jetzt kaufen","proposed"\r\n' +
        '"V2","Summer","1x1","de","Headline","Shop now","Jetzt kaufen","proposed"\r\n',
    )
  })

  it('doubles quotes and keeps commas and line breaks inside the quoted cell', () => {
    const text = 'Say "hi", then\r\nleave\nnow'
    expect(sheetCsv([row({ text })])).toBe(
      `${BOM}${HEADER}\r\n` +
        '"V1","Summer","1x1","de","Headline","Shop now","Say ""hi"", then\r\nleave\nnow","proposed"\r\n',
    )
  })

  it('gives an empty cell for a null status and a null source text', () => {
    expect(onlyLine(sheetCsv([row({ status: null, sourceText: null, text: '' })]))).toBe(
      '"V1","Summer","1x1","de","Headline","","",""',
    )
  })

  it('keeps a CJK text as written', () => {
    expect(onlyLine(sheetCsv([row({ language: 'ja', text: '今すぐ購入' })]))).toBe(
      '"V1","Summer","1x1","ja","Headline","Shop now","今すぐ購入","proposed"',
    )
  })

  it.each([
    ['=', '=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+', '+1', `"'+1"`],
    ['-', '-1+2', `"'-1+2"`],
    ['@', '@SUM(A1)', `"'@SUM(A1)"`],
    ['a tab', '\t=1', `"'\t=1"`],
    ['a carriage return', '\r=1', `"'\r=1"`],
    ['plain text', 'Hallo = gut', '"Hallo = gut"'],
  ])('the sheet guards cells that start with a formula sign: %s', (_name, text, cell) => {
    const line = onlyLine(sheetCsv([row({ text, title: text, layerName: text })]))
    expect(line).toBe(`"V1",${cell},"1x1","de",${cell},"Shop now",${cell},"proposed"`)
  })
})

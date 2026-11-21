// The translation sheet (spec/phases/phase-06.md, design addition 4; A-164): UTF-8 with a
// byte-order mark, CRLF line ends, every cell quoted with inner quotes doubled. Pure.
import type { TranslationRow } from '@/shared/schemas/queries/translation'

const HEADER = ['variant_id', 'title', 'size', 'language', 'layer', 'source_text', 'text', 'status']

// A cell that starts like a formula gets a ' in front, so a spreadsheet does not run text from
// an AI answer or an agent as a formula.
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: string | null): string {
  const text = value ?? ''
  const guarded = FORMULA_START.test(text) ? `'${text}` : text
  return `"${guarded.replaceAll('"', '""')}"`
}

// Written as a code so the mark stays visible here.
const BOM = String.fromCharCode(0xfeff)

const line = (cells: Array<string | null>) => `${cells.map(cell).join(',')}\r\n`

export function sheetCsv(rows: TranslationRow[]): string {
  const body = rows.map((r) =>
    line([
      r.variantId,
      r.title,
      r.sizeLabel,
      r.language,
      r.layerName,
      r.sourceText,
      r.text,
      r.status,
    ]),
  )
  return `${BOM}${line(HEADER)}${body.join('')}`
}

// R2E-3 (spec/phases/round-2-editor.md D3): the built-in type styles offered when a project has
// no font of its own. All five use Inter, the one font the app bundles (weights 100 to 900), so
// no font file is added. A style sets weight, capitals and spacing and puts the font back to the
// default; size, colour, line height and the text box stay.

export const TYPE_STYLES = [
  { id: 'regular', label: 'Regular', fontWeight: 400, allCaps: false, letterSpacing: 0 },
  { id: 'bold', label: 'Bold', fontWeight: 700, allCaps: false, letterSpacing: 0 },
  {
    id: 'black-caps',
    label: 'Black capitals',
    fontWeight: 900,
    allCaps: true,
    letterSpacing: 0.02,
  },
  { id: 'light', label: 'Light', fontWeight: 300, allCaps: false, letterSpacing: 0 },
  {
    id: 'spaced-caps',
    label: 'Spaced capitals',
    fontWeight: 500,
    allCaps: true,
    letterSpacing: 0.12,
  },
] as const

export type TypeStyle = (typeof TYPE_STYLES)[number]
export type TypeStyleId = TypeStyle['id']

export const TYPE_STYLE_IDS: TypeStyleId[] = TYPE_STYLES.map((s) => s.id)

export const isTypeStyleId = (value: unknown): value is TypeStyleId =>
  TYPE_STYLE_IDS.some((id) => id === value)

const styleById = (id: TypeStyleId): TypeStyle => TYPE_STYLES.find((s) => s.id === id) as TypeStyle

// The style patch of one layer.update: the three fields, and the font back to the default.
export function typeStylePatch(id: TypeStyleId) {
  const { fontWeight, allCaps, letterSpacing } = styleById(id)
  return { fontAssetId: null, fontWeight, allCaps, letterSpacing }
}

type LookFields = { fontWeight: number; allCaps?: boolean; letterSpacing: number }

// The style whose three fields match, or null. A style without allCaps has it off.
export function typeStyleOf(style: LookFields): TypeStyleId | null {
  const match = TYPE_STYLES.find(
    (s) =>
      s.fontWeight === style.fontWeight &&
      s.allCaps === (style.allCaps ?? false) &&
      s.letterSpacing === style.letterSpacing,
  )
  return match?.id ?? null
}

function wordsOf(s: TypeStyle): string {
  const caps = s.allCaps ? `, in capitals, spaced ${s.letterSpacing} em` : ''
  return `${s.label}: Inter at weight ${s.fontWeight}${caps}`
}

export type TypeStyleOffer = { id: TypeStyleId; words: string }

// What the layout call is told of each style (D3, "In Place text with AI").
export const typeStylePrompt = (): TypeStyleOffer[] =>
  TYPE_STYLES.map((s) => ({ id: s.id, words: wordsOf(s) }))

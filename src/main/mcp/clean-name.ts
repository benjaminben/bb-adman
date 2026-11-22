// One cleaner for every name an agent's ask or activity shows (spec/phases/phase-10.md, A-238,
// A-242): names from a project file anyone may have made, and the client name an agent chose.
// Control, line-break and reordering characters are taken out, white space runs become one
// space and every quote-like mark becomes `'`, so a name cannot close its own quotes, imitate
// the line's wording or change how the rest reads. At most two combining marks stay in a row,
// so stacked marks cannot draw over the next line; a cut at 60 code points keeps the rest of
// the line in view.
const NAME_MAX = 60

const QUOTES = /["\p{Pi}\p{Pf}＂″‶〃〝〞〟״˝„‟]/gu

export function cleanName(name: string): string {
  const flat = name
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/(\p{M}{2})\p{M}+/gu, '$1')
    .replace(/\s+/gu, ' ')
    .replace(QUOTES, "'")
    .trim()
  const points = [...flat]
  return points.length > NAME_MAX ? `${points.slice(0, NAME_MAX).join('')}…` : flat
}

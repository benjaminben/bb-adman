// Names and paths from a project file, cleaned for display in the publish dialog (P9-12
// review). A project file may come from someone else, so a name could carry characters that
// reorder the line (right-to-left overrides), hide text (zero-width characters) or break it
// (line and paragraph separators), and so pose as another name or as the dialog's own words.
// Those characters (Unicode Cc, Cf, Zl, Zp) are taken out of names and paths alike. A name's
// white space runs become one space and it is cut at 200 code points with "…"; a path is never
// cut, since it is the user's check of which file leaves the computer.
export const NAME_DISPLAY_MAX = 200

const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu

export function displayPath(path: string): string {
  return path.replace(HIDDEN, '')
}

export function displayName(name: string): string {
  const flat = displayPath(name).replace(/\s+/gu, ' ').trim()
  const points = [...flat]
  return points.length > NAME_DISPLAY_MAX ? `${points.slice(0, NAME_DISPLAY_MAX).join('')}…` : flat
}

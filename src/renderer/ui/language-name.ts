// A language code's English name ("de" is "German"); a code with no name is kept as it is.
// Shared by the variant grid's column heads and the translation panel (R2C-2, R2C-4).
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames('en', { type: 'language', fallback: 'code' }).of(code) ?? code
  } catch {
    return code
  }
}

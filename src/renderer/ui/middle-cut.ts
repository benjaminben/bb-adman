// A long text, such as a folder path, cut in the middle to 48 characters: the first 20, "…",
// and the last 27, so both the start and the folder's own name stay readable (SET-3, AP-9).
const HEAD = 20
const TAIL = 27

export function middleCut(text: string): string {
  if (text.length <= HEAD + 1 + TAIL) return text
  return `${text.slice(0, HEAD)}…${text.slice(-TAIL)}`
}

// spec/phases/round-2-approvals.md "The page: layout": a picture's width and height attributes
// from its size line, so the browser keeps its shape before it loads. Each side is a whole
// number from 1 to 20000; anything else gives a square.
const SIZE = /^(\d{1,5})\s*×\s*(\d{1,5})/
const FALLBACK = { width: 1080, height: 1080 }
const fits = (n: number) => n >= 1 && n <= 20000

export function pictureSize(sizeLine: string): { width: number; height: number } {
  const match = SIZE.exec(sizeLine)
  if (match === null) return FALLBACK
  const width = Number(match[1])
  const height = Number(match[2])
  return fits(width) && fits(height) ? { width, height } : FALLBACK
}

// R2E-4 (spec/phases/round-2-editor.md D4, "Same shape"): whether a picture has the shape of a
// layer box, its width-to-height ratio within 1% of the box's either way. A size that is not
// known or not above zero is never the same shape. Pure.
export type Size = { width: number | null; height: number | null }

const TOLERANCE = 0.01

const known = (n: number | null): n is number => n !== null && n > 0

export function sameShape(box: Size, picture: Size): boolean {
  const { width: bw, height: bh } = box
  const { width: pw, height: ph } = picture
  if (!known(bw) || !known(bh) || !known(pw) || !known(ph)) return false
  // The two ratios compared by cross-multiplying, so whole sizes stay exact.
  return Math.abs(pw * bh - bw * ph) <= TOLERANCE * bw * ph
}

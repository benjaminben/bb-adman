// SPEC 6.10.5 [REQ: FR-259, FR-262, A-C3]: the nearest size a model can make for the shape
// asked. Nobody resizes the result; the fit happens when the picture is placed in a layer.
export type Size = { width: number; height: number }
export type SizeRule = { multiple: number; minPixels: number; maxPixels: number }

function isWhole(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

function roundings(ideal: number, multiple: number): number[] {
  const down = Math.max(multiple, Math.floor(ideal / multiple) * multiple)
  const up = Math.max(multiple, Math.ceil(ideal / multiple) * multiple)
  return down === up ? [down] : [down, up]
}

export function fitSize(asked: Size, rule: SizeRule): Size {
  if (!isWhole(asked.width) || !isWhole(asked.height)) {
    throw new Error('A size needs a whole width and height above zero')
  }
  // 1. The ratio, and the area moved into the rule's range.
  const r = asked.width / asked.height
  const p = Math.min(rule.maxPixels, Math.max(rule.minPixels, asked.width * asked.height))
  // 2. The ideal sides, each rounded down and up to the multiple.
  const pairs: Size[] = []
  for (const width of roundings(Math.sqrt(p * r), rule.multiple)) {
    for (const height of roundings(Math.sqrt(p / r), rule.multiple)) pairs.push({ width, height })
  }
  // 3. Pairs outside the range go, unless that drops all of them.
  const inRange = pairs.filter(
    (s) => s.width * s.height >= rule.minPixels && s.width * s.height <= rule.maxPixels,
  )
  const left = inRange.length > 0 ? inRange : pairs
  // 4. The closest ratio; then the area closest to p; then the wider one.
  const ratioGap = (s: Size) => Math.abs(Math.log(s.width / s.height / r))
  const areaGap = (s: Size) => Math.abs(s.width * s.height - p)
  const sorted = [...left].sort(
    (a, b) => ratioGap(a) - ratioGap(b) || areaGap(a) - areaGap(b) || b.width - a.width,
  )
  return sorted[0] as Size
}

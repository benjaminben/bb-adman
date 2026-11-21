// SPEC 6.2: Gemini takes an aspect ratio, not a pixel size. The ratios every Gemini image
// model accepts (the @google/genai ImageConfig list), so a model change keeps working.
const RATIOS = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:2': 3 / 2,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '4:5': 4 / 5,
  '5:4': 5 / 4,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '21:9': 21 / 9,
} as const

export type AspectRatio = keyof typeof RATIOS

// The listed ratio closest to width:height, compared on a log scale so that 2:1 and 1:2
// are equally far from 1:1.
export function nearestAspectRatio(width: number, height: number): AspectRatio {
  const target = Math.log(width / height)
  let best: AspectRatio = '1:1'
  let bestDistance = Infinity
  for (const [ratio, value] of Object.entries(RATIOS) as Array<[AspectRatio, number]>) {
    const distance = Math.abs(Math.log(value) - target)
    if (distance < bestDistance) {
      best = ratio
      bestDistance = distance
    }
  }
  return best
}

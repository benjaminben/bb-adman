// spec/app-style-parts.md, "Swatch field" (D-109): the picker's colour maths, pure. Hue runs
// 0 to 360, saturation and brightness 0 to 100. A hex is read in either letter case and
// written as an upper-case #RRGGBB, as the app stores colours.

export type Hsb = { h: number; s: number; b: number }

const hold = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))

export function hexToHsb(hex: string): Hsb {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const bl = n & 255
  const max = Math.max(r, g, bl)
  const span = max - Math.min(r, g, bl)
  let h = 0
  if (span > 0) {
    if (max === r) h = ((g - bl) / span + 6) % 6
    else if (max === g) h = (bl - r) / span + 2
    else h = (r - g) / span + 4
  }
  return { h: h * 60, s: max === 0 ? 0 : (span / max) * 100, b: (max / 255) * 100 }
}

export function hsbToHex({ h, s, b }: Hsb): string {
  const hue = (((hold(h, 0, 360) % 360) + 360) % 360) / 60
  const v = hold(b, 0, 100) / 100
  const c = v * (hold(s, 0, 100) / 100)
  // Each channel from the standard HSV formula: f(n) = v - c * max(0, min(k, 4 - k, 1)).
  const channel = (n: number) => {
    const k = (n + hue) % 6
    const value = v - c * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${channel(5)}${channel(3)}${channel(1)}`.toUpperCase()
}

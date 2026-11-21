// The grid-to-page maths of the start page drawings (spec/app-style.md "Icons and drawings",
// after design/prototype/js/illustrations.js). A grid point is x and y on the ground and z up;
// the page is the SVG's own units, one grid step being STEP units. Pure: points in, text out.
export type GridPoint = readonly [number, number, number]
type PagePoint = [number, number]

const STEP = 9
const COS = 0.866

const tenth = (n: number) => Math.round(n * 10) / 10 + 0

// A grid point to a point on the page, to one decimal.
export function pt(x: number, y: number, z = 0): PagePoint {
  return [tenth((x - y) * COS * STEP), tenth((x + y) * 0.5 * STEP - z * STEP)]
}

function points(list: PagePoint[]): string {
  return list.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')
}

// The flat top of a footprint at height z. x, y: back corner. w, d: footprint.
export function topFace(x: number, y: number, w: number, d: number, z: number): string {
  return points([pt(x, y, z), pt(x + w, y, z), pt(x + w, y + d, z), pt(x, y + d, z)])
}

// The three faces of a box seen from the front: z is its base, h how tall it is.
export function boxFaces(x: number, y: number, w: number, d: number, z: number, h: number) {
  const up = z + h
  return {
    left: points([pt(x, y + d, up), pt(x + w, y + d, up), pt(x + w, y + d, z), pt(x, y + d, z)]),
    right: points([pt(x + w, y, up), pt(x + w, y + d, up), pt(x + w, y + d, z), pt(x + w, y, z)]),
    top: topFace(x, y, w, d, up),
  }
}

export function linePoints(list: readonly GridPoint[]): string {
  return points(list.map(([x, y, z]) => pt(x, y, z)))
}

// Steps from one point up (or down) to another along one ground axis: each step rises, then
// runs its tread.
export function stairs(a: GridPoint, b: GridPoint, n: number): GridPoint[] {
  const list: GridPoint[] = [a]
  for (let i = 1; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n
    const y = a[1] + ((b[1] - a[1]) * i) / n
    list.push([x, y, a[2] + ((b[2] - a[2]) * (i - 1)) / n], [x, y, a[2] + ((b[2] - a[2]) * i) / n])
  }
  return list
}

// The transform that lays a flat mark, drawn in grid units, on a top face at (x, y, z).
export function glyphMatrix(x: number, y: number, z: number): string {
  const [px, py] = pt(x, y, z)
  const a = (COS * STEP).toFixed(2)
  const b = 0.5 * STEP
  return `matrix(${a} ${b} -${a} ${b} ${px.toFixed(1)} ${py.toFixed(1)})`
}

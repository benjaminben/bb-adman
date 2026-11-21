// The start page's three drawings (spec/app-style.md "Icons and drawings"), each one idea the
// app is built on: branch (one master becomes several sizes), generate (empty places fill with
// options and one is picked), linked (a change travels round everything linked). Plain boxes
// and lines after design/prototype/js/illustrations.js; decorative, so hidden and never
// focusable. Colours, line and timing come from tokens in the CSS module.
import type { ReactNode } from 'react'
import { boxFaces, glyphMatrix, linePoints, stairs, topFace, type GridPoint } from './iso'
import styles from './start-drawings.module.css'

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')
const delay = (n: number) => styles[`d${n}`]

type BoxProps = {
  at: readonly [number, number, number, number, number, number]
  className?: string
  children?: ReactNode
}

function Box({ at, className, children }: BoxProps) {
  const faces = boxFaces(...at)
  return (
    <g className={className}>
      <polygon className={styles.left} points={faces.left} />
      <polygon className={styles.right} points={faces.right} />
      <polygon className={styles.top} points={faces.top} />
      {children}
    </g>
  )
}

function Line({ through, d }: { through: readonly GridPoint[]; d?: number }) {
  return (
    <polyline
      className={cx(styles.line, d !== undefined && delay(d))}
      pathLength={1}
      points={linePoints(through)}
    />
  )
}

function Scene({
  box,
  className,
  children,
}: {
  box: string
  className?: string
  children: ReactNode
}) {
  return (
    <svg className={cx(styles.scene, className)} viewBox={box} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

// One master (the coloured slab, held up high) branches into three boxes of different shape.
function Branch() {
  const rise = (d: number) => cx(styles.rise, delay(d))
  return (
    <Scene box="-90 -88 187 151">
      <Line
        through={[
          [0, 0, 7],
          [0, 0, 0],
        ]}
        d={1}
      />
      <Line
        through={[
          [0, 0, 0],
          [0, 5.5, 0],
        ]}
        d={2}
      />
      <Line
        through={[
          [0, 0, 0],
          [6.5, 0, 0],
        ]}
        d={2}
      />
      <Line
        through={[
          [4, 0, 0],
          [4, 4, 0],
        ]}
        d={3}
      />
      <Box at={[6.5, -1.1, 4, 2.25, 0, 0.9]} className={rise(3)} />
      <Box at={[-1.1, 5.5, 2.25, 4, 0, 1.6]} className={rise(3)} />
      <Box at={[2.5, 4, 3, 3, 0, 2.4]} className={rise(4)} />
      <Box at={[-1.5, -1.5, 3, 3, 7, 0.5]} className={styles.acc} />
    </Scene>
  )
}

// Marks drawn flat on a tile's top face: four different "pictures".
const GLYPHS: ReactNode[] = [
  <circle key="c" cx="1.5" cy="1.5" r="0.8" />,
  <path key="t" d="M0.6 2.4L1.5 0.7L2.4 2.4Z" />,
  <path key="w" d="M0.6 2.2A0.9 0.9 0 0 1 2.4 2.2M0.6 1.3A0.9 0.9 0 0 1 2.4 1.3" />,
  <path key="s" d="M0.6 2.4V1.8H1.2V1.2H1.8V0.6H2.4" />,
]

const PLACES: [number, number][] = [
  [0, 0],
  [5, 0],
  [0, 5],
  [5, 5],
]

// Four empty places fill one after another. The last one is picked and lifts.
function Generate() {
  return (
    <Scene box="-93.5 -37 187 151">
      {PLACES.map(([x, y], i) => {
        const picked = i === PLACES.length - 1
        return (
          <g key={`${x},${y}`}>
            <polygon className={styles.ghost} points={topFace(x, y, 4, 4, 0)} />
            <g className={picked ? styles.pick : undefined}>
              <Box
                at={[x, y, 4, 4, 0, 0.6]}
                className={cx(styles.rise, delay(i + 1), picked && styles.acc)}
              >
                <g className={styles.glyph} transform={glyphMatrix(x + 0.5, y + 0.5, 0.6)}>
                  {GLYPHS[i]}
                </g>
              </Box>
            </g>
          </g>
        )
      })}
    </Scene>
  )
}

// Tower heights: back, right, left, front.
const H = [5.1, 3.6, 0.6, 2.1] as const

function Tower({ x, y, h, d }: { x: number; y: number; h: number; d: number }) {
  return (
    <Box at={[x, y, 2.6, 2.6, 0, h]}>
      <polygon className={cx(styles.glow, delay(d))} points={topFace(x, y, 2.6, 2.6, h)} />
    </Box>
  )
}

// Four towers, each a step higher than the last, joined by stairs in a ring. A glow goes round.
function Linked() {
  return (
    <Scene box="-93.5 -60 187 151" className={styles.linked}>
      <Tower x={0} y={0} h={H[0]} d={4} />
      <Line through={stairs([2.6, 1.3, H[0]], [6, 1.3, H[1]], 4)} />
      <Line through={stairs([1.3, 6, H[2]], [1.3, 2.6, H[0]], 6)} />
      <Tower x={6} y={0} h={H[1]} d={3} />
      <Tower x={0} y={6} h={H[2]} d={1} />
      <Line through={stairs([7.3, 2.6, H[1]], [7.3, 6, H[3]], 4)} />
      <Line through={stairs([2.6, 7.3, H[2]], [6, 7.3, H[3]], 4)} />
      <Tower x={6} y={6} h={H[3]} d={2} />
    </Scene>
  )
}

export function StartDrawings() {
  return (
    <div className={styles.row} aria-hidden="true">
      <Branch />
      <Generate />
      <Linked />
    </div>
  )
}

// spec/editor.md, "Moving, resizing and rotating" and "Snapping and guides" [FR-092, FR-096]:
// a press on a layer picks it and may move it; a press on a handle resizes or turns the
// selected layer. The moving values live in the variant store's draft; the release sends one
// layer.update. Escape cancels and sends nothing. Alt turns snapping off for that moment.
import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantStore } from '@/renderer/stores/variant-store'
import {
  PULL,
  boundsOf,
  moveBox,
  pickLayer,
  resizeBox,
  turnBox,
  type Box,
  type Handle,
  type Point,
} from '@/renderer/editor/geometry-math'
import { snapLines, snapMove, snapResize, type Guides, type Lines } from '@/renderer/editor/snap'
import { sendGeometry, type Command } from './send-geometry'

export type Grip = Handle | 'rotate'

type Args = {
  projectId: string
  store: VariantStore
  command: Command
  layers: LayerRow[]
  size: { width: number; height: number }
  scale: number
  stage: RefObject<HTMLElement | null>
  onSelect: (layerId: string) => void
  beforeDrag: () => void
}

type Drag = {
  layerId: string
  grip: Grip | 'move'
  start: Box
  client: Point // where the press was, in screen pixels
  from: Point // where the press was, in variant pixels
  lines: Lines
  moving: boolean
  stop: () => void
}

const MOVE_THRESHOLD_PX = 3
const NO_GUIDES: Guides = { x: null, y: null }

function snappedResize(box: Box, grip: Handle, lines: Lines, scale: number) {
  const { bounds, guides } = snapResize(boundsOf(box), PULL[grip], lines, scale)
  const width = Math.max(1, bounds.right - bounds.left)
  const height = Math.max(1, bounds.bottom - bounds.top)
  return { box: { ...box, x: bounds.left, y: bounds.top, width, height }, guides }
}

export function useCanvasDrag(args: Args) {
  const latest = useRef(args)
  useLayoutEffect(() => {
    latest.current = args
  })
  const drag = useRef<Drag | null>(null)
  // A drag's release also makes a click; that click must not pick or clear.
  const dragged = useRef(false)
  const [guides, setGuides] = useState<Guides>(NO_GUIDES)

  function variantPoint(clientX: number, clientY: number): Point {
    const rect = latest.current.stage.current?.getBoundingClientRect()
    const { scale } = latest.current
    return { x: (clientX - (rect?.left ?? 0)) / scale, y: (clientY - (rect?.top ?? 0)) / scale }
  }

  function onMove(event: PointerEvent) {
    const d = drag.current
    if (!d) return
    const { scale, store } = latest.current
    const screen = { x: event.clientX - d.client.x, y: event.clientY - d.client.y }
    if (!d.moving && d.grip === 'move' && Math.hypot(screen.x, screen.y) < MOVE_THRESHOLD_PX) return
    d.moving = true
    dragged.current = true
    const delta = { x: screen.x / scale, y: screen.y / scale }
    const snap = !event.altKey
    if (d.grip === 'rotate') {
      const centre = { x: d.start.x + d.start.width / 2, y: d.start.y + d.start.height / 2 }
      const to = variantPoint(event.clientX, event.clientY)
      const rotation = turnBox(d.start.rotation, centre, d.from, to, event.shiftKey)
      store.getState().setDraft(d.layerId, { rotation })
      return
    }
    if (d.grip === 'move') {
      let box = moveBox(d.start, delta)
      let found = NO_GUIDES
      if (snap) {
        const snapped = snapMove(boundsOf(box), d.lines, scale)
        box = moveBox(box, snapped.offset)
        found = snapped.guides
      }
      setGuides(found)
      store.getState().setDraft(d.layerId, { x: box.x, y: box.y })
      return
    }
    let box = resizeBox(d.start, d.grip, delta, event.shiftKey)
    let found = NO_GUIDES
    // Edges snap only on an unturned box resized freely: a turned box's edges are not its sides.
    if (snap && !event.shiftKey && d.start.rotation === 0) {
      const snapped = snappedResize(box, d.grip, d.lines, scale)
      box = snapped.box
      found = snapped.guides
    }
    setGuides(found)
    const { x, y, width, height } = box
    store.getState().setDraft(d.layerId, { x, y, width, height })
  }

  function finish(send: boolean) {
    const d = drag.current
    if (!d) return
    d.stop()
    drag.current = null
    setGuides(NO_GUIDES)
    const { store, command, projectId } = latest.current
    if (send) void sendGeometry(store, command, projectId)
    else store.getState().dropDraft()
  }

  function begin(layer: LayerRow, grip: Drag['grip'], event: ReactPointerEvent) {
    latest.current.beforeDrag()
    const { layers, size } = latest.current
    const others = layers.filter((l) => l.visible && l.id !== layer.id).map((l) => l.geometry)
    const up = () => finish(true)
    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    drag.current = {
      layerId: layer.id,
      grip,
      start: layer.geometry,
      client: { x: event.clientX, y: event.clientY },
      from: variantPoint(event.clientX, event.clientY),
      lines: snapLines(size, others),
      moving: false,
      stop,
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return {
    guides,
    active: () => drag.current !== null,
    cancel: () => finish(false),
    // A press on the Scene: picks the layer under the pointer and gets ready to move it.
    pressLayer(event: ReactPointerEvent) {
      dragged.current = false
      if (event.button !== 0 || drag.current) return
      const id = pickLayer(latest.current.layers, variantPoint(event.clientX, event.clientY))
      const layer = latest.current.layers.find((l) => l.id === id)
      if (!layer) return
      latest.current.onSelect(layer.id)
      begin(layer, 'move', event)
    },
    // A press on a handle of the selected layer.
    pressGrip(layer: LayerRow, grip: Grip, event: ReactPointerEvent) {
      event.stopPropagation()
      event.preventDefault()
      dragged.current = false
      if (event.button !== 0 || drag.current || layer.locked) return
      begin(layer, grip, event)
    },
    // True once after a drag: the click its release makes is not a pick.
    takeClick(): boolean {
      const was = dragged.current
      dragged.current = false
      return was
    },
  }
}

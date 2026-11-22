import { useEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import type { SceneAsset, SceneProps } from '@/shared/scene/types'
import { registerDefaultFont, useSceneFonts, type SceneFont } from '@/shared/scene/font-faces'
import { measureOverflow } from '@/shared/scene/measure-overflow'
import { measuredText } from '@/shared/scene/measure-text'
import { PictureLayer } from '@/shared/scene/picture-layer'
import { ClipTrack } from '@/shared/scene/clip-track'
import { clipAt } from '@/shared/scene/clip-at'
import { TextLayer } from '@/shared/scene/text-layer'
import { drawnTime, visibleAt } from '@/shared/scene/timing'
import { pictureLookOf, textLookOf } from '@/shared/config/look'
import { shadeCss } from '@/shared/scene/shade-css'

// spec/scene.md "The Scene component": draws one variant in variant pixels. The editor, the
// render window and export all draw with it [FR-130]. Inline styles only: every value comes
// from the layer data, never from the app's tokens.
registerDefaultFont()

// Each text layer's two elements: the box and the text inside it ("Text boxes").
type TextParts = { box?: HTMLDivElement; text?: HTMLDivElement }
type TextBoxes = Map<string, TextParts>

const isTextStyle = (style: LayerRow['style']): style is TextStyle => 'fontSize' in style

// Lowest z first; equal z (a damaged file) by ID.
function drawOrder(layers: LayerRow[]): LayerRow[] {
  return [...layers].sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// A-202 (P8-17): overlay-only leaves out the background's picture, clip and colour, but draws
// its shade, as PictureLayer and ClipTrack draw it over their picture, so text over a video
// keeps it. A background with no usable shade draws nothing. On a video variant the shade is
// drawn only where a clip covers the time: in a gap ClipTrack draws an empty box, so does this.
type ShadeOnlyProps = { layer: LayerRow; box: CSSProperties; covered: boolean }

function ShadeOnly({ layer, box, covered }: ShadeOnlyProps) {
  const look = 'opacity' in layer.style ? pictureLookOf(layer.style) : null
  const shade = shadeCss(look?.shade)
  if (!covered || !look || !shade) return null
  return (
    <div data-shade-of={layer.id} style={{ ...box, overflow: 'hidden', opacity: look.opacity }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...shade }} />
    </div>
  )
}

function usableAsset(
  assets: SceneProps['assets'],
  id: string | null | undefined,
  kind: SceneAsset['kind'],
): SceneAsset | null {
  const asset = id ? assets[id] : undefined
  return asset && !asset.missing && asset.kind === kind ? asset : null
}

function fontsOf(layers: LayerRow[], assets: SceneProps['assets']): SceneFont[] {
  return layers.flatMap((layer) => {
    const id = layer.type === 'text' && isTextStyle(layer.style) ? layer.style.fontAssetId : null
    const asset = usableAsset(assets, id, 'font')
    return id && asset ? [{ assetId: id, url: asset.url, version: asset.version }] : []
  })
}

// A layer outside its time (phase-07.md "Presets") is hidden like an invisible one: it keeps its
// place and its text can still be measured.
function boxCss(layer: LayerRow, outsideTime: boolean): CSSProperties {
  const { x, y, width, height, rotation } = layer.geometry
  return {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: '50% 50%',
    visibility: layer.visible && !outsideTime ? undefined : 'hidden',
  }
}

// "Settling and the overflow measurement": the text element against the box's inner area.
function overflows(layer: LayerRow, textBoxes: TextBoxes): boolean {
  const { box, text } = textBoxes.get(layer.id) ?? {}
  if (!box || !text || !isTextStyle(layer.style)) return false
  return measureOverflow(measuredText(box, text, textLookOf(layer.style).boxPadding))
}

const twoFrames = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))

// After each change of layers, assets or the clip drawn (P7-8): wait for fonts, pictures and
// the clip track, two frames, then measure every text layer. A settle that a newer change
// overtook is dropped.
function useSettle(
  root: RefObject<HTMLDivElement | null>,
  textBoxes: RefObject<TextBoxes>,
  props: Pick<SceneProps, 'layers' | 'assets' | 'onSettled'>,
  track: { ready: RefObject<Promise<void>>; key: string },
  fontsReady: Promise<void>,
) {
  const { layers, assets, onSettled } = props
  const report = useRef(onSettled)
  useEffect(() => {
    report.current = onSettled
  }, [onSettled])
  useEffect(() => {
    let current = true
    const images = [...(root.current?.querySelectorAll('img') ?? [])]
    const decoded = images.map((img) => img.decode().catch(() => undefined))
    Promise.all([registerDefaultFont(), fontsReady, track.ready.current, ...decoded])
      .then(twoFrames)
      .then(() => {
        if (!current) return
        const overflow: Record<string, boolean> = {}
        for (const layer of layers) {
          if (layer.type !== 'text') continue
          overflow[layer.id] = Boolean(layer.copy) && overflows(layer, textBoxes.current)
        }
        report.current?.({ overflow })
      })
    return () => {
      current = false
    }
  }, [root, textBoxes, layers, assets, fontsReady, track.ready, track.key])
}

// A clip is drawn from a picture or a video that is not missing; anything else draws black.
function clipAsset(assets: SceneProps['assets'], id: string | undefined): SceneAsset | null {
  return usableAsset(assets, id, 'image') ?? usableAsset(assets, id, 'video')
}

export function Scene(props: SceneProps) {
  const { variant, layers, assets, timeMs, mode, onSettled } = props
  const root = useRef<HTMLDivElement>(null)
  const textBoxes = useRef<TextBoxes>(new Map())
  const trackReady = useRef<Promise<void>>(Promise.resolve())
  const fonts = useMemo(() => fontsOf(layers, assets), [layers, assets])
  const fontsReady = useSceneFonts(fonts)
  // Timing, presets and the clip track apply to a video variant only [A-188].
  const t = drawnTime(variant, timeMs)
  const found = t === null ? null : clipAt(props.clips ?? [], t, variant.durationMs)
  const playing = props.playing ?? false
  // While playing, the moving clip does not settle the Scene again.
  const trackKey = playing || !found ? String(playing) : `${found.clip.id}@${found.sourceMs}`
  const track = { ready: trackReady, key: trackKey }
  useSettle(root, textBoxes, { layers, assets, onSettled }, track, fontsReady)

  const keep = (id: string, part: keyof TextParts) => (element: HTMLDivElement | null) => {
    const parts = { ...textBoxes.current.get(id), [part]: element ?? undefined }
    if (parts.box || parts.text) textBoxes.current.set(id, parts)
    else textBoxes.current.delete(id)
  }
  const style: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: variant.width,
    height: variant.height,
    backgroundColor: mode === 'full' ? '#000000' : 'transparent',
  }
  const size = { width: variant.width, height: variant.height }
  return (
    <div ref={root} lang={variant.language} style={style}>
      {drawOrder(layers).map((layer) => {
        const box = boxCss(layer, t !== null && !visibleAt(layer, t, variant.durationMs))
        if (layer.type === 'background' && mode === 'overlay-only') {
          const covered = t === null || found !== null
          return <ShadeOnly key={layer.id} layer={layer} box={box} covered={covered} />
        }
        if (layer.type === 'background' && t !== null) {
          const clip = { found, asset: found && clipAsset(assets, found.clip.assetId) }
          const how = { playing, sound: props.sound ?? false, readyRef: trackReady }
          return <ClipTrack key={layer.id} layer={layer} box={box} {...clip} {...how} />
        }
        if (layer.type !== 'text') {
          const asset = usableAsset(assets, layer.source?.assetId, 'image')
          return <PictureLayer key={layer.id} layer={layer} box={box} asset={asset} />
        }
        if (!isTextStyle(layer.style)) return null
        const refs = { boxRef: keep(layer.id, 'box'), textRef: keep(layer.id, 'text') }
        const time = { timeMs: t, variantSize: size }
        return (
          <TextLayer
            key={layer.id}
            layer={layer}
            style={layer.style}
            box={box}
            {...refs}
            {...time}
          />
        )
      })}
    </div>
  )
}

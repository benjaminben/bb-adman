import { useEffect, useMemo, useRef, type CSSProperties, type RefObject } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import type { SceneAsset, SceneMode, SceneProps } from '@/shared/scene/types'
import { registerDefaultFont, useSceneFonts, type SceneFont } from '@/shared/scene/font-faces'
import { measureOverflow } from '@/shared/scene/measure-overflow'
import { measuredText } from '@/shared/scene/measure-text'
import { PictureLayer } from '@/shared/scene/picture-layer'
import { TextLayer } from '@/shared/scene/text-layer'
import { textLookOf } from '@/shared/config/look'

// spec/scene.md "The Scene component": draws one variant in variant pixels. The editor, the
// render window and export all draw with it [FR-130]. Inline styles only: every value comes
// from the layer data, never from the app's tokens.
registerDefaultFont()

// Each text layer's two elements: the box and the text inside it ("Text boxes").
type TextParts = { box?: HTMLDivElement; text?: HTMLDivElement }
type TextBoxes = Map<string, TextParts>

const isTextStyle = (style: LayerRow['style']): style is TextStyle => 'fontSize' in style

// Lowest z first; equal z (a damaged file) by ID. Overlay-only leaves out the background.
function drawOrder(layers: LayerRow[], mode: SceneMode): LayerRow[] {
  const kept = mode === 'full' ? layers : layers.filter((layer) => layer.type !== 'background')
  return [...kept].sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
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

function boxCss(layer: LayerRow): CSSProperties {
  const { x, y, width, height, rotation } = layer.geometry
  return {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: '50% 50%',
    visibility: layer.visible ? undefined : 'hidden',
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

// After each change of layers or assets: wait for fonts and pictures, two frames, then
// measure every text layer. A settle that a newer change overtook is dropped.
function useSettle(
  root: RefObject<HTMLDivElement | null>,
  textBoxes: RefObject<TextBoxes>,
  props: Pick<SceneProps, 'layers' | 'assets' | 'onSettled'>,
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
    Promise.all([registerDefaultFont(), fontsReady, ...decoded])
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
  }, [root, textBoxes, layers, assets, fontsReady])
}

export function Scene({ variant, layers, assets, mode, onSettled }: SceneProps) {
  const root = useRef<HTMLDivElement>(null)
  const textBoxes = useRef<TextBoxes>(new Map())
  const fonts = useMemo(() => fontsOf(layers, assets), [layers, assets])
  const fontsReady = useSceneFonts(fonts)
  useSettle(root, textBoxes, { layers, assets, onSettled }, fontsReady)

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
  return (
    <div ref={root} lang={variant.language} style={style}>
      {drawOrder(layers, mode).map((layer) => {
        const box = boxCss(layer)
        if (layer.type !== 'text') {
          const asset = usableAsset(assets, layer.source?.assetId, 'image')
          return <PictureLayer key={layer.id} layer={layer} box={box} asset={asset} />
        }
        if (!isTextStyle(layer.style)) return null
        const refs = { boxRef: keep(layer.id, 'box'), textRef: keep(layer.id, 'text') }
        return <TextLayer key={layer.id} layer={layer} style={layer.style} box={box} {...refs} />
      })}
    </div>
  )
}

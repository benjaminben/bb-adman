// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): what the Assets panel says about one
// file. Its kind's icon, its detail line ("1080×1920 · 1:05", "Family: …") and its marks. The
// marks are icon StatusMarks whose words stay in the tooltip and as hidden text, except "File
// not found": a failure keeps its words on the page (orchestrator's ruling).
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import type { IconName } from '@/renderer/ui/icon'
import { StatusMark, type StatusTone } from '@/renderer/ui/status-mark'

export const NOT_FOUND = 'File not found'

export const KIND_ICONS: Record<AssetView['kind'], IconName> = {
  image: 'image',
  video: 'film',
  font: 'text',
  audio: 'file',
  text: 'file',
}

function length(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function assetSize(asset: AssetView): string | null {
  return asset.width && asset.height ? `${asset.width}×${asset.height}` : null
}

export function assetDetail(asset: AssetView): string | null {
  if (asset.kind === 'font') return asset.fontFamily ? `Family: ${asset.fontFamily}` : null
  if (asset.kind !== 'image' && asset.kind !== 'video') return null
  const size = assetSize(asset)
  const time = asset.kind === 'video' && asset.durationMs !== null ? length(asset.durationMs) : null
  return [size, time].filter((part) => part !== null).join(' · ') || null
}

type Mark = { on: boolean; words: string; tone: StatusTone; icon: IconName; shown?: boolean }

// A missing picture says so on its tile, so only the other kinds carry the "File not found"
// mark (one place for the words).
function marks(asset: AssetView): Mark[] {
  const all: Mark[] = [
    { on: asset.origin === 'generated', words: 'Made with AI', tone: 'info', icon: 'sparkle' },
    { on: asset.storage === 'linked', words: 'Linked', tone: 'none', icon: 'link' },
    { on: asset.library === 'reference', words: 'Reference only', tone: 'none', icon: 'book' },
    {
      on: asset.missing && asset.kind !== 'image',
      words: NOT_FOUND,
      tone: 'warn',
      icon: 'alert',
      shown: true,
    },
  ]
  return all.filter((mark) => mark.on)
}

export function hasMarks(asset: AssetView): boolean {
  return marks(asset).length > 0
}

export function AssetMarks({ asset }: { asset: AssetView }) {
  return (
    <>
      {marks(asset).map((mark) => (
        <StatusMark
          key={mark.words}
          tone={mark.tone}
          icon={mark.icon}
          tip={mark.words}
          label={mark.shown ? mark.words : undefined}
        />
      ))}
    </>
  )
}

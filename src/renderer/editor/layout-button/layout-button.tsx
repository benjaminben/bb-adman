// spec/editor.md "Top bar" (LK-6) [D-094]: "Layout…", after "Place text with AI…", opens the
// layout dialog for the open variant with its layers and assets as the canvas draws them.
import { useState } from 'react'
import { LayoutDialog } from '@/renderer/dialogs/layout-dialog'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { Icon } from '@/renderer/ui/icon'

export type LayoutButtonProps = {
  projectId: string
  variant: VariantSummary
  layers: LayerRow[]
  assets: Readonly<Record<string, SceneAsset>>
}

export function LayoutButton(props: LayoutButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        <Icon name="grid" size="small" />
        Layout…
      </button>
      <LayoutDialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

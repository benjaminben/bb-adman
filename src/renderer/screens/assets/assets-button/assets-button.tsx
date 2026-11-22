// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "How it opens"): opens and closes
// the project's Assets panel. "Open assets" on the project page, "Assets" in the campaign head.
// Drawn only inside the scope of its own project. HOME-1: with `icon`, a square button with
// the "right" icon, named and titled by its label (the project home's Assets header). CAMP-3:
// `glyph` picks another icon for that square button (the campaign head's `box`).
import { useRef } from 'react'
import { ASSETS_PANEL_ID, useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './assets-button.module.css'

export type AssetsButtonProps = {
  projectId: string
  label?: string
  icon?: boolean
  glyph?: IconName
}

export function AssetsButton(props: AssetsButtonProps) {
  const { projectId, label = 'Assets', icon = false, glyph = 'right' } = props
  const panel = useAssetsPanel()
  const ref = useRef<HTMLButtonElement>(null)
  if (panel === null || panel.projectId !== projectId) return null
  return (
    <button
      ref={ref}
      type="button"
      className={icon ? `${layout.iconButton} ${styles.button}` : styles.button}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      aria-expanded={panel.open}
      aria-controls={panel.open ? ASSETS_PANEL_ID : undefined}
      onClick={() => (panel.open ? panel.hide() : panel.show(ref.current))}
    >
      {icon ? (
        <Icon name={glyph} />
      ) : (
        <>
          <Icon name="box" />
          {label}
        </>
      )}
    </button>
  )
}

// "Fonts" in the publish dialog (spec/phases/phase-09.md "Screens", "Font sharing consent is
// local"; A-229, A-260). Each font's "I am allowed to share this font" shows ticked only when
// publish.inspect says `confirmed`: the project file's flag never ticks it. A tick sends
// publish.setFontConsent with the hash publish.inspect measured, so the consent is for the
// bytes the user was shown; then asset.update as a hint; then the parent reads the list again.
// Unticking takes the consent back the same way. A refusal shows its sentence and stops there.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { PublishInspectComponent } from '@/shared/schemas/queries/publish'
import layout from '@/renderer/ui/layout.module.css'
import styles from './font-share-choice.module.css'

export type FontShareChoiceProps = {
  projectId: string
  fonts: PublishInspectComponent[]
  disabled?: boolean
  onChanged: () => void
}

const CONFIRM_LINE = 'This project file says the font may be shared. Confirm it on this computer.'

export function FontShareChoice(props: FontShareChoiceProps) {
  const command = useApp((s) => s.command)
  const [sending, setSending] = useState<string | null>(null)
  const [refused, setRefused] = useState<{ assetId: string; message: string } | null>(null)

  async function change(font: PublishInspectComponent, allowed: boolean) {
    const { projectId } = props
    const assetId = font.assetId
    setSending(assetId)
    setRefused(null)
    const hash = font.sha256 === null ? {} : { sha256: font.sha256 }
    const consent = await command('publish.setFontConsent', {
      projectId,
      assetId,
      allowed,
      ...hash,
    })
    const hint = consent.ok
      ? await command('asset.update', { projectId, assetId, fontPublishAllowed: allowed })
      : consent
    if (!hint.ok) setRefused({ assetId, message: hint.error.message })
    setSending(null)
    props.onChanged()
  }

  return (
    <section aria-label="Fonts" className={styles.fonts}>
      <h3 className={styles.heading}>Fonts</h3>
      {props.fonts.map((font) => (
        <div key={font.assetId} role="group" aria-label={font.displayName} className={styles.font}>
          <span className={styles.name}>{font.displayName}</span>
          <label className={styles.choice}>
            <input
              type="checkbox"
              checked={font.share === 'confirmed'}
              disabled={props.disabled === true || sending !== null || font.problem !== null}
              onChange={(e) => void change(font, e.target.checked)}
            />
            I am allowed to share this font
          </label>
          {font.share === 'needs_confirming' && <p className={styles.line}>{CONFIRM_LINE}</p>}
          {refused?.assetId === font.assetId && (
            <p role="alert" className={`${layout.notice} ${layout.danger}`}>
              {refused.message}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}

// The logo, colours and fonts of the "Brand and layout" Section (spec/brief-brand.md, "What it
// shows", items 3 to 5; A-399). The form adds no brand file of its own: each ✕ only removes.
// A file shows by its display name or font family, never by its path; the logo is drawn
// through assetUrl.
import type { BrandRole } from '@/shared/schemas/commands/brief'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { BrandChoice } from '@/renderer/screens/project-home/brief-form-brand'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brand-fields.module.css'

type Props = {
  projectId: string
  brand: BrandChoice
  images: AssetList
  fonts: AssetList
  onRemove: (role: BrandRole) => void
  onColours: (colours: string[]) => void
}

const FONT_LINES = [
  { role: 'headingFont', label: 'Headline', remove: 'Remove headline font' },
  { role: 'bodyFont', label: 'Other text', remove: 'Remove font for other text' },
] as const

function RemoveButton(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      <Icon name="x" size="small" />
    </button>
  )
}

function Hint(props: { text: string }) {
  return <p className={styles.hint}>{props.text}</p>
}

export function BrandFiles(props: Props) {
  const { brand, projectId } = props
  const fontName = (assetId: string) => {
    const font = props.fonts.find((f) => f.id === assetId)
    return font?.fontFamily ?? font?.displayName ?? ''
  }
  const logoName = brand.logo
    ? (props.images.find((a) => a.id === brand.logo?.assetId)?.displayName ?? '')
    : ''

  return (
    <>
      <div className={styles.part}>
        <span className={layout.label}>Logo</span>
        {brand.logo ? (
          <div className={styles.row}>
            <img className={styles.thumb} src={assetUrl(projectId, brand.logo.assetId)} alt="" />
            <span>{logoName}</span>
            <RemoveButton label="Remove logo" onClick={() => props.onRemove('logo')} />
          </div>
        ) : (
          <p className={styles.line}>No logo.</p>
        )}
        <Hint text="The logo is a required file of the campaign and fills the logo spot." />
      </div>
      <div className={styles.part}>
        <span className={layout.label}>Colours</span>
        {brand.colours.length > 0 ? (
          <ul className={styles.chips} aria-label="Brand colours">
            {brand.colours.map((hex) => (
              <li key={hex} className={styles.chip}>
                <span className={styles.swatch} style={{ background: hex }} />
                {hex}
                <RemoveButton
                  label={`Remove colour ${hex}`}
                  onClick={() => props.onColours(brand.colours.filter((c) => c !== hex))}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.line}>No colours.</p>
        )}
        <Hint text="These become the campaign's colours. The colour check then flags text in any other colour." />
      </div>
      <div className={styles.part}>
        <span className={layout.label}>Fonts</span>
        {FONT_LINES.map(({ role, label, remove }) => {
          const font = brand[role]
          return (
            <div key={role} className={styles.row}>
              <span>{`${label}: ${font ? fontName(font.assetId) : 'Default font (Inter)'}`}</span>
              {font && <RemoveButton label={remove} onClick={() => props.onRemove(role)} />}
            </div>
          )
        })}
        <Hint
          text={
            'A font from a brief is not shared when you publish until you tick "I am allowed to share this font".'
          }
        />
      </div>
    </>
  )
}

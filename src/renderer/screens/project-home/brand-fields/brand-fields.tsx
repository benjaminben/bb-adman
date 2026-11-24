// The brief form's "Brand and layout" Section (spec/brief-brand.md, "The brief form", "What it
// shows"): the starting layout and its description, the art direction, the logo, colours and
// fonts (brand-files.tsx), then the notes. It opens unfolded when, at open, the brand holds
// anything the brief gave; else folded. Removing a file sends asset.remove for the assets
// removedBrandAssets names (A-396); a refusal is ignored, as for a photo (A-111).
import { useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import {
  DEFAULT_STARTER_LAYOUT_ID,
  STARTER_LAYOUTS,
  starterLayoutOf,
} from '@/shared/config/starter-layouts'
import type { AdmanApi } from '@/shared/schemas/api'
import type { BrandRole } from '@/shared/schemas/commands/brief'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import type { ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'
import {
  removedBrandAssets,
  type BrandChoice,
} from '@/renderer/screens/project-home/brief-form-brand'
import { Icon } from '@/renderer/ui/icon'
import { Section, type SectionFold } from '@/renderer/ui/section'
import { writeFold } from '@/renderer/ui/section/fold-memory'
import { plural } from '@/renderer/ui/plural'
import layout from '@/renderer/ui/layout.module.css'
import { BrandFiles } from './brand-files'
import { useProjectFonts } from './use-project-fonts'
import styles from './brand-fields.module.css'

const FOLD_ID = 'brief.brand'

type Props = {
  projectId: string
  values: BriefFormValues
  images: ProjectImages
  onChange: (brand: BrandChoice) => void
}

// asset.remove for each ID; a refusal is ignored and the asset stays in the project (A-111).
export function removeBrandAssets(api: AdmanApi, projectId: string, assetIds: string[]) {
  for (const assetId of assetIds) void api.command('asset.remove', { projectId, assetId })
}

function holdsAnything(brand: BrandChoice): boolean {
  return (
    brand.logo !== null ||
    brand.headingFont !== null ||
    brand.bodyFont !== null ||
    brand.colours.length > 0 ||
    brand.artDirection.trim() !== '' ||
    brand.notes.length > 0 ||
    brand.layoutId !== DEFAULT_STARTER_LAYOUT_ID
  )
}

function summary(brand: BrandChoice, layoutName: string): string {
  const fonts = [brand.headingFont, brand.bodyFont].filter((f) => f !== null).length
  return [
    layoutName,
    brand.colours.length > 0 ? plural(brand.colours.length, 'colour') : null,
    brand.logo !== null ? 'logo' : null,
    fonts > 0 ? plural(fonts, 'font') : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

export function BrandFields(props: Props) {
  const api = useApi()
  const { brand } = props.values
  const ids = useId()
  const fonts = useProjectFonts(
    props.projectId,
    brand.headingFont !== null || brand.bodyFont !== null,
  )
  // The fold follows the brand the form opened with, each time the form opens.
  const [fold] = useState((): SectionFold => {
    const open = holdsAnything(brand)
    writeFold(FOLD_ID, open)
    return open ? 'open' : 'closed'
  })
  const chosen = starterLayoutOf(brand.layoutId) ?? STARTER_LAYOUTS[0]
  const set = (patch: Partial<BrandChoice>) => props.onChange({ ...brand, ...patch })

  function remove(role: BrandRole) {
    removeBrandAssets(api, props.projectId, removedBrandAssets(props.values, [role]))
    set({ [role]: null })
  }

  return (
    <Section
      id={FOLD_ID}
      title="Brand and layout"
      fold={fold}
      summary={summary(brand, chosen?.name ?? '')}
    >
      <div className={styles.body}>
        <div className={styles.part}>
          <label className={layout.label} htmlFor={`${ids}-layout`}>
            Layout
          </label>
          <select
            id={`${ids}-layout`}
            aria-label="Starting layout"
            className={styles.select}
            value={brand.layoutId}
            onChange={(e) => set({ layoutId: e.target.value })}
          >
            {STARTER_LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <p className={styles.hint}>{chosen?.description}</p>
        </div>
        <div className={styles.part}>
          <label className={layout.label} htmlFor={`${ids}-art`}>
            Art direction (optional)
          </label>
          <textarea
            id={`${ids}-art`}
            rows={2}
            className={styles.text}
            value={brand.artDirection}
            onChange={(e) => set({ artDirection: e.target.value })}
          />
          <p className={styles.hint}>Added to the first picture prompt of each ad.</p>
        </div>
        <BrandFiles
          projectId={props.projectId}
          brand={brand}
          images={props.images ?? []}
          fonts={fonts}
          onRemove={remove}
          onColours={(colours) => set({ colours })}
        />
        {brand.notes.length > 0 && (
          <div className={`${layout.notice} ${layout.warn} ${styles.notes}`}>
            <Icon name="alert" />
            <ul aria-label="Notes on the brand">
              {brand.notes.map((line, k) => (
                <li key={k}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  )
}

// DLG-4b: the fan-out dialog's three chip rows, Sizes, Languages and Formats (spec/screens-
// variants.md, "Fan-out"; data-rules fan-out step 7). The master's size and language are pressed
// and fixed; at least one format stays on. A size chip is named "{label} ({width}×{height})" and
// gives its pixels in `title`.
import { Icon } from '@/renderer/ui/icon'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { ChipGroup, SizeFace } from './chip-group'
import { sizeName } from './fit-choices'
import type { FanOutBasis, FanOutTicks } from './fan-out-model'

const FORMATS = [
  { id: 'image', name: 'Image', icon: 'image' },
  { id: 'video', name: 'Video', icon: 'film' },
] as const

const sizeChip = (s: CampaignSize, master: string) => ({
  id: s.label,
  name: sizeName(s),
  label: <SizeFace label={s.label} width={s.width} height={s.height} />,
  title: `${s.width}×${s.height}`,
  fixed: s.label === master ? "The master's size" : undefined,
})

export function FanOutChips(props: {
  basis: FanOutBasis
  ticks: FanOutTicks
  formats: string[]
  disabled: boolean
  onTicks: (ticks: FanOutTicks) => void
  onFormats: (formats: string[]) => void
}) {
  const { basis, ticks, disabled } = props
  const { master } = basis
  return (
    <>
      <ChipGroup
        legend="Sizes"
        chips={basis.sizes.map((s) => sizeChip(s, master.sizeLabel))}
        on={ticks.sizes}
        disabled={disabled}
        onChange={(sizes) => props.onTicks({ ...ticks, sizes })}
      />
      <ChipGroup
        legend="Languages"
        chips={basis.languages.map((l) => ({
          id: l,
          name: l,
          label: l,
          fixed: l === master.language ? "The master's language" : undefined,
        }))}
        on={ticks.languages}
        disabled={disabled}
        onChange={(languages) => props.onTicks({ ...ticks, languages })}
      />
      <ChipGroup
        legend="Formats"
        chips={FORMATS.map((f) => ({
          id: f.id,
          name: f.name,
          label: (
            <>
              <Icon name={f.icon} size="small" />
              {f.name}
            </>
          ),
        }))}
        on={props.formats}
        disabled={disabled}
        keepOne="Choose at least one format"
        onChange={props.onFormats}
      />
    </>
  )
}

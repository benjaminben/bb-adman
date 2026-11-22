// spec/screens-variants.md, "Fan-out": the sizes and languages to add to a direction, each new
// size's background fit, and for a fill the provider select and the paid line. Nothing is sent
// before "Make variants"; no fill is started before variant.fanOut succeeds, and each goes to
// the provider the select shows. From the click until the reply the dialog is locked and
// cannot close; a refusal shows inside it (A-50). It sends images only (A-133).
import { useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { ProviderSelect } from '@/renderer/screens/campaign/provider-select'
import { useComfyInfoState } from '@/renderer/screens/campaign/use-comfy-info'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { VariantFanOutReply } from '@/shared/schemas/commands/variant'
import type { FanOutFit } from '@/shared/schemas/links'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { FitChoices, TickGroup, sizeName } from './fit-choices'
import * as model from './fan-out-model'
import styles from './fan-out.module.css'

export type FanOutDialogProps = {
  projectId: string
  direction: DirectionRow
  basis: model.FanOutBasis
  onClose: () => void
  onMade: (fill: VariantFanOutReply['fill'], provider: string) => void
}

const NONE: ProviderInfo[] = []

// Image providers that can run now; ComfyUI only with an offered `extend` workflow.
function fillProviders(providers: ProviderInfo[], info: ComfyInfo | null) {
  const extend = info?.workflows.find((w) => w.offered && w.job === 'extend')
  const listed = providers.filter((p) => p.available && p.jobs.includes('image'))
  return {
    list: listed.filter((p) => p.id !== 'comfyui' || extend),
    trial: extend?.status === 'trial',
  }
}

// Whether the master's background shows a picture; null until variant.get answers.
function useHasPicture(projectId: string, variantId: string): boolean | null {
  const api = useApi()
  const [picture, setPicture] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    void api.query('variant.get', { projectId, variantId }).then((r) => {
      const layers = r.ok ? (r.data as VariantGet).layers : []
      if (live) setPicture(layers.some((l) => l.type === 'background' && l.source !== null))
    })
    return () => {
      live = false
    }
  }, [api, projectId, variantId])
  return picture
}

export function FanOutDialog(props: FanOutDialogProps) {
  const { projectId, basis } = props
  const app = useApp((s) => s.app)
  const command = useApp((s) => s.command)
  const comfy = useComfyInfoState()
  const picture = useHasPicture(projectId, props.direction.masterVariantId)
  const [ticks, setTicks] = useState(() => model.startTicks(basis))
  const [chosen, setChosen] = useState<Record<string, FanOutFit>>({})
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const fits = model.fitsToSend(basis, ticks, chosen, picture === true)
  const fills = model.fillCount(fits)
  const count = model.newPairs(basis, ticks).length
  const providers = fillProviders(app?.providers ?? NONE, comfy.info)
  const preferred = app?.settings.defaultProviders.image
  const provider =
    providers.list.find((p) => p.id === picked) ??
    providers.list.find((p) => p.id === preferred) ??
    providers.list[0]
  const ready = picture !== null && count > 0 && (fills === 0 || provider !== undefined)

  async function send() {
    const fillProvider = provider?.id
    setBusy(true)
    setRefusal(null)
    const lists = model.fanOutLists(basis, ticks)
    const input = { projectId, directionId: props.direction.id, ...lists, formats: ['image'], fits }
    const reply = await command('variant.fanOut', input)
    setBusy(false)
    if (!reply.ok) return setRefusal(reply.error.message)
    props.onClose()
    const { fill } = reply.data as VariantFanOutReply
    if (fill.length > 0 && fillProvider !== undefined) props.onMade(fill, fillProvider)
  }

  const footer = (
    <>
      <button type="button" disabled={busy} onClick={props.onClose}>
        Cancel
      </button>
      <button
        type="button"
        className={layout.primary}
        disabled={busy || !ready}
        onClick={() => void send()}
      >
        Make variants
      </button>
    </>
  )

  const master = basis.master
  return (
    <DialogFrame
      open
      onClose={props.onClose}
      title={`Fan out ${props.direction.name}`}
      closable={!busy}
      footer={footer}
    >
      <div className={styles.body}>
        <TickGroup
          legend="Sizes"
          items={basis.sizes.map((s) => ({
            id: s.label,
            label: sizeName(s),
            fixed: s.label === master.sizeLabel,
          }))}
          ticked={ticks.sizes}
          disabled={busy}
          onChange={(sizes) => setTicks({ ...ticks, sizes })}
        />
        <TickGroup
          legend="Languages"
          items={basis.languages.map((l) => ({ id: l, label: l, fixed: l === master.language }))}
          ticked={ticks.languages}
          disabled={busy}
          onChange={(languages) => setTicks({ ...ticks, languages })}
        />
        {picture === true && (
          <FitChoices
            sizes={model.fitSizes(basis, ticks)}
            fits={fits}
            disabled={busy}
            onChange={(label, fit) => setChosen({ ...chosen, [label]: fit })}
          />
        )}
        {fills > 0 && provider !== undefined && (
          <>
            <ProviderSelect
              label="Provider"
              providers={providers.list}
              value={provider.id}
              onChange={setPicked}
              trial={provider.id === 'comfyui' && providers.trial}
            />
            <p className={styles.line}>
              {`This will use ${fills} generation(s) with ${provider.label}.`}
            </p>
          </>
        )}
        {fills > 0 && provider === undefined && <p>No provider can do this yet.</p>}
        <p className={styles.line}>{`This makes ${count} variant(s).`}</p>
        {count === 0 && <p className={layout.muted}>Nothing new to make.</p>}
        {refusal !== null && (
          <p role="alert" className={`${layout.notice} ${layout.danger}`}>
            <Icon name="alert" size="small" />
            {refusal}
          </p>
        )}
      </div>
    </DialogFrame>
  )
}

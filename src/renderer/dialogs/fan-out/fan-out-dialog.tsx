// spec/screens-variants.md, "Fan-out": the sizes and languages to add to a direction, each new
// size's background fit, and for a fill the provider select. DLG-4b (choice C-15): "Make {n}
// variants" is the one click that pays. The cost lines (a MoneyLine when paid: the fills to the
// provider the select shows, the translations to the Settings text provider) are the body's
// last lines and in the dialog's accessible description, and they are computed from the same
// state the click sends, so they follow every chip. Nothing is sent before the click; no fill is
// started before variant.fanOut succeeds, and each goes to the provider shown at the click. From
// the click until the reply the dialog is locked and cannot close; a refusal shows inside it
// (A-50). Translation jobs in the reply are registered under the campaign (P6-15).
import { useId, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { ProviderSelect } from '@/renderer/screens/campaign/provider-select'
import { useComfyInfoState } from '@/renderer/screens/campaign/use-comfy-info'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { plural } from '@/renderer/ui/plural'
import type { VariantFanOutReply } from '@/shared/schemas/commands/variant'
import type { FanOutFit } from '@/shared/schemas/links'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { CostLine, fillProviders } from './cost-line'
import { fillCost, translationCost } from './fan-out-costs'
import { FanOutChips } from './fan-out-chips'
import * as model from './fan-out-model'
import { FitChoices } from './fit-choices'
import { useHasPicture } from './use-has-picture'
import styles from './fan-out.module.css'

export type FanOutDialogProps = {
  projectId: string
  direction: DirectionRow
  basis: model.FanOutBasis
  onClose: () => void
  onMade: (fill: VariantFanOutReply['fill'], provider: string) => void
}

const NONE: ProviderInfo[] = []

export function FanOutDialog(props: FanOutDialogProps) {
  const { projectId, basis } = props
  const api = useApi()
  const app = useApp((s) => s.app)
  const command = useApp((s) => s.command)
  const show = useApp((s) => s.show)
  const comfy = useComfyInfoState()
  const picture = useHasPicture(projectId, props.direction.masterVariantId)
  const [ticks, setTicks] = useState(() => model.startTicks(basis))
  const [ticked, setTicked] = useState<string[]>(['image'])
  const [chosen, setChosen] = useState<Record<string, FanOutFit>>({})
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const fillId = useId()
  const textId = useId()

  const fits = model.fitsToSend(basis, ticks, chosen, picture === true)
  const formats = model.formatsToSend(ticked)
  const count = model.newCells(basis, ticks, formats).length
  const fills = model.fillsSent(basis, ticks, fits, formats)
  const providers = fillProviders(app?.providers ?? NONE, comfy.info)
  const preferred = app?.settings.defaultProviders.image
  const provider =
    providers.list.find((p) => p.id === picked) ??
    providers.list.find((p) => p.id === preferred) ??
    providers.list[0]
  const textChoice = app?.settings.defaultProviders.text
  const text = app?.providers.find(
    (p) => p.id === textChoice && p.available && p.jobs.includes('text'),
  )
  const fillLine = provider ? fillCost(fills, provider, providers.models[provider.id]) : null
  const textLine = translationCost(model.translationCount(basis, ticks, formats), text ?? null)
  const noProvider = fills > 0 && provider === undefined
  const ready = picture !== null && count > 0 && !noProvider
  const described = [fillLine && fillId, textLine && textId].filter(Boolean).join(' ')

  async function send() {
    const fillProvider = provider?.id
    const shown = fillLine === null ? 0 : fills
    setBusy(true)
    setRefusal(null)
    const lists = model.fanOutLists(basis, ticks)
    const input = { projectId, directionId: props.direction.id, ...lists, formats, fits }
    const reply = await command('variant.fanOut', input)
    setBusy(false)
    if (!reply.ok) return setRefusal(reply.error.message)
    props.onClose()
    const { translationJobIds = [], ...made } = reply.data as VariantFanOutReply
    const fill = model.fillsToStart(made.fill, shown)
    const owner = { projectId, campaignId: props.direction.campaignId }
    for (const jobId of translationJobIds) attachedStoreFor(api).getState().register(jobId, owner)
    if (fill.length > 0 && fillProvider !== undefined) props.onMade(fill, fillProvider)
  }

  function openSettings() {
    props.onClose()
    show({ kind: 'settings' })
  }

  const footer = (
    <>
      <button type="button" className={layout.quiet} disabled={busy} onClick={props.onClose}>
        Cancel
      </button>
      <button
        type="button"
        className={layout.primary}
        disabled={busy || !ready}
        title={count === 0 ? 'Nothing new to make' : undefined}
        onClick={() => void send()}
      >
        {count === 0 ? 'Make variants' : `Make ${plural(count, 'variant')}`}
      </button>
    </>
  )

  return (
    <DialogFrame
      open
      onClose={props.onClose}
      title={`Make variants of ${props.direction.name}`}
      kind="run"
      describedBy={described || undefined}
      closable={!busy}
      footer={footer}
    >
      <div className={styles.body}>
        {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
        {noProvider && (
          <DialogAlert tone="warn" action={{ label: 'Settings', onClick: openSettings }}>
            No provider can do this yet.
          </DialogAlert>
        )}
        <FanOutChips
          basis={basis}
          ticks={ticks}
          formats={ticked}
          disabled={busy}
          onTicks={setTicks}
          onFormats={setTicked}
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
          <ProviderSelect
            label="Provider"
            providers={providers.list}
            models={providers.models}
            value={provider.id}
            onChange={setPicked}
            trial={provider.id === 'comfyui' && providers.trial}
          />
        )}
        <CostLine id={fillId} cost={fillLine} />
        <CostLine id={textId} cost={textLine} />
      </div>
    </DialogFrame>
  )
}

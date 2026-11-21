// The picture panel (SPEC 14 1.41 TP-2 "The panel"): provider, slot, prompt and count, then
// generation.runImages. A provider whose `local` is false gets the confirm line first. The
// providers come from app.getState, so a second picture provider shows here with no change.
// SPEC 14 1.46 TP-5: the reference picker sits under the prompt box; the ticked IDs, held by
// the campaign page, go into referenceAssetIds in tick order.
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'
import { prefilledPrompt } from '@/shared/generation/prompt'
import { generationRunImagesInput } from '@/shared/schemas/commands/generation'
import type { CampaignGet, TemplateSlots } from '@/shared/schemas/queries/campaign'
import type { GenerationRunImagesInput } from '@/shared/schemas/commands/generation'
import { PaidConfirm } from '@/renderer/screens/campaign/paid-confirm'
import { ReferencePicker } from '@/renderer/screens/campaign/reference-picker'
import { ProviderSelect } from '@/renderer/screens/campaign/provider-select'
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import { useComfyInfo } from '@/renderer/screens/campaign/use-comfy-info'
import layout from '@/renderer/ui/layout.module.css'

function usePictureSlots(projectId: string, campaignId: string): string[] | null {
  const api = useApi()
  const [slots, setSlots] = useState<string[] | null>(null)
  useEffect(() => {
    let live = true
    void api.query('template.slots', { projectId, campaignId }).then((result) => {
      if (!live) return
      const all = result.ok ? ((result.data as TemplateSlots | null) ?? []) : []
      setSlots(all.filter((s) => s.slot.type !== 'copy').map((s) => s.slot.id))
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return slots
}

function promptFrom(data: CampaignGet): string {
  const { campaign, subjects } = data
  return prefilledPrompt({
    subjects: subjects.map((s) => ({ name: s.name, description: s.description })),
    audience: campaign.audience,
    region: campaign.region,
    message: campaign.message,
  })
}

export function GeneratePanel(props: {
  projectId: string
  campaignId: string
  variantId: string
  data: CampaignGet
  ticks: string[]
  setTicks: Dispatch<SetStateAction<string[]>>
  onStarted: (reply: unknown) => void
}) {
  const command = useApp((s) => s.command)
  const allProviders = useApp((s) => s.app?.providers ?? EMPTY)
  const settings = useApp((s) => s.app?.settings)
  const providers = allProviders.filter((p) => p.available && p.jobs.includes('image'))
  const slots = usePictureSlots(props.projectId, props.campaignId)
  const startProvider = settings?.defaultProviders.image
  const [providerId, setProviderId] = useState(
    providers.some((p) => p.id === startProvider) ? startProvider : providers[0]?.id,
  )
  const [slot, setSlot] = useState<string | undefined>(undefined)
  const [prompt, setPrompt] = useState(() => promptFrom(props.data))
  const startCount = Math.min(
    Math.max(settings?.generation.optionsPerRun ?? 1, 1),
    MAX_IMAGES_PER_RUN,
  )
  const [count, setCount] = useState(String(startCount))
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, setPending] = useState<GenerationRunImagesInput | null>(null)
  // SPEC 14 1.48 TL-2: true from the send until any reply, so a second click starts nothing.
  const [sending, setSending] = useState(false)
  const provider = providers.find((p) => p.id === providerId)
  const chosenSlot = slot ?? slots?.[0]
  const info = useComfyInfo()
  const job = props.ticks.length === 0 ? 'image' : 'image_refs'
  const trial = providerId === 'comfyui' && offeredFor(info, job)?.status === 'trial'

  async function send(input: GenerationRunImagesInput) {
    setPending(null)
    setSending(true)
    try {
      const result = await command('generation.runImages', input)
      if (result.ok) props.onStarted(result.data)
    } finally {
      setSending(false)
    }
  }

  function generate() {
    const parsed = generationRunImagesInput.safeParse({
      projectId: props.projectId,
      variantId: props.variantId,
      slot: chosenSlot,
      prompt,
      referenceAssetIds: props.ticks,
      count: Number(count),
      provider: providerId,
    })
    if (!parsed.success) return setProblem(parsed.error.issues[0]?.message ?? 'Check the values.')
    setProblem(null)
    if (provider?.local) return void send(parsed.data)
    setPending(parsed.data)
  }

  return (
    <section className={layout.card} aria-label="Make pictures">
      <h2>Make pictures</h2>
      {providers.length === 0 ? (
        <p className={layout.muted}>No picture provider is available.</p>
      ) : (
        <ProviderSelect
          label="Provider"
          providers={providers}
          value={providerId}
          onChange={setProviderId}
          trial={trial}
        />
      )}
      {slots !== null && slots.length === 0 && (
        <p className={layout.muted}>This campaign has no picture slot.</p>
      )}
      {slots !== null && slots.length > 0 && (
        <label className={layout.field}>
          Slot
          <select value={chosenSlot} onChange={(e) => setSlot(e.target.value)}>
            {slots.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={layout.field}>
        Prompt
        <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <ReferencePicker
        projectId={props.projectId}
        subjectId={props.data.variants.find((v) => v.id === props.variantId)?.subjectIds[0]}
        local={provider?.local === true}
        ticks={props.ticks}
        setTicks={props.setTicks}
      />
      <label className={layout.field}>
        Pictures
        <input
          type="number"
          min={1}
          max={MAX_IMAGES_PER_RUN}
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>
      {problem !== null && <p role="alert">{problem}</p>}
      {pending === null ? (
        <div className={layout.row}>
          <button
            type="button"
            className={layout.primary}
            disabled={sending || provider === undefined || chosenSlot === undefined}
            onClick={generate}
          >
            Generate
          </button>
        </div>
      ) : (
        <PaidConfirm
          count={pending.count}
          references={pending.referenceAssetIds.length}
          providerLabel={
            providers.find((p) => p.id === pending.provider)?.label ?? pending.provider
          }
          onConfirm={() => void send(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  )
}

// The video card (SPEC 14 1.57 TP-6 "Where it lives", "Commands"): provider, start, prompt
// and length for the chosen variant, then generation.startVideo. The run shows in the run
// list. J-2: the saved default is chosen only when it is available. A paid provider gets the
// confirm line first, as pictures do. SPEC 14 1.60 CU-6b-R N-9: "Start from" a prompt, a
// first-frame picture or a reference picture; a picture start needs a chosen picture, and
// the length's most follows the start's workflow. P7-22: a provider with an offer
// (video-offers.ts) gives its starts, with "The post's background" new and the default when the
// background has a picture, its length bounds and its reference count (card-starts.ts). An
// image post shows "Change this post to video first." and Start is disabled.
import { useId, useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import {
  generationStartVideoInput,
  type GenerationStartVideoInput,
} from '@/shared/schemas/commands/generation'
import { PaidConfirm } from '@/renderer/screens/campaign/paid-confirm'
import { LENGTH_PROBLEM, typedSeconds, useComfyInfo } from './video-length'
import { VideoPictureChoice } from '@/renderer/screens/campaign/video-picture-choice'
import { STARTS } from '@/renderer/screens/campaign/video-start'
import { ProviderSelect } from '@/renderer/screens/campaign/provider-select'
import { offeredFor } from '@/renderer/screens/campaign/offered-workflow'
import {
  cardStartFields,
  cardStarts,
  lengthsFor,
  picturesFor,
  shownStart,
  type CardStartId,
} from './card-starts'
import { usePost } from './use-post'
import layout from '@/renderer/ui/layout.module.css'

const IMAGE_POST_LINE = 'Change this post to video first.'

export function VideoPanel(props: {
  projectId: string
  variantId: string
  subjectId?: string
  onStarted: (reply: unknown) => void
}) {
  const command = useApp((s) => s.command)
  const allProviders = useApp((s) => s.app?.providers ?? EMPTY)
  const startProvider = useApp((s) => s.app?.settings.defaultProviders.video)
  const providers = allProviders.filter((p) => p.available && p.jobs.includes('video'))
  const [providerId, setProviderId] = useState(
    providers.some((p) => p.id === startProvider) ? startProvider : providers[0]?.id,
  )
  const [chosenStart, setChosenStart] = useState<CardStartId | null>(null)
  const [pictures, setPictures] = useState<string[]>([])
  const [prompt, setPrompt] = useState('')
  // null until the user types: the length then follows the provider's default.
  const [typed, setTyped] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, setPending] = useState<GenerationStartVideoInput | null>(null)
  // SPEC 14 1.48 TL-2: true from the send until any reply, so a second click starts nothing.
  const [sending, setSending] = useState(false)
  const info = useComfyInfo()
  const post = usePost(props.projectId, props.variantId)
  const startSelectId = useId()
  const provider = providers.find((p) => p.id === providerId)
  const starts = cardStarts(info, providerId)
  // A start no longer offered (another provider, another list) falls back to the default.
  const startId = shownStart(starts, chosenStart, post.backgroundPicture)
  const most = picturesFor(providerId, startId)
  const pair = STARTS.find((s) => s.id === startId)?.pair
  const trial = providerId === 'comfyui' && offeredFor(info, 'video', pair)?.status === 'trial'
  const lengths = lengthsFor(info, providerId, startId)
  const maxSeconds = lengths.max
  const length = typed ?? String(lengths.start)
  const seconds = typedSeconds(length)
  const shorter = seconds !== null && maxSeconds !== null && seconds > maxSeconds
  const imagePost = post.format === 'image'
  const pictured = most === 0 || pictures.length > 0
  const ready = provider !== undefined && prompt.trim() !== '' && pictured && !imagePost

  async function send(input: GenerationStartVideoInput) {
    setPending(null)
    setSending(true)
    try {
      const result = await command('generation.startVideo', input)
      if (result.ok) props.onStarted(result.data)
    } finally {
      setSending(false)
    }
  }

  function startVideo() {
    if (seconds === null) return setProblem(LENGTH_PROBLEM)
    const parsed = generationStartVideoInput.safeParse({
      projectId: props.projectId,
      variantId: props.variantId,
      prompt,
      durationMs: Math.min(seconds, maxSeconds ?? seconds) * 1000,
      provider: providerId,
      ...cardStartFields(startId, pictures, most),
    })
    if (!parsed.success) return setProblem(parsed.error.issues[0]?.message ?? 'Check the values.')
    setProblem(null)
    if (provider?.local) return void send(parsed.data)
    setPending(parsed.data)
  }

  return (
    <section className={layout.card} aria-label="Make a video">
      <h2>Make a video</h2>
      {providers.length === 0 ? (
        <p className={layout.muted}>No video provider is available.</p>
      ) : (
        <ProviderSelect
          label="Provider"
          providers={providers}
          value={providerId}
          onChange={setProviderId}
          trial={trial}
        />
      )}
      {/* The label does not wrap the select, so its name is not "Start from A prompt …". */}
      <div className={layout.field}>
        <label htmlFor={startSelectId}>Start from</label>
        <select
          id={startSelectId}
          value={startId}
          onChange={(e) => setChosenStart(e.target.value as CardStartId)}
        >
          {starts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {most > 0 && (
        <VideoPictureChoice
          projectId={props.projectId}
          subjectId={props.subjectId}
          chosen={pictures.slice(0, most)}
          most={most}
          onChoose={setPictures}
        />
      )}
      <label className={layout.field}>
        Prompt
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label className={layout.field}>
        Length (seconds)
        <input
          type="number"
          min={lengths.min}
          max={maxSeconds ?? undefined}
          step={lengths.step}
          value={length}
          onChange={(e) => setTyped(e.target.value)}
        />
      </label>
      {shorter && (
        <p className={layout.muted}>{`The clip will be shorter: at most ${maxSeconds} s`}</p>
      )}
      {imagePost && <p className={layout.muted}>{IMAGE_POST_LINE}</p>}
      {problem !== null && <p role="alert">{problem}</p>}
      {pending === null ? (
        <div className={layout.row}>
          <button
            type="button"
            className={layout.primary}
            disabled={sending || !ready}
            onClick={startVideo}
          >
            Start
          </button>
        </div>
      ) : (
        <PaidConfirm
          count={1}
          // A background start sends the post's background picture too.
          references={pending.referenceAssetIds.length + (pending.start === 'background' ? 1 : 0)}
          providerLabel={provider?.label ?? pending.provider}
          onConfirm={() => void send(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  )
}

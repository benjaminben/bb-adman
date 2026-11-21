// The video card (SPEC 14 1.57 TP-6 "Where it lives", "Commands"): provider, start, prompt
// and length for the chosen variant, then generation.startVideo. The run shows in the run
// list. J-2: the saved default is chosen only when it is available. A paid provider gets the
// confirm line first, as pictures do. SPEC 14 1.60 CU-6b-R N-9: "Start from" a prompt, a
// first-frame picture or a reference picture; a picture start needs one chosen picture, and
// the length's most follows the start's workflow.
import { useId, useState } from 'react'
import { EMPTY, useApp } from '../../app/app-context'
import {
  generationStartVideoInput,
  type GenerationStartVideoInput,
} from '../../../shared/schemas/commands/generation'
import { PaidConfirm } from './paid-confirm'
import { LENGTH_PROBLEM, START_SECONDS, typedSeconds, useComfyInfo } from './video-length'
import { VideoPictureChoice } from './video-picture-choice'
import { maxMsFor, offeredStarts, startFields, type StartId } from './video-start'
import styles from '../screens.module.css'

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
  const [chosenStart, setChosenStart] = useState<StartId>('prompt')
  const [picture, setPicture] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [length, setLength] = useState(String(START_SECONDS))
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, setPending] = useState<GenerationStartVideoInput | null>(null)
  // SPEC 14 1.48 TL-2: true from the send until any reply, so a second click starts nothing.
  const [sending, setSending] = useState(false)
  const info = useComfyInfo()
  const startSelectId = useId()
  const provider = providers.find((p) => p.id === providerId)
  const starts = offeredStarts(info, providerId)
  // A start no longer offered (another provider, another list) falls back to the prompt.
  const startId = starts.some((s) => s.id === chosenStart) ? chosenStart : 'prompt'
  const fromPicture = startId !== 'prompt'
  const maxMs = providerId === 'comfyui' ? maxMsFor(info, startId) : null
  const maxSeconds = maxMs === null ? null : Math.floor(maxMs / 1000)
  const seconds = typedSeconds(length)
  const shorter = seconds !== null && maxSeconds !== null && seconds > maxSeconds
  const ready = provider !== undefined && prompt.trim() !== '' && (!fromPicture || picture !== null)

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
      ...startFields(startId, picture),
    })
    if (!parsed.success) return setProblem(parsed.error.issues[0]?.message ?? 'Check the values.')
    setProblem(null)
    if (provider?.local) return void send(parsed.data)
    setPending(parsed.data)
  }

  return (
    <section className={styles.card} aria-label="Make a video">
      <h2>Make a video</h2>
      {providers.length === 0 ? (
        <p className={styles.muted}>No video provider is available.</p>
      ) : (
        <label className={styles.field}>
          Provider
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* The label does not wrap the select, so its name is not "Start from A prompt …". */}
      <div className={styles.field}>
        <label htmlFor={startSelectId}>Start from</label>
        <select
          id={startSelectId}
          value={startId}
          onChange={(e) => setChosenStart(e.target.value as StartId)}
        >
          {starts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {fromPicture && (
        <VideoPictureChoice
          projectId={props.projectId}
          subjectId={props.subjectId}
          chosen={picture}
          onChoose={setPicture}
        />
      )}
      <label className={styles.field}>
        Prompt
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label className={styles.field}>
        Length (seconds)
        <input
          type="number"
          min={1}
          max={maxSeconds ?? undefined}
          step={1}
          value={length}
          onChange={(e) => setLength(e.target.value)}
        />
      </label>
      {shorter && (
        <p className={styles.muted}>{`The clip will be shorter: at most ${maxSeconds} s`}</p>
      )}
      {problem !== null && <p role="alert">{problem}</p>}
      {pending === null ? (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.primary}
            disabled={sending || !ready}
            onClick={startVideo}
          >
            Start
          </button>
        </div>
      ) : (
        <PaidConfirm
          count={1}
          providerLabel={provider?.label ?? pending.provider}
          onConfirm={() => void send(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  )
}

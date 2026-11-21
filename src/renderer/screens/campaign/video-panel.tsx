// The video card (SPEC 14 1.57 TP-6 "Where it lives", "Commands"): provider, prompt and
// length for the chosen variant, then generation.startVideo, prompt only. The run shows in
// the run list. J-2: the saved default is chosen only when it is available. A paid provider
// gets the confirm line first, as pictures do.
import { useState } from 'react'
import { EMPTY, useApp } from '../../app/app-context'
import {
  generationStartVideoInput,
  type GenerationStartVideoInput,
} from '../../../shared/schemas/commands/generation'
import { PaidConfirm } from './paid-confirm'
import { LENGTH_PROBLEM, START_SECONDS, typedSeconds, useComfyMaxMs } from './video-length'
import styles from '../screens.module.css'

export function VideoPanel(props: {
  projectId: string
  variantId: string
  onStarted: (reply: unknown) => void
}) {
  const command = useApp((s) => s.command)
  const allProviders = useApp((s) => s.app?.providers ?? EMPTY)
  const startProvider = useApp((s) => s.app?.settings.defaultProviders.video)
  const providers = allProviders.filter((p) => p.available && p.jobs.includes('video'))
  const [providerId, setProviderId] = useState(
    providers.some((p) => p.id === startProvider) ? startProvider : providers[0]?.id,
  )
  const [prompt, setPrompt] = useState('')
  const [length, setLength] = useState(String(START_SECONDS))
  const [problem, setProblem] = useState<string | null>(null)
  const [pending, setPending] = useState<GenerationStartVideoInput | null>(null)
  // SPEC 14 1.48 TL-2: true from the send until any reply, so a second click starts nothing.
  const [sending, setSending] = useState(false)
  const comfyMaxMs = useComfyMaxMs()
  const provider = providers.find((p) => p.id === providerId)
  const maxSeconds =
    providerId === 'comfyui' && comfyMaxMs !== null ? Math.floor(comfyMaxMs / 1000) : null
  const seconds = typedSeconds(length)
  const shorter = seconds !== null && maxSeconds !== null && seconds > maxSeconds

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
      start: 'none',
      useReferences: false,
      referenceAssetIds: [],
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
            disabled={sending || provider === undefined || prompt.trim() === ''}
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

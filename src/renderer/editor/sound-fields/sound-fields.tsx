// P7-21 (spec/phases/phase-07-slices-2.md; phase-07.md "Clips and the track", Sound): the
// transport bar's "Sound" choice. Each choice sends variant.setSound. "An audio file" with a
// stored file sends 'file' and the stored file stays; with none stored it shows the audio list
// first and sends on a pick. "Add audio…" imports audio files and uses the first. A refusal
// shows its own sentence. Drawn only inside the editor's sound scope.
import { useContext, useState } from 'react'
import type { AdmanApi } from '@/shared/schemas/api'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import { SoundScope } from './sound-scope'
import { useAudioAssets } from './use-audio-assets'
import styles from './sound-fields.module.css'

export type SoundFieldsProps = { projectId: string; variant: VariantSummary }

type Sound = VariantSummary['sound']

const CHOICES: Array<{ value: Sound; label: string }> = [
  { value: 'clips', label: "The clips' own sound" },
  { value: 'file', label: 'An audio file' },
  { value: 'none', label: 'None' },
]

export function SoundFields(props: SoundFieldsProps) {
  const api = useContext(SoundScope)
  return api ? <SoundChoice api={api} {...props} /> : null
}

function SoundChoice({ api, projectId, variant }: SoundFieldsProps & { api: AdmanApi }) {
  // 'file' chosen while no file is stored: nothing is sent until a file is picked. It holds the
  // sound it was chosen from, so a change of the stored sound ends it.
  const [pickingFrom, setPickingFrom] = useState<Sound | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const shown: Sound = pickingFrom === variant.sound ? 'file' : variant.sound

  async function send(sound: Sound, assetId?: string) {
    const input = { projectId, variantId: variant.id, sound, ...(assetId ? { assetId } : {}) }
    const result = await api.command('variant.setSound', input)
    setRefusal(result.ok ? null : result.error.message)
  }

  function choose(sound: Sound) {
    setRefusal(null)
    if (sound === 'file' && !variant.soundAssetId) {
      setPickingFrom(variant.sound)
      return
    }
    setPickingFrom(null)
    void send(sound)
  }

  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span className={styles.label}>Sound</span>
        <select
          className={styles.select}
          value={shown}
          onChange={(event) => choose(event.target.value as Sound)}
        >
          {CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      {shown === 'file' && (
        <AudioPicker
          api={api}
          projectId={projectId}
          chosen={variant.soundAssetId}
          onPick={(assetId) => void send('file', assetId)}
          onRefusal={setRefusal}
        />
      )}
      {refusal && (
        <p role="alert" className={styles.error}>
          {refusal}
        </p>
      )}
    </div>
  )
}

type PickerProps = {
  api: AdmanApi
  projectId: string
  chosen: string | null
  onPick: (assetId: string) => void
  onRefusal: (message: string) => void
}

function AudioPicker({ api, projectId, chosen, onPick, onRefusal }: PickerProps) {
  const { assets, importAudio } = useAudioAssets(api, projectId)

  async function add() {
    const imported = await importAudio()
    if (!imported) return
    if ('error' in imported) onRefusal(imported.error)
    else onPick(imported.assetId)
  }

  return (
    <>
      <select
        aria-label="Audio file"
        className={styles.select}
        value={chosen ?? ''}
        onChange={(event) => event.target.value && onPick(event.target.value)}
      >
        <option value="" disabled>
          Choose an audio file
        </option>
        {(assets ?? []).map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.displayName}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        onClick={() => void add()}
      >
        Add audio…
      </button>
    </>
  )
}

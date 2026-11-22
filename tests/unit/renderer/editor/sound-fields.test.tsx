// P7-21 (spec/phases/phase-07-slices-2.md): the transport bar's "Sound" choice ("The clips' own
// sound", "An audio file", "None") sends variant.setSound; "An audio file" shows the assets
// library's audio files and "Add audio…", which imports through the picker with kind audio.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SoundFields, SoundScope } from '@/renderer/editor/sound-fields'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { variant } from '../screens/campaign/campaign-fixture'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, assetRow } from './editor-fixture'

type Sound = VariantSummary['sound']
const video = (sound: Sound, soundAssetId: string | null = null): VariantSummary => ({
  ...variant('V1'),
  format: 'video',
  durationMs: 8000,
  sound,
  soundAssetId,
})

const audio = (id: string, name: string) =>
  assetRow(id, { kind: 'audio', mime: 'audio/wav', displayName: name, width: null, height: null })
const LIBRARY = [audio('AU1', 'waves.wav'), audio('AU2', 'chimes.wav'), assetRow('A1')]

async function setUp(v: VariantSummary, fake = makeFakeApi()) {
  fake.onQuery('asset.list', () => ({ ok: true, data: LIBRARY }))
  await renderApp(
    <main>
      <SoundScope.Provider value={fake.api}>
        <SoundFields projectId={P} variant={v} />
      </SoundScope.Provider>
    </main>,
    fake,
  )
  return fake
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)
const soundChoice = () => screen.getByRole('combobox', { name: 'Sound' })
const fileChoice = () => screen.queryByRole('combobox', { name: 'Audio file' })

describe('SoundFields [P7-21]', () => {
  it('shows the three choices with the variant sound chosen', async () => {
    await setUp(video('clips'))
    expect(soundChoice()).toHaveValue('clips')
    expect([...(soundChoice() as HTMLSelectElement).options].map((o) => [o.value, o.text])).toEqual(
      [
        ['clips', "The clips' own sound"],
        ['file', 'An audio file'],
        ['none', 'None'],
      ],
    )
    expect(fileChoice()).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it.each([
    ['clips', 'none'],
    ['none', 'clips'],
  ] as const)('from %s, choosing %s sends it', async (from, to) => {
    const fake = await setUp(video(from))
    await userEvent.selectOptions(soundChoice(), to)
    expect(sent(fake, 'variant.setSound')).toEqual([{ projectId: P, variantId: 'V1', sound: to }])
  })

  it('choosing an audio file with one stored sends file without an asset', async () => {
    const fake = await setUp(video('none', 'AU2'))
    await userEvent.selectOptions(soundChoice(), 'file')
    expect(sent(fake, 'variant.setSound')).toEqual([
      { projectId: P, variantId: 'V1', sound: 'file' },
    ])
  })

  it('choosing an audio file with none stored shows the audio list and sends only on a pick', async () => {
    const fake = await setUp(video('clips'))
    await userEvent.selectOptions(soundChoice(), 'file')
    expect(sent(fake, 'variant.setSound')).toEqual([])
    const list = await screen.findByRole('combobox', { name: 'Audio file' })
    await screen.findByRole('option', { name: 'waves.wav' })
    expect([...(list as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      'Choose an audio file',
      'waves.wav',
      'chimes.wav',
    ])
    await userEvent.selectOptions(list, 'AU1')
    expect(sent(fake, 'variant.setSound')).toEqual([
      { projectId: P, variantId: 'V1', sound: 'file', assetId: 'AU1' },
    ])
    expect(await axeViolations()).toEqual([])
  })

  it('with the file sound, the stored file is chosen in the list', async () => {
    await setUp(video('file', 'AU2'))
    await screen.findByRole('option', { name: 'chimes.wav' })
    expect(fileChoice()).toHaveValue('AU2')
  })

  it('"Add audio…" picks audio files, imports them linked and uses the first', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/sounds/tone.wav'] } }))
    fake.onCommand('asset.import', () => ({
      ok: true,
      data: { assetIds: ['AU3'], reusedAssetIds: [], skippedCount: 0, animatedAssetIds: [] },
    }))
    await setUp(video('file', 'AU1'), fake)
    await userEvent.click(await screen.findByRole('button', { name: 'Add audio…' }))
    const picks = fake.queries.filter((q) => q.name === 'dialog.pickFiles').map((q) => q.input)
    expect(picks).toEqual([{ purpose: 'import', kind: 'audio', multiple: false }])
    expect(sent(fake, 'asset.import')).toEqual([
      { projectId: P, paths: ['/sounds/tone.wav'], library: 'asset', copy: false },
    ])
    expect(sent(fake, 'variant.setSound')).toEqual([
      { projectId: P, variantId: 'V1', sound: 'file', assetId: 'AU3' },
    ])
  })

  it('a cancelled picker sends nothing', async () => {
    const fake = makeFakeApi()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await setUp(video('file', 'AU1'), fake)
    await userEvent.click(await screen.findByRole('button', { name: 'Add audio…' }))
    expect(sent(fake, 'asset.import')).toEqual([])
    expect(sent(fake, 'variant.setSound')).toEqual([])
  })

  it('a refusal shows its own sentence', async () => {
    const fake = makeFakeApi()
    const message = 'Choose an audio file (MP3, WAV, M4A or AAC) from the assets library.'
    fake.onCommand('variant.setSound', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'sound_asset_not_audio' } },
    }))
    await setUp(video('file', 'AU1'), fake)
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Audio file' }),
      'AU2',
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('outside an editor (no sound scope) it renders nothing', async () => {
    const { container } = await renderApp(<SoundFields projectId={P} variant={video('clips')} />)
    expect(container).toBeEmptyDOMElement()
  })
})

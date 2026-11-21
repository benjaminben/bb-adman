// spec/subject-photos.md, "Subject photos as reference pictures" (SP-7, A-120): the video
// card's picture list holds every reference picture, subject photos of both libraries
// included, and chooses the first photo of the variant's subject when nothing is chosen. A
// pre-chosen picture is sent only after Start, with it shown chosen.
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sent } from './campaign-fixture'
import { ref } from './reference-fixture'
import { panel, pictureApi, pictureStart, start } from './video-start-fixture'

// S1 is the oldest subject photo but cannot be sent, so S2 is the one chosen.
const ROWS = [
  ref('R1'),
  ref('S1', { library: 'asset', subjectId: 'citrus-can', missing: true }),
  ref('S2', { library: 'asset', subjectId: 'citrus-can' }),
  ref('S3', { subjectId: 'citrus-can' }),
  ref('A1', { library: 'asset' }),
]

describe('VideoPanel picture pre-choice [SP-7, A-120]', () => {
  it.each(['A first-frame picture', 'A reference picture'])(
    '%s: lists the subject photos and chooses the first that can be sent',
    async (startFrom) => {
      const { p } = await panel(pictureApi(ROWS).fake)
      const pictures = await pictureStart(p, startFrom)
      expect(await pictures.findByRole('radio', { name: 'S2.png' })).toBeChecked()
      const names = pictures.getAllByRole('radio').map((r) => r.closest('label')?.textContent)
      expect(names).toEqual(['R1.png', 'S1.png', 'S2.png', 'S3.png'])
      expect(pictures.getAllByText('Photo of citrus-can')).toHaveLength(2)
    },
  )

  it('chooses nothing when the subject has no photo', async () => {
    const { p } = await panel(pictureApi([ref('R1'), ref('B1', { subjectId: 'berry' })]).fake)
    const pictures = await pictureStart(p, 'A first-frame picture')
    await pictures.findByRole('radio', { name: 'R1.png' })
    const checked = pictures.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)
    expect(checked).toEqual([])
  })

  it('sends the pre-chosen picture only after Start', async () => {
    const { fake } = pictureApi(ROWS)
    fake.onCommand('generation.startVideo', () => ({ ok: true, data: { jobId: 'J1' } }))
    const { p } = await panel(fake)
    const pictures = await pictureStart(p, 'A first-frame picture')
    expect(await pictures.findByRole('radio', { name: 'S2.png' })).toBeChecked()
    await userEvent.type(p.getByLabelText('Prompt'), 'A can')
    expect(sent(fake, 'generation.startVideo')).toEqual([])
    await userEvent.click(start(p))
    const inputs = JSON.stringify(sent(fake, 'generation.startVideo').map((c) => c.input))
    expect(inputs).toContain('"S2"')
  })
})

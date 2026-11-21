// SPEC 14 1.60 CU-6b-R N-9: the video card's picture list for a picture start (the project's
// reference pictures, one choice, its own "Add pictures"), and the refusals of N-4 shown as
// the command gives them.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ErrorCode } from '@/shared/schemas/result'
import { axeViolations } from '../../render'
import { P, sent } from './campaign-fixture'
import { ref } from './reference-fixture'
import { panel, pictureApi, pictureStart, start } from './video-start-fixture'

describe('VideoPanel picture list [SPEC 14 1.60 CU-6b-R N-9]', () => {
  it("shows the project's reference pictures, one choice each, with no path", async () => {
    const { fake, p } = await panel()
    const pictures = await pictureStart(p, 'A first-frame picture')
    expect(await pictures.findAllByRole('radio')).toHaveLength(2)
    const images = pictures.getAllByRole('presentation').map((img) => img.getAttribute('src'))
    expect(images).toEqual([`adman-asset://${P}/A1`, `adman-asset://${P}/A2`])
    expect(document.body.innerHTML).not.toContain('/Users/me/Pictures')
    const asked = fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)
    expect(asked).toContainEqual({ projectId: P, library: 'reference', kind: 'image' })
  })

  it('shows the reason a picture cannot be sent, and it cannot be chosen', async () => {
    const rows = [ref('A1', { missing: true }), ref('A2', { mime: 'image/webp' })]
    const { p } = await panel(pictureApi(rows).fake)
    const pictures = await pictureStart(p, 'A first-frame picture')
    expect(await pictures.findByRole('radio', { name: 'A1.png' })).toBeDisabled()
    expect(pictures.getByRole('radio', { name: 'A2.png' })).toBeDisabled()
    expect(pictures.getByText('file not found')).toBeInTheDocument()
    expect(pictures.getByText('WebP cannot be sent yet')).toBeInTheDocument()
  })

  it('says so for an empty list, and keeps "Add pictures"', async () => {
    const { p } = await panel(pictureApi([]).fake)
    const pictures = await pictureStart(p, 'A reference picture')
    expect(await pictures.findByText('No reference pictures in this project yet.')).toBeVisible()
    expect(pictures.getByRole('button', { name: 'Add pictures' })).toBeInTheDocument()
  })

  it('imports through "Add pictures" and chooses the first added picture', async () => {
    const { fake, list } = pictureApi([ref('A1')])
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/Users/me/n.png'] } }))
    fake.onCommand('asset.import', () => {
      list.rows = [ref('A1'), ref('N1')]
      return { ok: true, data: { assetIds: ['N1'] } }
    })
    const { p } = await panel(fake)
    const pictures = await pictureStart(p, 'A first-frame picture')
    await userEvent.click(pictures.getByRole('button', { name: 'Add pictures' }))
    expect(await pictures.findByRole('radio', { name: 'N1.png' })).toBeChecked()
    expect(sent(fake, 'asset.import').map((c) => c.input)).toEqual([
      {
        projectId: P,
        paths: ['/Users/me/n.png'],
        library: 'reference',
        copy: false,
        subjectId: 'citrus-can',
      },
    ])
  })

  it('has no axe problems in a picture start', async () => {
    const { p } = await panel()
    const pictures = await pictureStart(p, 'A first-frame picture')
    await pictures.findAllByRole('radio')
    expect(await axeViolations()).toEqual([])
  })
})

const REFUSALS = [
  ['INVALID_INPUT', 'Choose one picture for this video.', undefined],
  ['RULE_VIOLATION', 'ComfyUI does not offer this video start.', 'comfy_job_not_offered'],
  [
    'RULE_VIOLATION',
    'This picture cannot be used for a video yet. Use a PNG or JPEG.',
    'picture_not_usable',
  ],
  ['RULE_VIOLATION', 'ComfyUI makes clips of at most 30 seconds.', 'video_too_long'],
  ['RULE_VIOLATION', 'Add the ComfyUI server address in Settings.', 'comfy_address_needed'],
] as const

async function refusedStart(code: ErrorCode, message: string, why: string | undefined) {
  const { fake } = pictureApi([ref('A1')])
  fake.onCommand('generation.startVideo', () => ({
    ok: false,
    error: { code, message, ...(why && { details: { reason: why } }) },
  }))
  const { p } = await panel(fake)
  const pictures = await pictureStart(p, 'A first-frame picture')
  await userEvent.click(await pictures.findByRole('radio', { name: 'A1.png' }))
  await userEvent.type(p.getByLabelText('Prompt'), 'A can')
  await userEvent.click(start(p))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  await waitFor(() => expect(start(p)).toBeEnabled())
}

describe('VideoPanel refusals from a picture start [SPEC 14 1.60 N-4]', () => {
  it.each(REFUSALS)('shows a %s refusal as the command gives it: %s', refusedStart)
})

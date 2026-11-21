import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '../../../../../src/renderer/screens/settings/settings-screen'
import type {
  ComfyCheck,
  ComfyCheckOutcome,
} from '../../../../../src/shared/schemas/commands/comfy-check'
import type { Result } from '../../../../../src/shared/schemas/result'
import { renderApp, axeViolations } from '../../render'
import { ADDRESS, comfyFake, info, workflow } from './comfy-fixture'

const complete = workflow()
const video = workflow({
  id: 'h3-text-to-video',
  label: 'H3 video from a prompt',
  job: 'video',
  status: 'trial',
})
const draft = workflow({ id: 'moss-extend', label: 'MOSS extend', job: 'extend', status: 'draft' })

const twoMissing: ComfyCheck = {
  outcome: 'ok',
  version: '0.45.0',
  workflows: [
    { id: 'moss-text-to-image', missing: [] },
    {
      id: 'h3-text-to-video',
      missing: [
        { what: 'model', name: 'h3.safetensors', folder: 'diffusion_models' },
        { what: 'node', name: 'MiniMaxH3ImageToVideo' },
      ],
    },
  ],
}

async function pressCheck(check: ComfyCheck, start = info()) {
  const { fake, setInfo } = comfyFake(start, check)
  await renderApp(<SettingsScreen />, fake)
  const box = await screen.findByRole('region', { name: 'ComfyUI server' })
  await within(box).findByText(ADDRESS)
  await userEvent.click(within(box).getByRole('button', { name: 'Check' }))
  return { fake, box, setInfo }
}

describe('settings: the ComfyUI check [SPEC 14 1.41 TP-3, 6.10.9]', () => {
  it('Check sends comfy.check with no input', async () => {
    const { fake } = await pressCheck({ outcome: 'ok', version: '0.45.0', workflows: [] })
    expect(fake.commands).toContainEqual({ name: 'comfy.check', input: {} })
  })

  it('shows that it is checking until the reply comes', async () => {
    const { fake } = comfyFake()
    let answer: (r: Result<unknown>) => void = () => undefined
    fake.onCommand('comfy.check', () => new Promise((resolve) => (answer = resolve)))
    await renderApp(<SettingsScreen />, fake)
    const box = await screen.findByRole('region', { name: 'ComfyUI server' })
    await within(box).findByText(ADDRESS)
    await userEvent.click(within(box).getByRole('button', { name: 'Check' }))
    expect(within(box).getByText('Checking…')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Check' })).toBeDisabled()
    answer({ ok: true, data: { outcome: 'ok', version: '0.45.0', workflows: [] } })
    expect(await within(box).findByText(/ComfyUI 0\.45\.0/)).toBeInTheDocument()
    expect(within(box).queryByText('Checking…')).toBeNull()
  })

  it('an ok reply with no workflows shows the version alone [1.45 B-3]', async () => {
    const { box } = await pressCheck({ outcome: 'ok', version: '0.45.0', workflows: [] })
    expect(await within(box).findByText(/ComfyUI 0\.45\.0/)).toBeInTheDocument()
    expect(within(box).queryByRole('list', { name: 'Workflows' })).toBeNull()
  })

  it('an ok reply lists a complete workflow and one with two missing items', async () => {
    const { box } = await pressCheck(twoMissing, info({ workflows: [complete, video] }))
    const list = await within(box).findByRole('list', { name: 'Workflows' })
    expect(within(list).getAllByRole('listitem', { name: /./ })).toHaveLength(2)
    const first = within(list).getByRole('listitem', { name: 'MOSS picture from a prompt' })
    const second = within(list).getByRole('listitem', { name: 'H3 video from a prompt' })
    expect(within(first).getByText('Complete')).toBeInTheDocument()
    expect(within(second).getByText('trial')).toBeInTheDocument()
    expect(within(second).getByText('Missing 2 items')).toBeInTheDocument()
    expect(
      within(second).getByText('Model h3.safetensors, in the folder diffusion_models'),
    ).toBeInTheDocument()
    expect(within(second).getByText('Node MiniMaxH3ImageToVideo')).toBeInTheDocument()
  })

  it('draws no row for a draft workflow, whatever comfy.getInfo lists [1.45 B-3]', async () => {
    const check: ComfyCheck = {
      outcome: 'ok',
      version: '0.45.0',
      workflows: [
        { id: 'moss-text-to-image', missing: [] },
        { id: 'moss-extend', missing: [] },
      ],
    }
    const { box } = await pressCheck(check, info({ workflows: [complete, draft] }))
    const list = await within(box).findByRole('list', { name: 'Workflows' })
    expect(within(list).getAllByRole('listitem', { name: /./ })).toHaveLength(1)
    expect(within(box).queryByText('MOSS extend')).toBeNull()
  })

  it('shows the note of an ok reply', async () => {
    const note = 'The server is newer than the one these workflows were checked with.'
    const { box } = await pressCheck({ outcome: 'ok', version: '9.0.0', note, workflows: [] })
    expect(await within(box).findByText(note)).toBeInTheDocument()
  })

  it('no_answer shows its sentence with the address filled in', async () => {
    const { box } = await pressCheck({ outcome: 'no_answer', workflows: [] })
    const sentence = `Nothing answered at ${ADDRESS}. Check that ComfyUI is running and the address is right.`
    expect(await within(box).findByText(sentence)).toBeInTheDocument()
  })

  const others: Array<[ComfyCheckOutcome, string]> = [
    ['not_comfyui', `Something answered at ${ADDRESS}, but it is not a ComfyUI server.`],
    [
      'sign_in_needed',
      `The server at ${ADDRESS} asked for a sign-in. Adman can only use ComfyUI servers without one.`,
    ],
    [
      'redirect_refused',
      'The server tried to send Adman to another address. Adman did not follow, and the run was stopped.',
    ],
    ['certificate', "Adman could not check the server's security certificate."],
    ['address_refused', 'Adman cannot use that address.'],
  ]
  it.each(others)('%s shows its sentence', async (outcome, sentence) => {
    const { box } = await pressCheck({ outcome, workflows: [] })
    expect(await within(box).findByText(sentence)).toBeInTheDocument()
  })

  it('draws a licence note as text', async () => {
    const commercialNote = '<b>Not for paid work</b> without a licence'
    const noted = workflow({
      licence: { name: 'Custom', url: 'https://example.com', commercialNote },
    })
    const check: ComfyCheck = {
      outcome: 'ok',
      version: '0.45.0',
      workflows: [{ id: 'moss-text-to-image', missing: [] }],
    }
    const { box } = await pressCheck(check, info({ workflows: [noted] }))
    expect(await within(box).findByText(commercialNote)).toBeInTheDocument()
    expect(box.querySelector('b')).toBeNull()
  })

  it('a new saved address clears the earlier result', async () => {
    const { box } = await pressCheck({ outcome: 'ok', version: '0.45.0', workflows: [] })
    await within(box).findByText(/ComfyUI 0\.45\.0/)
    await userEvent.type(within(box).getByLabelText('Server address'), 'http://10.0.0.9:8188')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    expect(within(box).queryByText(/ComfyUI 0\.45\.0/)).toBeNull()
  })

  it('shows the "left on the server" sentences [6.10.10]', async () => {
    const { box } = await pressCheck({ outcome: 'ok', version: '0.45.0', workflows: [] })
    expect(
      within(box).getByText('Each picture leaves a file in the server’s temporary folder.'),
    ).toBeInTheDocument()
  })

  it('has no axe violations with a result shown', async () => {
    const { box } = await pressCheck(twoMissing, info({ workflows: [complete, video] }))
    await within(box).findByRole('list', { name: 'Workflows' })
    expect(await axeViolations()).toEqual([])
  })
})

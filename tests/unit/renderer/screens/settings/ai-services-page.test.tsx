// SET-2 (spec/phases/design-wave-screens-a.md): the AI services page as Sections. Keys are rows
// with a mark, the ComfyUI server's state is a mark on its header, Licences and On the server
// fold, and each job's default is a Segmented group. Every command sent before is still sent.
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { axeViolations, renderApp } from '../../render'
import { baseState } from '../../fake-api'
import { ADDRESS, comfyFake, info, workflow } from './comfy-fixture'

const TYPED = 'made-up-key-value-Q2RT'

function provider(id: string, label: string, jobs: ProviderInfo['jobs'], available = true) {
  const base = baseState().providers[0]!
  return { ...base, id, label, jobs, available, secrets: [] } as ProviderInfo
}

// Gemini (key saved) and fal (no key) are available, Firefly is not, ComfyUI needs no key.
function aiState(extra: Partial<ReturnType<typeof baseState>> = {}) {
  const base = baseState()
  const providers = base.providers.map((p) =>
    p.id === 'fal-seedance' ? { ...p, available: true } : p,
  )
  return baseState({
    providers: [...providers, provider('comfyui', 'ComfyUI', ['image', 'video'])],
    secrets: [{ name: 'gemini.apiKey', lastFour: '9xQ7' }],
    ...extra,
  })
}

function aiFake(start = info(), check?: ComfyCheck, state = aiState()) {
  const made = comfyFake(start, check)
  made.fake.setState(state)
  return made
}

const keys = () => screen.getByRole('region', { name: 'Keys' })
const comfy = () => screen.findByRole('region', { name: 'ComfyUI server' })
const group = (name: string) => screen.getByRole('group', { name })

// Folds remember their state for the window's life, so open one only when it is closed.
async function openFold(box: HTMLElement, name: string) {
  const fold = await within(box).findByRole('button', { name })
  if (fold.getAttribute('aria-expanded') === 'false') await userEvent.click(fold)
}

describe('AI services: Keys [SET-2, R-10]', () => {
  it('is a fold that starts open, with the count of providers whose keys are saved', async () => {
    await renderApp(<SettingsScreen />, aiFake().fake)
    const fold = within(keys()).getByRole('button', { name: 'Keys' })
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    expect(within(keys()).getByText('1 of 2')).toBeInTheDocument()
    expect(within(keys()).getByRole('button', { name: 'About keys' })).toBeInTheDocument()
  })

  it('shows a saved key by its last four; the mark opens the password field', async () => {
    await renderApp(<SettingsScreen />, aiFake().fake)
    const row = group('Google Gemini API key')
    expect(within(row).getByText('•••9xQ7')).toBeInTheDocument()
    expect(within(row).queryByLabelText('New Google Gemini API key')).toBeNull()
    await userEvent.click(
      within(row).getByRole('button', { name: 'Key saved, ends in 9xQ7. Replace' }),
    )
    expect(within(row).getByLabelText('New Google Gemini API key')).toHaveAttribute(
      'type',
      'password',
    )
    await userEvent.click(within(row).getByRole('button', { name: 'Cancel' }))
    expect(within(row).queryByLabelText('New Google Gemini API key')).toBeNull()
  })

  it('"Delete key" sends secret.delete', async () => {
    const { fake } = aiFake()
    await renderApp(<SettingsScreen />, fake)
    const trash = within(group('Google Gemini API key')).getByRole('button', { name: 'Delete key' })
    expect(trash).toHaveAttribute('title', 'Delete key')
    await userEvent.click(trash)
    expect(fake.commands).toContainEqual({
      name: 'secret.delete',
      input: { name: 'gemini.apiKey' },
    })
  })

  it('"Add key" opens the field; Save sends secret.set and the typed value leaves the page', async () => {
    const { fake } = aiFake()
    await renderApp(<SettingsScreen />, fake)
    const row = group('fal.ai Seedance API key')
    expect(within(row).getByText('Not set')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Add key' }))
    await userEvent.type(within(row).getByLabelText('New fal.ai Seedance API key'), TYPED)
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }))
    expect(fake.commands).toContainEqual({
      name: 'secret.set',
      input: { name: 'fal.apiKey', value: TYPED },
    })
    expect(document.body.innerHTML).not.toContain(TYPED)
    for (const el of document.querySelectorAll('[title], [aria-label]')) {
      expect(`${el.getAttribute('title')} ${el.getAttribute('aria-label')}`).not.toContain(TYPED)
    }
  })

  it('draws a provider not yet available as a faded row with no button', async () => {
    await renderApp(<SettingsScreen />, aiFake().fake)
    const firefly = group('Adobe Firefly')
    expect(within(firefly).getByText('Soon')).toBeInTheDocument()
    expect(within(firefly).getByText('Not yet available')).toBeInTheDocument()
    expect(within(firefly).queryByRole('button')).toBeNull()
  })
})

const twoMissing: ComfyCheck = {
  outcome: 'ok',
  version: '0.45.0',
  workflows: [
    {
      id: 'h3-text-to-video',
      missing: [
        { what: 'model', name: 'h3.safetensors', folder: 'diffusion_models' },
        { what: 'node', name: 'MiniMaxH3ImageToVideo' },
      ],
    },
  ],
}
const h3 = workflow({
  id: 'h3-text-to-video',
  label: 'H3 video from a prompt',
  job: 'video',
  licence: {
    name: 'Custom',
    url: 'https://example.com',
    commercialNote: 'Paid work needs a licence.',
  },
})

async function checked(check: ComfyCheck, start = info({ workflows: [h3] })) {
  const { fake } = aiFake(start, check)
  await renderApp(<SettingsScreen />, fake)
  const box = await comfy()
  await within(box).findByDisplayValue(ADDRESS)
  await userEvent.click(within(box).getByRole('button', { name: 'Check' }))
  return { fake, box }
}

describe('AI services: ComfyUI server [SET-2, TL-1]', () => {
  it('starts the field with the saved address, and keeps the privacy paragraph in full', async () => {
    await renderApp(<SettingsScreen />, aiFake().fake)
    const box = await comfy()
    expect(await within(box).findByLabelText('Server address')).toHaveValue(ADDRESS)
    expect(within(box).getByText(COMFY_PRIVACY).textContent).toBe(COMFY_PRIVACY)
    expect(within(box).queryByText('Saved address')).toBeNull()
  })

  it('with no address: "Not set", and Check is disabled with its reason', async () => {
    await renderApp(<SettingsScreen />, aiFake(info({ address: null })).fake)
    const box = await comfy()
    expect(await within(box).findByText('Not set')).toBeInTheDocument()
    const check = within(box).getByRole('button', { name: 'Check' })
    expect(check).toBeDisabled()
    expect(check).toHaveAttribute('title', 'Save an address first')
    expect(within(box).getByText(COMFY_PRIVACY)).toBeInTheDocument()
  })

  it('an ok check shows "Connected"; the version is in the tip only', async () => {
    const { box } = await checked({ outcome: 'ok', version: '0.45.0', workflows: [] })
    expect(await within(box).findByText('Connected')).toBeInTheDocument()
    const tip = within(box).getByTitle('The server answered: ComfyUI 0.45.0')
    for (const el of within(box).queryAllByText(/The server answered/)) {
      expect(tip.contains(el)).toBe(true)
    }
  })

  it('a failed check shows "Failed" and the sentence on the page', async () => {
    const { box } = await checked({ outcome: 'not_comfyui', workflows: [] })
    const sentence = `Something answered at ${ADDRESS}, but it is not a ComfyUI server.`
    expect(await within(box).findByText('Failed')).toBeInTheDocument()
    expect(within(box).getByText(sentence, { selector: 'p' })).toBeInTheDocument()
  })

  it('a workflow with two missing items shows "2 missing", both items and its licence mark', async () => {
    const { box } = await checked(twoMissing)
    const row = await within(box).findByRole('listitem', { name: 'H3 video from a prompt' })
    expect(within(row).getByText('2 missing')).toBeInTheDocument()
    expect(within(row).getByTitle('Missing 2 items')).toBeInTheDocument()
    expect(
      within(row).getByText('Model h3.safetensors, in the folder diffusion_models'),
    ).toBeInTheDocument()
    expect(within(row).getByText('Node MiniMaxH3ImageToVideo')).toBeInTheDocument()
    expect(within(row).getByText('Commercial licence needed')).toBeInTheDocument()
    await userEvent.click(
      within(row).getByRole('button', { name: 'About H3 video from a prompt licence' }),
    )
    expect(within(row).getByText('Paid work needs a licence.')).toBeVisible()
  })

  it('Licences and On the server start folded, open with one click, and stay open', async () => {
    const state = aiState({
      settings: { ...baseState().settings, licenceConfirmed: ['FLUX 3 klein'] },
    })
    const view = await renderApp(<SettingsScreen />, aiFake(info(), undefined, state).fake)
    const box = await comfy()
    for (const name of ['Licences', 'On the server']) {
      const fold = await within(box).findByRole('button', { name })
      expect(fold).toHaveAttribute('aria-expanded', 'false')
      await userEvent.click(fold)
      expect(fold).toHaveAttribute('aria-expanded', 'true')
    }
    expect(
      within(screen.getByRole('region', { name: 'Licences' })).getByText('1'),
    ).toBeInTheDocument()
    view.unmount()
    await renderApp(<SettingsScreen />, aiFake(info(), undefined, state).fake)
    const again = await comfy()
    for (const name of ['Licences', 'On the server']) {
      expect(await within(again).findByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'true',
      )
    }
    expect(
      within(again).getByText('Each picture leaves a file in the server’s temporary folder.'),
    ).toBeVisible()
  })

  it('still sends every command it sent before', async () => {
    const state = aiState({
      settings: { ...baseState().settings, licenceConfirmed: ['FLUX 3 klein'] },
    })
    const { fake } = aiFake(info(), { outcome: 'ok', version: '0.45.0', workflows: [] }, state)
    await renderApp(<SettingsScreen />, fake)
    const box = await comfy()
    const field = await within(box).findByDisplayValue(ADDRESS)
    await userEvent.click(within(box).getByRole('button', { name: 'Check' }))
    await userEvent.clear(field)
    await userEvent.type(field, 'http://10.0.0.7:8188')
    await userEvent.click(within(box).getByRole('button', { name: 'Save' }))
    await userEvent.click(within(box).getByRole('button', { name: 'Remove' }))
    await openFold(box, 'Licences')
    await userEvent.click(within(box).getByRole('button', { name: 'Forget FLUX 3 klein' }))
    expect(fake.commands).toEqual(
      expect.arrayContaining([
        { name: 'comfy.check', input: {} },
        { name: 'comfy.setAddress', input: { address: 'http://10.0.0.7:8188' } },
        { name: 'comfy.setAddress', input: { address: null } },
        { name: 'settings.update', input: { licenceConfirmed: [] } },
      ]),
    )
  })
})

describe('AI services: Defaults [SET-2, FR-067]', () => {
  it('draws two to four providers as a Segmented group; a click sends settings.update', async () => {
    const { fake } = aiFake()
    await renderApp(<SettingsScreen />, fake)
    const image = within(group('Image generation'))
    expect(image.getByRole('button', { name: 'Google Gemini' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const firefly = image.getByRole('button', { name: 'Adobe Firefly' })
    expect(firefly).toBeDisabled()
    expect(firefly).toHaveAttribute('title', 'Not yet available')
    await userEvent.click(image.getByRole('button', { name: 'ComfyUI' }))
    expect(fake.commands).toContainEqual({
      name: 'settings.update',
      input: { defaultProviders: { image: 'comfyui' } },
    })
  })

  it('draws one provider as text, and five or more as a select', async () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => provider(id, `Maker ${id}`, ['image']))
    const state = aiState()
    await renderApp(
      <SettingsScreen />,
      aiFake(info(), undefined, { ...state, providers: [...state.providers, ...many] }).fake,
    )
    expect(group('Layout')).toHaveTextContent('Google Gemini')
    expect(within(group('Layout')).queryByRole('button')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Image generation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About text' })).toBeInTheDocument()
  })
})

describe('AI services: accessibility [SET-2]', () => {
  it('has no axe violations open, after a check, and with the folds closed', async () => {
    const { box } = await checked(twoMissing)
    await within(box).findByRole('list', { name: 'Workflows' })
    expect(await axeViolations()).toEqual([])
    await userEvent.click(within(keys()).getByRole('button', { name: 'Keys' }))
    await userEvent.click(within(box).getByRole('button', { name: 'ComfyUI server' }))
    expect(await axeViolations()).toEqual([])
  })
})

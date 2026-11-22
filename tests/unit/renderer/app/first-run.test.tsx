// R2E-10 (spec/phases/round-2-editor.md D8): the first-run setup. It opens by itself on the
// start screen when the mark is unset and no key is saved; every ending sets the mark once.
import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirstRun, closeSetup } from '@/renderer/app/first-run'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

afterEach(() => closeSetup())

const TITLE = 'Set up AdManager'
const MADE_UP_KEY = 'made-up-key-7f3a9c'

function fresh(overrides: Partial<AppState> = {}) {
  const base = baseState()
  return makeFakeApi(
    baseState({ settings: { ...base.settings, setup: { done: false } }, ...overrides }),
  )
}

const dialog = () => screen.queryByRole('dialog', { name: TITLE })
const press = (name: string) => userEvent.click(screen.getByRole('button', { name }))
const marks = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'settings.update')

describe('when the first-run setup shows [R2E-10, D8]', () => {
  it('shows on the start screen with no mark and no saved key', async () => {
    await renderApp(<FirstRun />, fresh())
    expect(dialog()).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('does not show with a saved key', async () => {
    await renderApp(<FirstRun />, fresh({ secrets: [{ name: 'gemini.apiKey', lastFour: 'ab12' }] }))
    expect(dialog()).toBeNull()
  })

  it('does not show with the mark set', async () => {
    await renderApp(<FirstRun />, makeFakeApi())
    expect(dialog()).toBeNull()
  })

  it('does not show in a window that opens into a project', async () => {
    const openProjects = [{ projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' }]
    const { store } = await renderApp(<FirstRun />, fresh({ openProjects }))
    expect(store.getState().view.kind).toBe('project')
    expect(dialog()).toBeNull()
  })
})

describe('the steps [R2E-10, D8]', () => {
  const steps = [
    {
      heading: 'Step 1 of 3: AI keys',
      line: 'One key or a ComfyUI server lets you make pictures and videos.',
      part: 'Keys',
    },
    {
      heading: 'Step 2 of 3: ComfyUI server',
      line: 'Optional. Your own server makes pictures and videos at no charge.',
      part: 'ComfyUI server',
    },
    {
      heading: 'Step 3 of 3: Cloud storage',
      line: 'Optional. Where Publish sends finished ads.',
      part: 'Cloud storage',
    },
  ]

  it('walks through every step with nothing filled in, the heading taking the focus', async () => {
    await renderApp(<FirstRun />, fresh())
    expect(dialog()).toHaveAccessibleDescription(
      'Add your service keys now, or skip and add them later in Settings.',
    )
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    await press('Start')
    for (const [i, step] of steps.entries()) {
      const heading = screen.getByRole('heading', { name: step.heading })
      expect(heading).toHaveFocus()
      expect(dialog()).toHaveAccessibleDescription(step.line)
      expect(screen.getByRole('heading', { name: step.part, level: 2 })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument()
      if (i < steps.length - 1) await press('Next')
    }
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    await press('Back')
    expect(screen.getByRole('heading', { name: steps[1]!.heading })).toHaveFocus()
  })
})

describe('the endings [R2E-10, D8]', () => {
  const endings: Array<[string, () => Promise<void>]> = [
    ['Skip for now on the welcome step', () => press('Skip for now')],
    [
      'Skip for now on a step',
      async () => {
        await press('Start')
        await press('Skip for now')
      },
    ],
    [
      'Finish',
      async () => {
        await press('Start')
        await press('Next')
        await press('Next')
        await press('Finish')
      },
    ],
    [
      'Escape',
      async () => {
        await userEvent.keyboard('{Escape}')
      },
    ],
  ]

  it.each(endings)('%s closes the setup and sends setup.done once', async (_name, end) => {
    const fake = fresh()
    await renderApp(<FirstRun />, fake)
    await end()
    expect(dialog()).toBeNull()
    expect(marks(fake)).toEqual([{ name: 'settings.update', input: { setup: { done: true } } }])
  })

  it('closes and shows nothing when the mark is refused', async () => {
    const fake = fresh()
    fake.onCommand('settings.update', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Refused.' },
    }))
    await renderApp(<FirstRun />, fake)
    await press('Skip for now')
    expect(dialog()).toBeNull()
    expect(screen.queryByText('Refused.')).toBeNull()
  })
})

describe('a key typed in the setup [R2E-10, D8, R-10]', () => {
  it('stays open after a save, leaves no typed key in the page and sends only these commands', async () => {
    const fake = fresh()
    await renderApp(<FirstRun />, fake)
    await press('Start')
    await press('Add')
    await userEvent.type(screen.getByLabelText('New Google Gemini API key'), MADE_UP_KEY)
    fake.setState(
      baseState({
        settings: { ...baseState().settings, setup: { done: false } },
        secrets: [{ name: 'gemini.apiKey', lastFour: '9c' }],
      }),
    )
    await press('Save')
    await waitFor(() => expect(screen.getByText('Saved, ends in 9c')).toBeInTheDocument())
    expect(dialog()).toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain(MADE_UP_KEY)
    await press('Next')
    await press('Next')
    await press('Finish')
    expect(fake.commands.map((c) => c.name)).toEqual(['secret.set', 'settings.update'])
    expect(fake.commands[0]!.input).toEqual({ name: 'gemini.apiKey', value: MADE_UP_KEY })
  })
})

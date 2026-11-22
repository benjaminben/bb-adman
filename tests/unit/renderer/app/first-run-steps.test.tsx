// SET-7 (spec/phases/design-wave-screens-a.md): the first-run setup as a form dialog with a step
// strip. Each step's heading keeps its full name with a hidden "Step n of 3: ", the step's line
// sits in an InfoTip, and each Settings part is drawn open with no fold button.
import { describe, it, expect, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirstRun, closeSetup } from '@/renderer/app/first-run'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi, baseState } from '../fake-api'

afterEach(() => closeSetup())

const TITLE = 'Set up AdManager'
const WELCOME = 'Add your service keys now, or skip and add them later in Settings.'

function fresh() {
  const base = baseState()
  return makeFakeApi(baseState({ settings: { ...base.settings, setup: { done: false } } }))
}

const dialog = () => screen.getByRole('dialog', { name: TITLE })
const press = (name: string) => userEvent.click(screen.getByRole('button', { name }))
const strip = () => within(screen.getByRole('list', { name: 'Steps' }))

const STEPS = [
  {
    name: 'Step 1 of 3: AI keys',
    visible: 'AI keys',
    line: 'One key or a ComfyUI server lets you make pictures and videos.',
    part: 'Keys',
  },
  {
    name: 'Step 2 of 3: ComfyUI server',
    visible: 'ComfyUI server',
    line: 'Optional. Your own server makes pictures and videos at no charge.',
    part: 'ComfyUI server',
  },
  {
    name: 'Step 3 of 3: Cloud storage',
    visible: 'Cloud storage',
    line: 'Optional. Where Publish sends finished ads.',
    part: 'Cloud storage',
  },
]

async function goTo(step: number) {
  await press('Start')
  for (let i = 0; i < step; i += 1) await press('Next')
}

describe('the welcome step [SET-7]', () => {
  it('shows the one sentence as the description and a strip of three steps, none current', async () => {
    await renderApp(<FirstRun />, fresh())
    expect(dialog()).toHaveAccessibleDescription(WELCOME)
    const items = strip().getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Keys', 'ComfyUI', 'Storage'])
    expect(items.filter((item) => item.getAttribute('aria-current') === 'step')).toEqual([])
    expect(await axeViolations()).toEqual([])
  })
})

describe('each later step [SET-7]', () => {
  it.each(STEPS.map((step, i) => [step.visible, i, step] as const))(
    '%s: heading, strip, InfoTip line, part open, axe clean',
    async (_name, i, step) => {
      await renderApp(<FirstRun />, fresh())
      await goTo(i)
      const heading = screen.getByRole('heading', { name: step.name, level: 2 })
      expect(heading).toHaveFocus()
      const hidden = heading.querySelector('span')!
      expect(hidden.textContent).toBe(`Step ${i + 1} of 3:`)
      expect(heading.textContent).toBe(`${hidden.textContent} ${step.visible}`)

      const items = strip().getAllByRole('listitem')
      expect(items.map((item) => item.getAttribute('aria-current'))).toEqual(
        items.map((_item, k) => (k === i ? 'step' : null)),
      )

      expect(dialog()).not.toHaveAccessibleDescription(step.line)
      expect(screen.queryByText(step.line)).not.toBeVisible()
      await press('About this step')
      expect(screen.getByText(step.line)).toBeVisible()

      const part = screen.getByRole('heading', { name: step.part, level: 3 })
      expect(within(part).queryByRole('button')).toBeNull()
      expect(await axeViolations()).toEqual([])
    },
  )

  it('marks the steps before the current one as done with a check', async () => {
    await renderApp(<FirstRun />, fresh())
    await goTo(2)
    const items = strip().getAllByRole('listitem')
    expect(items.map((item) => item.hasAttribute('data-done'))).toEqual([true, true, false])
  })

  it('shows the ComfyUI privacy paragraph and its own Save on the ComfyUI step', async () => {
    await renderApp(<FirstRun />, fresh())
    await goTo(1)
    expect(screen.getByText(/ComfyUI/, { selector: 'p' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('has no approvals row in the storage step', async () => {
    await renderApp(<FirstRun />, fresh())
    await goTo(2)
    expect(screen.queryByRole('group', { name: 'Approvals' })).toBeNull()
    expect(screen.queryByText(/Approvals/)).toBeNull()
    expect(screen.getByRole('group', { name: 'Amazon S3' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Dropbox' })).toBeInTheDocument()
  })
})

describe('the endings [SET-7]', () => {
  const endings: Array<[string, () => Promise<void>]> = [
    [
      'Escape on a step',
      async () => {
        await goTo(1)
        await userEvent.keyboard('{Escape}')
      },
    ],
    ['Skip for now on the storage step', () => goTo(2).then(() => press('Skip for now'))],
    ['Finish', () => goTo(2).then(() => press('Finish'))],
  ]

  it.each(endings)('%s sends setup.done once and nothing else', async (_name, end) => {
    const fake = fresh()
    await renderApp(<FirstRun />, fake)
    await end()
    expect(screen.queryByRole('dialog', { name: TITLE })).toBeNull()
    expect(fake.commands).toEqual([{ name: 'settings.update', input: { setup: { done: true } } }])
  })
})

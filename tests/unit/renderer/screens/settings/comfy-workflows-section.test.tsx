// CW-4 (spec/comfyui-custom.md "Screens", D-104): the Settings Section "ComfyUI workflows".
// Nothing is sent before a click; the picked path is held only until the add is sent and is
// never drawn; a refusal shows the command's own sentence on the page.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ComfyWorkflowsSection } from '@/renderer/screens/settings/comfy-workflows-section'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import { axeViolations, renderApp } from '../../render'
import { makeFakeApi } from '../../fake-api'
import { comfyFake, info, workflow } from './comfy-fixture'
import { PORTRAIT, TIDE_CLIP, manyWorkflows } from './custom-workflow-fixture'

const PICKED = '/Users/made-up/Exports/Studio portrait.json'
const INTRO =
  'Add a workflow you made in ComfyUI. Start the title of each step Adman fills with adman:, then use Export (API).'
const LICENCE =
  'Adman cannot know the licence of a workflow you add. Check the licence of every model it uses before you use what it makes.'
const CANVAS = 'This is a ComfyUI canvas file. In ComfyUI, choose Export (API) and add that file.'

async function draw(workflows: WorkflowInfo[] = [workflow(), PORTRAIT, TIDE_CLIP]) {
  const made = comfyFake(info({ workflows }))
  const view = await renderApp(<ComfyWorkflowsSection />, made.fake)
  const box = await screen.findByRole('region', { name: 'ComfyUI workflows' })
  const sent = () => made.fake.commands.filter((c) => c.name.startsWith('comfyWorkflow.'))
  return { ...view, ...made, box, sent }
}

function answerPicker(fake: ReturnType<typeof comfyFake>['fake'], paths: string[]) {
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths } }))
}

describe('Settings: ComfyUI workflows [CW-4, D-104]', () => {
  it('is mounted right after "ComfyUI server" on the AI services page', async () => {
    await renderApp(<SettingsScreen page="ai" />, comfyFake().fake)
    const mine = await screen.findByRole('region', { name: 'ComfyUI workflows' })
    const server = screen.getByRole('region', { name: 'ComfyUI server' })
    expect(server.nextElementSibling).toBe(mine)
    expect(server.contains(mine)).toBe(false)
  })

  it('shows the intro, the licence line and the empty line, with "0 added"', async () => {
    const { box } = await draw([workflow()])
    expect(within(box).getByText(INTRO)).toBeVisible()
    expect(within(box).getByText(LICENCE)).toBeVisible()
    expect(within(box).getByText('No workflows added yet.')).toBeVisible()
    expect(within(box).getByText('0 added')).toBeInTheDocument()
    expect(within(box).queryByText('MOSS picture from a prompt')).toBeNull()
  })

  it('shows the empty line when comfy.getInfo gives no data', async () => {
    const fake = makeFakeApi()
    fake.onQuery('comfy.getInfo', () => ({ ok: true, data: null }))
    await renderApp(<ComfyWorkflowsSection />, fake)
    const box = await screen.findByRole('region', { name: 'ComfyUI workflows' })
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'comfy.getInfo')).toBe(true))
    expect(within(box).getByText('No workflows added yet.')).toBeVisible()
  })

  it('lists only the added workflows, with "{n} added" and nothing sent', async () => {
    const { box, sent } = await draw()
    const list = within(box).getByRole('list', { name: 'Added workflows' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(box).getByText('2 added')).toBeInTheDocument()
    expect(within(box).queryByText('No workflows added yet.')).toBeNull()
    expect(sent()).toEqual([])
  })

  it('"Add workflow…" asks the picker for a comfy-workflow file and sends the path once', async () => {
    const { fake, box, sent } = await draw()
    answerPicker(fake, [PICKED])
    fake.onCommand('comfyWorkflow.addFromFile', () => ({
      ok: true,
      data: { workflowId: 'custom-9a9b9c9d9e9f', name: 'Studio portrait 2' },
    }))
    await userEvent.click(within(box).getByRole('button', { name: 'Add workflow…' }))
    expect(fake.queries).toContainEqual({
      name: 'dialog.pickFiles',
      input: { purpose: 'comfy-workflow' },
    })
    expect(await within(box).findByText('Added Studio portrait 2.')).toBeVisible()
    expect(sent()).toEqual([{ name: 'comfyWorkflow.addFromFile', input: { filePath: PICKED } }])
    expect(document.body.innerHTML).not.toContain('Exports')
  })

  it('sends nothing when the picker is cancelled', async () => {
    const { fake, box, sent } = await draw()
    answerPicker(fake, [])
    await userEvent.click(within(box).getByRole('button', { name: 'Add workflow…' }))
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true))
    expect(sent()).toEqual([])
  })

  it.each<[string, Result<unknown>]>([
    ['no paths', { ok: true, data: { paths: [] } }],
    ['no data', { ok: true, data: null }],
    ['a refused pick', { ok: false, error: { code: 'INTERNAL', message: 'No.' } }],
  ])('a cancelled picker (%s) sends nothing', async (_shape, reply) => {
    const { fake, box, sent } = await draw()
    fake.onQuery('dialog.pickFiles', () => reply)
    await userEvent.click(within(box).getByRole('button', { name: 'Add workflow…' }))
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true))
    expect(sent()).toEqual([])
    expect(within(box).queryByRole('status')).toBeNull()
  })

  it('a double click on "Add workflow…" asks the picker once and adds once', async () => {
    const { fake, box, sent } = await draw()
    let pick: (paths: string[]) => void = () => {}
    fake.onQuery(
      'dialog.pickFiles',
      () => new Promise((resolve) => (pick = (paths) => resolve({ ok: true, data: { paths } }))),
    )
    fake.onCommand('comfyWorkflow.addFromFile', () => ({
      ok: true,
      data: { workflowId: 'custom-9a9b9c9d9e9f', name: 'Studio portrait 2' },
    }))
    await userEvent.dblClick(within(box).getByRole('button', { name: 'Add workflow…' }))
    act(() => pick([PICKED]))
    expect(await within(box).findByText('Added Studio portrait 2.')).toBeVisible()
    expect(fake.queries.filter((q) => q.name === 'dialog.pickFiles')).toHaveLength(1)
    expect(sent()).toEqual([{ name: 'comfyWorkflow.addFromFile', input: { filePath: PICKED } }])
  })

  it('shows a refusal as the command’s own sentence, on the page', async () => {
    const { fake, box } = await draw()
    answerPicker(fake, [PICKED])
    fake.onCommand('comfyWorkflow.addFromFile', () => ({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: CANVAS,
        details: { reason: 'workflow_canvas_format' },
      },
    }))
    await userEvent.click(within(box).getByRole('button', { name: 'Add workflow…' }))
    const line = await within(box).findByText(CANVAS)
    expect(line).toBeVisible()
    expect(line.tagName).toBe('P')
    expect(document.body.innerHTML).not.toContain('Exports')
  })

  it('at 50 workflows the button is disabled with its title', async () => {
    const { box } = await draw(manyWorkflows(50))
    const add = within(box).getByRole('button', { name: 'Add workflow…' })
    expect(add).toBeDisabled()
    expect(add).toHaveAttribute('title', 'You can add at most 50 workflows.')
  })

  it('"Change" and "Remove {name}" open their dialogs and send nothing', async () => {
    const { box, sent } = await draw()
    await userEvent.click(within(box).getAllByRole('button', { name: 'Change' })[1]!)
    expect(await screen.findByRole('dialog', { name: 'Change workflow' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(within(box).getByRole('button', { name: 'Remove Tide clip' }))
    expect(await screen.findByRole('dialog', { name: 'Remove Tide clip?' })).toBeInTheDocument()
    expect(sent()).toEqual([])
  })

  it('reads comfy.getInfo again when the app state changes', async () => {
    const { fake, box, setInfo } = await draw([])
    setInfo(info({ workflows: [PORTRAIT] }))
    act(() => fake.emit('app.stateChanged', {}))
    expect(await within(box).findByText('Studio portrait')).toBeVisible()
  })

  it('"How to mark steps" is folded and shows the marks in short form when opened', async () => {
    const { box } = await draw()
    const fold = within(box).getByRole('button', { name: 'How to mark steps' })
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(fold)
    const help = screen.getByRole('region', { name: 'How to mark steps' })
    expect(within(help).getByText('adman: prompt')).toBeVisible()
    expect(within(help).getByText('The prompt')).toBeVisible()
    expect(within(help).getByText('adman: output')).toBeVisible()
    expect(within(help).getByText('adman: seed=noise_seed')).toBeVisible()
  })

  it('has no accessibility violations, empty and with rows', async () => {
    const empty = await draw([])
    expect(await axeViolations()).toEqual([])
    empty.unmount()
    const { box } = await draw()
    await userEvent.click(within(box).getByRole('button', { name: 'How to mark steps' }))
    expect(await axeViolations()).toEqual([])
  })
})

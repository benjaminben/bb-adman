// CW-4 (spec/comfyui-custom.md "Screens", D-104): "Change workflow", a form dialog. "Name";
// the size fields only when the graph has size marks; the video fields only for video.
// comfyWorkflow.update is sent only on "Save", once. A refusal shows in the dialog.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { ChangeWorkflow } from '@/renderer/dialogs/change-workflow'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import { sizeFromChoice } from '@/shared/comfy/custom-workflow'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { PORTRAIT, TIDE_CLIP } from '../screens/settings/custom-workflow-fixture'

const TAKEN = 'A workflow with that name already exists.'

function Opener(props: { workflow: WorkflowInfo; sizeMarks: boolean; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <h1>Settings</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <ChangeWorkflow
        workflow={open ? props.workflow : null}
        sizeMarks={props.sizeMarks}
        onClose={() => {
          setOpen(false)
          props.onClose()
        }}
      />
    </main>
  )
}

async function draw(workflow: WorkflowInfo, sizeMarks: boolean, fake = makeFakeApi()) {
  let closed = 0
  await renderApp(
    <Opener workflow={workflow} sizeMarks={sizeMarks} onClose={() => (closed += 1)} />,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
  const dialog = await screen.findByRole('dialog', { name: 'Change workflow' })
  const sent = () => fake.commands.filter((c) => c.name === 'comfyWorkflow.update')
  return { fake, dialog, box: within(dialog), sent, closed: () => closed }
}

describe('Change workflow [CW-4, D-104]', () => {
  it('starts with the name, and no size or video fields for a picture with no size marks', async () => {
    const { box, sent } = await draw(PORTRAIT, false)
    expect(box.getByLabelText('Name')).toHaveValue('Studio portrait')
    expect(box.queryByLabelText('Largest size')).toBeNull()
    expect(box.queryByLabelText('Sides are a multiple of')).toBeNull()
    expect(box.queryByLabelText('Frames per second')).toBeNull()
    expect(sent()).toEqual([])
  })

  it('shows the size choices when the graph has size marks, set to the stored size', async () => {
    const workflow = { ...PORTRAIT, size: sizeFromChoice(32, 2) }
    const { box } = await draw(workflow, true)
    const largest = box.getByLabelText('Largest size')
    const options = within(largest)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual([
      '0.25 megapixels',
      '0.4 megapixels',
      '0.5 megapixels',
      '1 megapixel',
      '2 megapixels',
      '4 megapixels',
    ])
    expect(largest).toHaveValue('2')
    expect(box.getByLabelText('Sides are a multiple of')).toHaveValue('32')
    expect(box.queryByLabelText('Frames per second')).toBeNull()
  })

  it('shows the video values for a video workflow', async () => {
    const { box } = await draw(TIDE_CLIP, false)
    expect(box.getByLabelText('Frames per second')).toHaveValue(16)
    expect(box.getByLabelText('Longest clip, in seconds')).toHaveValue(8)
    const counts = box.getByRole('group', { name: 'Frame counts it takes' })
    expect(within(counts).getByLabelText('a multiple of')).toHaveValue(4)
    expect(within(counts).getByLabelText('plus')).toHaveValue(1)
    expect(within(counts).getByText('Frame counts it takes:')).toBeVisible()
    expect(box.queryByLabelText('Largest size')).toBeNull()
  })

  it('sends nothing on typing or on "Cancel"', async () => {
    const { box, sent, closed } = await draw(TIDE_CLIP, true)
    await userEvent.type(box.getByLabelText('Name'), ' at dusk')
    await userEvent.selectOptions(box.getByLabelText('Largest size'), '1')
    await userEvent.click(box.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(closed()).toBe(1))
    expect(sent()).toEqual([])
  })

  it('sends nothing on Escape', async () => {
    const { box, sent, closed } = await draw(TIDE_CLIP, true)
    await userEvent.type(box.getByLabelText('Name'), ' at dusk')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(closed()).toBe(1))
    expect(sent()).toEqual([])
  })

  it('"Save" sends comfyWorkflow.update once with the shown values, then closes', async () => {
    const fake = makeFakeApi()
    let finish: (r: Result<unknown>) => void = () => {}
    fake.onCommand('comfyWorkflow.update', () => new Promise((resolve) => (finish = resolve)))
    const { box, sent, closed } = await draw(TIDE_CLIP, true, fake)
    const name = box.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Tide clip, slow')
    await userEvent.selectOptions(box.getByLabelText('Sides are a multiple of'), '64')
    const fps = box.getByLabelText('Frames per second')
    await userEvent.clear(fps)
    await userEvent.type(fps, '24')
    await userEvent.dblClick(box.getByRole('button', { name: 'Save' }))
    expect(sent()).toEqual([
      {
        name: 'comfyWorkflow.update',
        input: {
          workflowId: 'custom-1a2b3c4d5e6f',
          name: 'Tide clip, slow',
          size: { multiple: 64, maxMegapixels: 0.4 },
          video: { fps: 24, maxMs: 8_000, frameStep: 4, frameOffset: 1 },
        },
      },
    ])
    finish({ ok: true, data: { workflowId: 'custom-1a2b3c4d5e6f' } })
    await waitFor(() => expect(closed()).toBe(1))
  })

  it('sends only the name for a picture with no size marks', async () => {
    const { box, sent } = await draw(PORTRAIT, false)
    await userEvent.click(box.getByRole('button', { name: 'Save' }))
    expect(sent()).toEqual([
      {
        name: 'comfyWorkflow.update',
        input: { workflowId: 'custom-0a1b2c3d4e5f', name: 'Studio portrait' },
      },
    ])
  })

  it('shows a refusal in the dialog, which stays open', async () => {
    const fake = makeFakeApi()
    fake.onCommand('comfyWorkflow.update', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: TAKEN, details: { reason: 'workflow_name_taken' } },
    }))
    const { box, closed } = await draw(PORTRAIT, false, fake)
    await userEvent.click(box.getByRole('button', { name: 'Save' }))
    expect(await box.findByRole('alert')).toHaveTextContent(TAKEN)
    expect(closed()).toBe(0)
    expect(box.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('has no accessibility violations, with every field shown', async () => {
    await draw(TIDE_CLIP, true)
    expect(await axeViolations()).toEqual([])
  })
})

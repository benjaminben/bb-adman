// CW-4 (spec/comfyui-custom.md "Screens", D-104): one added workflow as a row. The name, then
// "{job words} · {n} nodes", plus " · Added by an agent" only when an agent added it. No text
// from the graph is drawn.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ComfyWorkflowRow } from '@/renderer/screens/settings/comfy-workflow-row'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { axeViolations } from '../../render'
import { HARBOUR_FIRST, PORTRAIT, TIDE_CLIP } from './custom-workflow-fixture'

function draw(workflow: WorkflowInfo) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  render(
    <main>
      <ul aria-label="Added workflows">
        <ComfyWorkflowRow workflow={workflow} onChange={onChange} onRemove={onRemove} />
      </ul>
    </main>,
  )
  return { onChange, onRemove, item: screen.getByRole('listitem') }
}

describe('ComfyUI workflow row [CW-4, D-104]', () => {
  it.each([
    [PORTRAIT, 'Picture from a prompt · 12 nodes'],
    [TIDE_CLIP, 'Video from a prompt · 31 nodes · Added by an agent'],
    [HARBOUR_FIRST, 'Video from a first frame · 1 node'],
  ])('shows the name and its line of words', (workflow, words) => {
    const { item } = draw(workflow)
    expect(item).toHaveTextContent(workflow.label)
    expect(screen.getByText(words)).toBeVisible()
  })

  it('says "Added by an agent" only when an agent added it', () => {
    draw(PORTRAIT)
    expect(screen.queryByText(/Added by an agent/)).toBeNull()
  })

  it('"Change" and "Remove {name}" call their handlers', async () => {
    const { onChange, onRemove } = draw(TIDE_CLIP)
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    const remove = screen.getByRole('button', { name: 'Remove Tide clip' })
    expect(remove).toHaveAttribute('title', 'Remove Tide clip')
    await userEvent.click(remove)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('has no accessibility violations', async () => {
    draw(TIDE_CLIP)
    expect(await axeViolations()).toEqual([])
  })
})

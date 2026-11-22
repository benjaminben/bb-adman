// R2E-2 (spec/phases/round-2-editor.md D2, "Banner"): after "Place text with AI" puts its boxes
// on the layers, the banner says how many texts had their colours changed, with Dismiss.
import '../../shared/scene/fake-fonts'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import { EditorBanner } from '@/renderer/editor/editor-banner'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import { BACKGROUND, HEADLINE, LOGO, P, V, variantGet } from './editor-fixture'

const ONE = 'Text colour changed for legibility (1)'
const TWO = 'Text colour changed for legibility (2)'

describe('EditorBanner changed line [D2 "Banner"]', () => {
  it.each([
    [1, ONE],
    [2, TWO],
  ])(
    'says how many texts (%d) had their colours changed, and Dismiss calls back',
    async (count, words) => {
      const onDismiss = vi.fn()
      render(
        <EditorBanner
          missingFile
          overflowCount={0}
          layout={{ kind: 'changed', count, onDismiss }}
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        new RegExp(`^${words.replace(/[()]/g, '\\$&')}$`),
      )
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(onDismiss).toHaveBeenCalledOnce()
      expect(await axeViolations()).toEqual([])
    },
  )
})

const SECOND = { ...HEADLINE, id: 'L2-id', key: 'L2', name: 'Subhead' }

const box = (slot: string, readable: LayoutJobBox['readable']): LayoutJobBox => ({
  slot,
  x: 40,
  y: 60,
  width: 1000,
  height: 240,
  fontSize: 96,
  color: '#000000',
  align: 'left',
  readable,
})

const row = (status: JobRow['status'], boxes: LayoutJobBox[]) =>
  jobRow('J1', {
    kind: 'layout_proposal',
    status,
    variantId: V,
    slot: null,
    request: {},
    result: status === 'succeeded' ? { boxes } : null,
  })

async function placed(boxes: LayoutJobBox[]) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: variantGet({ layers: [BACKGROUND, HEADLINE, SECOND, LOGO] }),
  }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  fake.onQuery('job.get', () => ({ ok: true, data: row('succeeded', boxes) }))
  fake.onCommand('generation.proposeLayout', () => ({ ok: true, data: { jobId: 'J1' } }))
  await renderApp(<Editor projectId={P} variantId={V} />, fake)
  await screen.findByRole('heading', { name: 'Master post' })
  await userEvent.click(screen.getByRole('button', { name: 'Place text with AI…' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Place text' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fake.emit('job.updated', row('succeeded', boxes))
  await waitFor(() => expect(fake.commands.some((c) => c.name === 'job.markSeen')).toBe(true))
  return fake
}

describe('Place text with AI tells what it changed [D2 "Banner"]', () => {
  it('counts the applied boxes whose colour changed or got a text box', async () => {
    await placed([box(HEADLINE.key, 'colour'), box(SECOND.key, 'box'), box('gone', 'box')])
    expect(await screen.findByRole('status')).toHaveTextContent(TWO)
  })

  it('Dismiss clears the line', async () => {
    await placed([box(HEADLINE.key, 'colour')])
    expect(await screen.findByRole('status')).toHaveTextContent(ONE)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('the next run clears the line', async () => {
    await placed([box(HEADLINE.key, 'box')])
    await screen.findByRole('status')
    await userEvent.click(screen.getByRole('button', { name: 'Place text with AI…' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Place text' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Placing text with AI…')
  })

  it.each([
    ['every box kept', [box(HEADLINE.key, 'kept')]],
    ['a result stored before the check', [box(HEADLINE.key, undefined)]],
  ])('shows no line when %s', async (_c, boxes) => {
    await placed(boxes)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

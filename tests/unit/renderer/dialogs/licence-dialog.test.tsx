import { describe, it, expect } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LicenceDialog } from '@/renderer/dialogs/licence-dialog'
import type { LicenceAnswer } from '@/renderer/stores/app-store'
import { renderApp, axeViolations } from '../render'
import { makeFakeApi } from '../fake-api'

const H3_TITLE =
  'MiniMax H3 requires a commercial license, please confirm that you have one before production use'
const BOX = "don't show again for MiniMax H3"

function withInfo(workflows: Array<{ id: string; model: { label: string } }>) {
  const fake = makeFakeApi()
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows, leavesOnServer: [] },
  }))
  return fake
}

const H3 = [{ id: 'h3-text-to-video', model: { label: 'MiniMax H3' } }]

async function open(fake = withInfo(H3), workflow = 'h3-text-to-video', saving = false) {
  const view = await renderApp(<LicenceDialog />, fake)
  let answer: LicenceAnswer | undefined
  act(() => {
    view.store.setState({ licenceRequest: { workflow, saving, resolve: (a) => (answer = a) } })
  })
  await screen.findByRole('dialog')
  return { ...view, answer: () => answer }
}

describe('licence dialog [S2-6, D-088]', () => {
  it('names the model from comfy.getInfo in the title and the box, not ticked', async () => {
    await open()
    expect(screen.getByRole('dialog', { name: H3_TITLE })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: BOX })).not.toBeChecked()
  })

  it.each([
    ['the workflow is not listed', withInfo([{ id: 'moss-extend', model: { label: 'MOSS' } }])],
    [
      'the query is refused',
      (() => {
        const fake = makeFakeApi()
        fake.onQuery('comfy.getInfo', () => ({
          ok: false,
          error: { code: 'INTERNAL', message: 'Something went wrong.' },
        }))
        return fake
      })(),
    ],
  ])('reads "This model" when %s, and has no box to save it', async (_why, fake) => {
    await open(fake)
    expect(
      screen.getByRole('dialog', {
        name: 'This model requires a commercial license, please confirm that you have one before production use',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('puts focus on the box, then Cancel, then Confirm', async () => {
    await open()
    expect(screen.getByRole('checkbox', { name: BOX })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
  })

  it.each([
    [false, { confirmed: true, remember: null }],
    [true, { confirmed: true, remember: 'MiniMax H3' }],
  ])('Confirm with the box ticked %s answers %j', async (tick, expected) => {
    const view = await open()
    if (tick) await userEvent.click(screen.getByRole('checkbox', { name: BOX }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(view.answer()).toEqual(expected)
  })

  it.each([
    ['the Cancel button', () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('answers a cancel by %s and sends nothing', async (_how, cancel) => {
    const view = await open()
    await cancel()
    await waitFor(() => expect(view.answer()).toEqual({ confirmed: false, remember: null }))
    expect(view.fake.commands).toEqual([])
  })

  it('shows Saving… with the buttons disabled while the model is saved, and stays open', async () => {
    const view = await open(withInfo(H3), 'h3-text-to-video', true)
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: H3_TITLE })).toBeInTheDocument()
    expect(view.answer()).toBeUndefined()
  })

  it('has no axe violations', async () => {
    await open()
    expect(await axeViolations()).toEqual([])
  })
})

// R2P-6 (spec/phases/round-2-platform.md, D7): the permission dialog for an import ask. The
// paths come only from agent.askFiles, asked with the request ID, and are drawn in full as
// text, in order. "Import" works only once the whole list is shown and 750 ms have passed; a
// list that cannot be read leaves only "Refuse"; there is no tick; Escape refuses.
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import { visiblePath } from '@/renderer/app/permission-dialog/file-list'
import type { EventMap } from '@/shared/schemas/events'
import type { Result } from '@/shared/schemas/result'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

type Ask = EventMap['agent.permissionRequested']

const FILES = [
  '/Users/sam/Shoots/Lakeside/serum-front.jpg',
  '/Users/sam/Shoots/Lakeside/serum-side.png',
  '/Users/sam/Shoots/Lakeside/model-01.jpg',
]
const TARGET = '3 files into "Lakeside Beauty"'
const BRIEF_TARGET = 'Campaign "Spring Glow" with 1 file for its subjects, in "Lakeside Beauty"'

function request(overrides: Partial<Ask> = {}): Ask {
  return {
    requestId: 'made-up-request-7',
    agentClient: null,
    action: 'import files',
    target: TARGET,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    kind: 'import',
    fileCount: 3,
    ...overrides,
  }
}

type Reply = Result<unknown> | Promise<Result<unknown>>

async function open(ask: Ask = request(), reply: () => Reply = () => ok(FILES)) {
  const fake = makeFakeApi()
  fake.onQuery('agent.askFiles', reply)
  await renderApp(<PermissionDialog />, fake)
  act(() => fake.emit('agent.permissionRequested', ask))
  const dialog = await screen.findByRole('dialog')
  const answers = () => fake.commands.filter((c) => c.name === 'agent.answerPermission')
  const asks = () => fake.queries.filter((q) => q.name === 'agent.askFiles')
  return { fake, dialog, answers, asks }
}

function ok(files: string[]): Result<unknown> {
  return { ok: true, data: { files } }
}

function items(dialog: HTMLElement): string[] {
  const list = within(dialog).getByRole('list', { name: 'Files' })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

describe('permission dialog for files [R2P-6, D7]', () => {
  it('asks for the list with the request ID and draws each path in full, in order', async () => {
    const { dialog, asks } = await open()
    await waitFor(() => expect(items(dialog)).toEqual(FILES))
    expect(asks().map((q) => q.input)).toEqual([{ requestId: 'made-up-request-7' }])
    expect(dialog).toHaveAccessibleName('An agent asks to import files')
    expect(dialog).toHaveTextContent(`An agent wants to import files: ${TARGET}.`)
    expect(within(dialog).getByRole('button', { name: 'Refuse' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('shows a path holding markup as its literal characters', async () => {
    const odd = '/Users/sam/<img src=x onerror="alert(1)">/<b>bold</b> &amp; "q".jpg'
    const { dialog } = await open(request({ fileCount: 1 }), () => ok([odd]))
    await waitFor(() => expect(items(dialog)).toEqual([odd]))
    expect(dialog.querySelector('img, b, script')).toBeNull()
  })

  it.each([
    ['a line break', '/Users/sam/a\n/Users/sam/b.jpg', '/Users/sam/a[U+000A]/Users/sam/b.jpg'],
    ['a right-to-left mark', '/Users/sam/‮gpj.exe', '/Users/sam/[U+202E]gpj.exe'],
    ['a zero-width space', '/Users/sam/a​b.jpg', '/Users/sam/a[U+200B]b.jpg'],
    ['plain accents', '/Users/sam/Séance été.jpg', '/Users/sam/Séance été.jpg'],
  ])('makes %s in a path visible', (_case, path, shown) => {
    expect(visiblePath(path)).toBe(shown)
  })

  it('keeps Import off until the list shows and 750 ms pass', async () => {
    let send: (r: Result<unknown>) => void = () => undefined
    const pending = new Promise<Result<unknown>>((resolve) => (send = resolve))
    const { dialog, answers } = await open(request(), () => pending)
    expect(dialog).toHaveTextContent('Loading the list of files…')
    const allow = within(dialog).getByRole('button', { name: 'Import' })
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(allow).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(allow)
    act(() => send(ok(FILES)))
    await waitFor(() => expect(items(dialog)).toEqual(FILES))
    expect(allow).toHaveAttribute('aria-disabled', 'true')
    const shownAt = Date.now()
    await waitFor(() => expect(allow).not.toHaveAttribute('aria-disabled'), { timeout: 5000 })
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(700)
    expect(answers()).toEqual([])
    await userEvent.click(allow)
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-7', allow: true, rememberAuto: false },
      ]),
    )
  })

  it.each([
    ['a refused query', () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'Ended.' } })],
    ['a reply of the wrong shape', () => ({ ok: true, data: { files: [7] } })],
    ['a count other than the ask', () => ok(FILES.slice(0, 2))],
    ['a query that throws', () => Promise.reject(new Error('gone'))],
  ] as Array<[string, () => Reply]>)('offers only Refuse after %s', async (_case, reply) => {
    const { dialog, answers } = await open(request(), reply)
    expect(await within(dialog).findByText('The list of files could not be shown.')).toBeVisible()
    expect(within(dialog).queryByRole('list')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Import' })).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refuse' }))
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-7', allow: false, rememberAuto: false },
      ]),
    )
  })

  it('has no "always allow" tick, and Escape refuses', async () => {
    const { dialog, answers } = await open()
    await waitFor(() => expect(items(dialog)).toEqual(FILES))
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-7', allow: false, rememberAuto: false },
      ]),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('uses the brief command words, with Allow, and never sends a path', async () => {
    const ask = request({
      action: 'make campaigns that import files',
      target: BRIEF_TARGET,
      fileCount: 1,
      agentClient: 'Planner',
    })
    const { dialog, fake } = await open(ask, () => ok(FILES.slice(0, 1)))
    await waitFor(() => expect(items(dialog)).toEqual(FILES.slice(0, 1)))
    expect(dialog).toHaveAccessibleName('An agent asks to make a campaign with files')
    expect(dialog).toHaveTextContent(
      `Agent named Planner wants to make campaigns that import files: ${BRIEF_TARGET}.`,
    )
    const allow = within(dialog).getByRole('button', { name: 'Allow' })
    await waitFor(() => expect(allow).not.toHaveAttribute('aria-disabled'), { timeout: 5000 })
    await userEvent.click(allow)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(JSON.stringify(fake.commands)).not.toContain('/Users/sam')
    expect(await axeViolations()).toEqual([])
  })
})

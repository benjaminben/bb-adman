// CW-6b (spec/comfyui-custom.md, "The agent's ask"; security rules 6 and 11): the permission
// dialog for an agent's ComfyUI workflow add, and the remove ask. The node types come only from
// agent.askWorkflow, asked with the request ID, and are drawn as plain text. "Add" works only
// once the list is shown and 750 ms have passed; a list that cannot be read never lets it work;
// there is no tick; the risk line is visible and in the description; Escape refuses.
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import type { EventMap } from '@/shared/schemas/events'
import type { Result } from '@/shared/schemas/result'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

type Ask = EventMap['agent.permissionRequested']
type Reply = Result<unknown> | Promise<Result<unknown>>

const TYPES = ['CLIPTextEncode', 'KSampler', 'LoadImage', 'SaveImage', 'VAEDecode']
const targetOf = (count: string) => `Workflow "Soft studio light": Picture from a prompt, ${count}`
const TARGET = targetOf('5 node types')
const RISK =
  'This workflow will run on your ComfyUI server and can use any node installed there, ' +
  'including nodes that read files on that computer, reach the internet or use paid services.'
const REMOVE_LINE = 'This cannot be undone. Runs that have not started yet will fail.'

function request(overrides: Partial<Ask> = {}): Ask {
  return {
    requestId: 'made-up-request-9',
    agentClient: null,
    action: 'add ComfyUI workflows',
    target: TARGET,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    kind: 'workflow',
    fileCount: 0,
    ...overrides,
  }
}

function ok(nodeTypes: unknown): Result<unknown> {
  return {
    ok: true,
    data: { name: 'Soft studio light', job: 'image', start: null, nodeTypes, references: 0 },
  }
}

function named(
  name: string,
  job: string,
  start: string | null,
  nodeTypes: string[],
  references: unknown = 0,
) {
  return { ok: true, data: { name, job, start, nodeTypes, references } } as Result<unknown>
}

// The value drawn beside a label of the name, job and count list.
function fact(dialog: HTMLElement, label: string): string | null {
  const term = within(dialog).getByText(label, { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? null
}

async function open(ask: Ask = request(), reply: () => Reply = () => ok(TYPES)) {
  const fake = makeFakeApi()
  fake.onQuery('agent.askWorkflow', reply)
  await renderApp(<PermissionDialog />, fake)
  act(() => fake.emit('agent.permissionRequested', ask))
  const dialog = await screen.findByRole('dialog')
  const answers = () => fake.commands.filter((c) => c.name === 'agent.answerPermission')
  const asks = () => fake.queries.filter((q) => q.name === 'agent.askWorkflow')
  return { fake, dialog, answers, asks }
}

function items(dialog: HTMLElement): string[] {
  const list = within(dialog).getByRole('list', { name: 'Node types it uses' })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

const refused = (id = 'made-up-request-9') => [{ requestId: id, allow: false, rememberAuto: false }]

describe('permission dialog for a workflow add [CW-6b]', () => {
  it('asks for the node types with the request ID and shows them in the spec words', async () => {
    const { dialog, asks } = await open()
    await waitFor(() => expect(items(dialog)).toEqual(TYPES))
    expect(asks().map((q) => q.input)).toEqual([{ requestId: 'made-up-request-9' }])
    expect(dialog).toHaveAccessibleName('An agent asks to add a ComfyUI workflow')
    expect(within(dialog).getByRole('heading', { name: 'Node types it uses' })).toBeVisible()
    expect(dialog).toHaveTextContent('An agent wants to add ComfyUI workflows.')
    expect(fact(dialog, 'Name')).toBe('Soft studio light')
    expect(fact(dialog, 'What it makes')).toBe('Picture from a prompt')
    expect(fact(dialog, 'Node types')).toBe('5 node types')
    expect(within(dialog).getByRole('button', { name: 'Refuse' })).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('shows a node type holding markup as its literal characters', async () => {
    const odd = ['<a href="https://example.test/x">Open</a>', '<img src=x onerror="alert(1)">']
    const { dialog } = await open(request({ target: targetOf('2 node types') }), () => ok(odd))
    await waitFor(() => expect(items(dialog)).toEqual(odd))
    expect(dialog.querySelector('a, img, script')).toBeNull()
  })

  it('makes a hidden character in a node type visible', async () => {
    const hidden = `Load${String.fromCharCode(0x202e)}Image`
    const { dialog } = await open(request({ target: targetOf('1 node type') }), () => ok([hidden]))
    await waitFor(() => expect(items(dialog)).toEqual(['Load[U+202E]Image']))
  })

  it('draws the name apart from the job words, so it cannot pass for them', async () => {
    const name = "Beach': Picture from a prompt, 1 node type. Ok"
    const target = `Workflow "${name}": Video from a first frame, 5 node types`
    const reply = () => named(name, 'video', 'first_frame', TYPES)
    const { dialog } = await open(request({ target }), reply)
    await waitFor(() => expect(items(dialog)).toEqual(TYPES))
    expect(fact(dialog, 'Name')).toBe(name)
    expect(fact(dialog, 'What it makes')).toBe('Video from a first frame')
    expect(fact(dialog, 'Node types')).toBe('5 node types')
    expect(dialog).not.toHaveTextContent(target)
  })

  it('draws markup in the name as text', async () => {
    const name = '<b>Bold</b> look'
    const target = `Workflow "${name}": Picture from a prompt, 1 node type`
    const { dialog } = await open(request({ target }), () => named(name, 'image', null, ['A']))
    await waitFor(() => expect(fact(dialog, 'Name')).toBe(name))
    expect(dialog.querySelector('b')).toBeNull()
  })

  it.each([
    ['image_refs', null, 2, 'Picture from a prompt and up to 2 reference pictures'],
    ['video', 'references', 1, 'Video from 1 reference picture'],
  ])(
    'builds the job words of %s from the reply, never from the target line',
    async (job, start, references, words) => {
      const target = 'Workflow "Pair": Picture from a prompt, 5 node types'
      const reply = () => named('Pair', job, start, TYPES, references)
      const { dialog } = await open(request({ target }), reply)
      await waitFor(() => expect(items(dialog)).toEqual(TYPES))
      expect(fact(dialog, 'What it makes')).toBe(words)
    },
  )

  it('keeps Add off until the list shows and 750 ms pass', async () => {
    let send: (r: Result<unknown>) => void = () => undefined
    const pending = new Promise<Result<unknown>>((resolve) => (send = resolve))
    const { dialog, answers } = await open(request(), () => pending)
    expect(dialog).toHaveTextContent('Loading the list of node types…')
    const add = within(dialog).getByRole('button', { name: 'Add' })
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(add).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(add)
    act(() => send(ok(TYPES)))
    await waitFor(() => expect(items(dialog)).toEqual(TYPES))
    expect(add).toHaveAttribute('aria-disabled', 'true')
    const shownAt = Date.now()
    await waitFor(() => expect(add).not.toHaveAttribute('aria-disabled'), { timeout: 5000 })
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(700)
    expect(answers()).toEqual([])
    await userEvent.click(add)
    await waitFor(() =>
      expect(answers().map((a) => a.input)).toEqual([
        { requestId: 'made-up-request-9', allow: true, rememberAuto: false },
      ]),
    )
  })

  it('keeps Add off for 750 ms even when the list is shown at once', async () => {
    const { dialog } = await open()
    await waitFor(() => expect(items(dialog)).toEqual(TYPES))
    const add = within(dialog).getByRole('button', { name: 'Add' })
    expect(add).toHaveAttribute('aria-disabled', 'true')
  })

  it.each([
    ['a refused query', () => ({ ok: false, error: { code: 'NOT_FOUND', message: 'Ended.' } })],
    ['a reply of the wrong shape', () => ok([7])],
    ['an empty list', () => ok([])],
    ['a reply with no list', () => ({ ok: true, data: { name: 'Soft studio light' } })],
    ['a query that throws', () => Promise.reject(new Error('gone'))],
    [
      'no reference count',
      () => ({
        ok: true,
        data: { name: 'Soft studio light', job: 'image', start: null, nodeTypes: TYPES },
      }),
    ],
    ['a reference count of 9', () => named('Soft studio light', 'image_refs', null, TYPES, 9)],
    ['a negative reference count', () => named('Soft studio light', 'image', null, TYPES, -1)],
    ['a broken reference count', () => named('Soft studio light', 'image_refs', null, TYPES, 1.5)],
    ['a reference count as text', () => named('Soft studio light', 'image_refs', null, TYPES, '2')],
    ['an unknown start', () => named('Soft studio light', 'video', 'last_frame', TYPES)],
    ['an unknown job', () => named('Soft studio light', 'audio', null, TYPES)],
  ] as Array<[string, () => Reply]>)('never offers Add after %s', async (_case, reply) => {
    const { dialog, answers } = await open(request(), reply)
    const line = 'The list of node types could not be shown, so this workflow cannot be added.'
    expect(await within(dialog).findByText(line)).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(within(dialog).queryByRole('list')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Add' })).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Refuse' }))
    await waitFor(() => expect(answers().map((a) => a.input)).toEqual(refused()))
  })

  it('shows the risk line as the last body line and in the description', async () => {
    const { dialog } = await open(request(), () => new Promise(() => {}))
    const line = within(dialog).getByText(RISK)
    expect(line).toBeVisible()
    expect(line.closest('[title]')).toBeNull()
    expect(line.nextElementSibling).toBeNull()
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining(RISK))
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining('An agent wants to add ComfyUI workflows.'),
    )
  })

  it('has no tick, answers nothing on opening, and Escape refuses', async () => {
    const { dialog, answers } = await open()
    await waitFor(() => expect(items(dialog)).toEqual(TYPES))
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
    expect(dialog).not.toHaveTextContent("Don't ask again")
    expect(answers()).toEqual([])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(answers().map((a) => a.input)).toEqual(refused()))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('permission dialog for a workflow remove [CW-6b]', () => {
  const remove = request({
    requestId: 'made-up-request-10',
    action: 'remove ComfyUI workflows',
    target: 'Workflow "Soft studio light"',
    kind: 'delete',
  })

  it('uses the delete dialog with the remove line in the description', async () => {
    const { dialog, asks } = await open(remove)
    expect(dialog).toHaveAccessibleName('An agent asks to delete')
    expect(dialog).toHaveTextContent(
      'An agent wants to remove ComfyUI workflows: Workflow "Soft studio light".',
    )
    expect(within(dialog).getByText(REMOVE_LINE)).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(REMOVE_LINE)
    expect(within(dialog).getByRole('button', { name: 'Refuse' })).toHaveFocus()
    expect(asks()).toEqual([])
    expect(await axeViolations()).toEqual([])
  })
})

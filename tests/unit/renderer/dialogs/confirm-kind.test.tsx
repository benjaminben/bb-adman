// Design wave DLG-2 (spec/phases/design-wave-screens-b.md, "DLG-2"): the delete warning, the
// licence confirmation and an agent's ask take the `confirm` kind. Markup only: every word, as
// captured on `main` before the change, is pinned here piece by piece, with each dialog's
// accessible description; the guards (focus, the 750 ms wait, the full path list, one send)
// are checked again on the new markup.
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../shared/scene/fake-fonts'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import { LicenceDialog } from '@/renderer/dialogs/licence-dialog'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import type { EventMap } from '@/shared/schemas/events'
import type { Result } from '@/shared/schemas/result'
import alert from '@/renderer/ui/dialog-alert/dialog-alert.module.css'
import frame from '@/renderer/ui/dialog-frame/dialog-frame.module.css'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { P, renderWith, sent } from '../screens/campaign/campaign-fixture'
import { twoDirections } from './tile-actions-fixture'
import { STRINGS } from './confirm-kind-strings'

type Ask = EventMap['agent.permissionRequested']

// Every text node of the dialog, trimmed, in document order: a word added, removed or changed
// anywhere (title, body, hidden reason, buttons) changes this list.
function pieces(root: HTMLElement): string[] {
  const out: string[] = []
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const text = (node.nodeValue ?? '').trim()
    if (text !== '') out.push(text)
  }
  return out
}

function expectWords(dialog: HTMLElement, key: keyof typeof STRINGS) {
  expect(pieces(dialog)).toEqual(STRINGS[key].pieces)
  expect(dialog).toHaveAccessibleDescription(STRINGS[key].description)
}

const pending = () => new Promise<Result<unknown>>(() => {})
const REFUSED = { ok: false, error: { code: 'NOT_FOUND', message: 'That request has ended.' } }

async function openDelete(reply?: () => Result<unknown> | Promise<Result<unknown>>) {
  const view = await renderWith(
    <main>
      <h1>Campaign</h1>
      <DirectionGrids
        projectId={P}
        campaign={twoDirections()}
        chosenId="V1"
        onChoose={() => {}}
        onOpenBehind={() => {}}
      />
    </main>,
  )
  if (reply) view.fake.onCommand('variant.delete', reply)
  await userEvent.click(screen.getByRole('button', { name: 'More actions for German post' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }))
  return { ...view, dialog: screen.getByRole('dialog', { name: 'Delete German post?' }) }
}

async function openLicence(workflow = 'h3', saving = false) {
  const fake = makeFakeApi()
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: {
      address: null,
      workflows: [{ id: 'h3', model: { label: 'MiniMax H3' } }],
      leavesOnServer: [],
    },
  }))
  const view = await renderApp(<LicenceDialog />, fake)
  act(() => view.store.setState({ licenceRequest: { workflow, saving, resolve: () => {} } }))
  return { ...view, dialog: await screen.findByRole('dialog') }
}

const FILES = ['/tmp/a/one.jpg', '/tmp/a/two.png', '/tmp/a/three.jpg']
const BASE: Ask = {
  requestId: 'r1',
  agentClient: null,
  action: 'delete campaigns',
  target: 'Campaign "Summer Splash!" (6 variants) in "Spring Work"',
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  kind: 'delete',
  fileCount: 0,
}
const ASKS: Record<'campaign' | 'variant' | 'import', Ask> = {
  campaign: BASE,
  variant: {
    ...BASE,
    agentClient: 'Planner',
    action: 'delete variants',
    target: 'Variant "Hero · 9x16 · de" in campaign "Summer Splash!" in "Spring Work"',
  },
  import: {
    ...BASE,
    action: 'import files',
    target: '3 files into "Lakeside Beauty"',
    kind: 'import',
    fileCount: 3,
  },
}

async function openAsk(ask: Ask, files = FILES, reply: () => unknown = pending) {
  const fake = makeFakeApi()
  fake.onQuery('agent.askFiles', () => ({ ok: true, data: { files } }))
  fake.onCommand('agent.answerPermission', reply as () => Promise<Result<unknown>>)
  const view = await renderApp(<PermissionDialog />, fake)
  act(() => fake.emit('agent.permissionRequested', ask))
  const dialog = await screen.findByRole('dialog')
  if (ask.kind === 'import') await within(dialog).findByRole('list', { name: 'Files' })
  const answers = () => fake.commands.filter((c) => c.name === 'agent.answerPermission')
  const allow = within(dialog).getAllByRole('button')[1] as HTMLElement
  return { ...view, dialog, answers, allow }
}

async function allowReady(allow: HTMLElement) {
  await waitFor(() => expect(allow).not.toHaveAttribute('aria-disabled'), { timeout: 5000 })
}

describe('the delete warning as a confirm [DLG-2]', () => {
  it('keeps every word, and "This cannot be undone." is its description', async () => {
    const { dialog } = await openDelete()
    expect(dialog).toHaveClass(frame.normal as string)
    expectWords(dialog, 'delete')
    expect(await axeViolations()).toEqual([])
  })

  it('focuses a quiet "Keep"; "Delete variant" is the danger action, last', async () => {
    const { dialog } = await openDelete()
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Keep', 'Delete variant'])
    const [keep, remove] = buttons
    expect(keep).toHaveFocus()
    expect(keep).toHaveClass(layout.quiet as string)
    expect(remove).toHaveClass(layout.primary as string, layout.danger as string)
  })

  it('sends variant.delete once, only on its click, with the spinner inside it', async () => {
    const { dialog, fake } = await openDelete(pending)
    expect(sent(fake, 'variant.delete')).toEqual([])
    const remove = within(dialog).getByRole('button', { name: 'Delete variant' })
    await userEvent.click(remove)
    await userEvent.click(remove)
    expect(sent(fake, 'variant.delete').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V2' },
    ])
    expect(remove).toBeDisabled()
    expect(remove.querySelector(`.${frame.spin as string}`)).not.toBeNull()
  })

  it('shows a refusal as a danger DialogAlert with the same words', async () => {
    const message = 'Work is still running for this variant. Stop it, or wait for it to finish.'
    const { dialog } = await openDelete(() => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'jobs_running' } },
    }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete variant' }))
    const shown = await within(dialog).findByRole('alert')
    expect(shown).toHaveClass(alert.danger as string)
    expect(shown).toHaveTextContent(message)
    expect([...pieces(dialog)].sort()).toEqual([...STRINGS.deleteRefused.pieces].sort())
    expect(dialog).toHaveAccessibleDescription(STRINGS.deleteRefused.description)
  })
})

describe('the licence confirmation as a confirm [DLG-2]', () => {
  it.each([
    ['licence', 'h3', false],
    ['licenceSaving', 'h3', true],
    ['licenceUnknown', 'nope', false],
  ] as const)('keeps every word (%s)', async (key, workflow, saving) => {
    const { dialog } = await openLicence(workflow, saving)
    expect(dialog).toHaveClass(frame.normal as string)
    expectWords(dialog, key)
    expect(await axeViolations()).toEqual([])
  })

  it('has a quiet "Cancel" and "Confirm" as the primary, last', async () => {
    const { dialog } = await openLicence()
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Cancel', 'Confirm'])
    expect(buttons[0]).toHaveClass(layout.quiet as string)
    expect(buttons[1]).toHaveClass(layout.primary as string)
  })
})

describe("an agent's ask as a confirm [DLG-2]", () => {
  it.each([
    ['campaign', 'askCampaign'],
    ['variant', 'askVariant'],
    ['import', 'askImport'],
  ] as const)('keeps every word of the %s ask, waiting then ready', async (which, key) => {
    const { dialog, allow } = await openAsk(ASKS[which])
    expect(dialog).toHaveClass(frame.normal as string)
    expectWords(dialog, `${key}Waiting`)
    expect(within(dialog).getByRole('button', { name: 'Refuse' })).toHaveFocus()
    await allowReady(allow)
    expectWords(dialog, `${key}Ready`)
    expect(await axeViolations()).toEqual([])
  })

  it.each([
    ['campaign', 'askCampaignRefused'],
    ['variant', 'askVariantRefused'],
    ['import', 'askImportRefused'],
  ] as const)('shows a refused %s answer as a danger DialogAlert', async (which, key) => {
    const { dialog, allow } = await openAsk(ASKS[which], FILES, () => REFUSED)
    await allowReady(allow)
    await userEvent.click(allow)
    const shown = await within(dialog).findByText('That request has ended.')
    expect(shown.closest('[role="alert"]')).toHaveClass(alert.danger as string)
    expectWords(dialog, key)
  })

  it('keeps the consequence line last in the body', async () => {
    for (const ask of Object.values(ASKS)) {
      const { dialog, unmount } = await openAsk(ask)
      const body = dialog.querySelector(`.${frame.body as string}`)
      const cost = (body?.lastElementChild?.textContent ?? '').trim()
      expect(dialog).toHaveAccessibleDescription(expect.stringContaining(cost))
      expect(cost).not.toBe('')
      unmount()
    }
  })

  it('does nothing for Allow until 750 ms after the list shows, then sends once', async () => {
    const { allow, answers } = await openAsk(ASKS.import)
    const shownAt = Date.now()
    await userEvent.click(allow)
    expect(answers()).toEqual([])
    await allowReady(allow)
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(700)
    await userEvent.click(allow)
    await userEvent.click(allow)
    expect(answers().map((a) => a.input)).toEqual([
      { requestId: 'r1', allow: true, rememberAuto: false },
    ])
  })

  it('lists every full path, none shortened', async () => {
    const long = `/tmp/made-up/${'nested-folder/'.repeat(12)}a-very-long-file-name-for-the-ask.jpg`
    const files = [long, '/tmp/made-up/b.png', '/tmp/made-up/c.jpg']
    const { dialog } = await openAsk(ASKS.import, files)
    const list = within(dialog).getByRole('list', { name: 'Files' })
    const shown = within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(shown).toEqual(files)
  })
})

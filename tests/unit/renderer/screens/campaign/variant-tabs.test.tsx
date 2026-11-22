// spec/editor.md, "Variant tabs" and "What each tab keeps" [FR-212 to FR-214, Q-041, Q-042]:
// inside the campaign page, "Overview" and one tab per open variant, whose content is the editor.
import '../../../shared/scene/fake-fonts'
import fs from 'node:fs'
import path from 'node:path'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import { axeViolations } from '../../render'
import { variantGet } from '../../editor/editor-fixture'
import {
  MASTER,
  P,
  SECOND,
  campaignApi,
  campaignGet,
  renderWith,
  variant,
} from './campaign-fixture'

const MASTER_TAB = 'Master post · 1:1 · en'
const SECOND_TAB = 'German post · 1:1 · de'

function setUp(variants = [MASTER, SECOND]) {
  const fake = campaignApi()
  fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet(variants) }))
  fake.onQuery('variant.get', (input) => {
    const id = (input as { variantId: string }).variantId
    const title = variants.find((v) => v.id === id)?.title ?? id
    return { ok: true, data: variantGet({ variant: { ...variantGet().variant, id, title } }) }
  })
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  return fake
}

async function draw(fake = setUp()) {
  const view = await renderWith(
    <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />,
    fake,
  )
  await screen.findByRole('tab', { name: 'Overview' })
  return view
}

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Open variants' }))
    .getAllByRole('tab')
    .map((t) => t.textContent)
// The tile's own button, not its "+" ("Open {title} in a tab").
const tile = (title: string) =>
  screen.getByRole('button', {
    name: (name) =>
      name.includes(title) && !/^(Open|Quick look at|Delete|More actions for) /.test(name),
  })

describe('variant tabs [FR-212, FR-214, Q-041]', () => {
  it('starts on Overview, which holds the grid', async () => {
    await draw()
    expect(tabs()).toEqual(['Overview'])
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('list', { name: 'Variants in Main' })).toBeInTheDocument()
  })

  it('shows the variant tab on a double-click, with the editor; a second double-click adds no tab', async () => {
    await draw()
    await userEvent.dblClick(tile('German post'))
    expect(screen.getByRole('tab', { name: SECOND_TAB })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('region', { name: 'Canvas, German post' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Variants in Main' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    await userEvent.dblClick(tile('German post'))
    expect(tabs()).toEqual(['Overview', SECOND_TAB])
  })

  it('opens the tab behind on Cmd-click (Ctrl-click on Windows) and keeps the overview', async () => {
    await draw()
    fireEvent.click(tile('German post'), { ctrlKey: true })
    fireEvent.click(tile('Master post'), { ctrlKey: true })
    expect(tabs()).toEqual(['Overview', SECOND_TAB, MASTER_TAB])
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('list', { name: 'Variants in Main' })).toBeInTheDocument()
  })

  it('closes a variant tab without a command, and shows the overview again', async () => {
    const fake = setUp()
    await draw(fake)
    await userEvent.dblClick(tile('German post'))
    const before = fake.commands.length
    const close = screen.getByRole('button', { name: 'Close tab' })
    expect(close).toHaveAccessibleDescription(SECOND_TAB)
    await userEvent.click(close)
    expect(tabs()).toEqual(['Overview'])
    expect(screen.getByRole('list', { name: 'Variants in Main' })).toBeInTheDocument()
    expect(fake.commands).toHaveLength(before)
  })

  it('drops the tab of a variant deleted elsewhere', async () => {
    const fake = setUp()
    await draw(fake)
    fireEvent.click(tile('German post'), { ctrlKey: true })
    fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet([MASTER]) }))
    act(() =>
      fake.emit('project.changed', { projectId: P, actor: 'user', changed: {}, removed: {} }),
    )
    await waitFor(() => expect(tabs()).toEqual(['Overview']))
  })

  it('makes the variant shown last the one the overview panels work on [A-47]', async () => {
    await draw()
    await userEvent.dblClick(tile('German post'))
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(tile('German post')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(tile('Master post'), { ctrlKey: true })
    expect(tile('German post')).toHaveAttribute('aria-pressed', 'true')
  })

  it.each([
    ['a running job', { jobRunning: true }, 'Running'],
    ['a result not looked at', { resultUnseen: true }, 'New result'],
    ['an out-of-date variant', { outOfDate: true }, 'Needs attention'],
  ])('marks a tab with %s [Q-042]', async (_, badges, word) => {
    const marked = variant('V2', {
      title: 'German post',
      language: 'de',
      badges: { ...SECOND.badges, ...badges },
    })
    await draw(setUp([MASTER, marked]))
    fireEvent.click(tile('German post'), { ctrlKey: true })
    const tab = screen.getByRole('tab', { name: new RegExp(`^${SECOND_TAB}`) })
    expect(tab).toHaveAccessibleName(`${SECOND_TAB} ${word}`)
  })

  it('has no accessibility violations with a variant tab open', async () => {
    await draw()
    fireEvent.click(tile('German post'), { ctrlKey: true })
    expect(await axeViolations()).toEqual([])
  })
})

describe('what each variant tab keeps [FR-213]', () => {
  it('keeps the selected layer and the zoom per tab', async () => {
    await draw()
    await userEvent.dblClick(tile('Master post'))
    await screen.findByRole('region', { name: 'Canvas, Master post' })
    await userEvent.click(screen.getByRole('button', { name: /^Logo/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    const zoomed = screen.getByTitle('Zoom to fit').textContent
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }))
    await userEvent.dblClick(tile('German post'))
    await screen.findByRole('region', { name: 'Canvas, German post' })
    expect(screen.getByRole('button', { name: /^Logo/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTitle('Zoom to fit').textContent).not.toBe(zoomed)
    await userEvent.click(screen.getByRole('tab', { name: MASTER_TAB }))
    await screen.findByRole('region', { name: 'Canvas, Master post' })
    expect(screen.getByRole('button', { name: /^Logo/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('Zoom to fit').textContent).toBe(zoomed)
  })
})

describe('the tile\'s "+" button [FR-214, Q-041]', () => {
  it('opens the variant behind; the tile button still chooses', async () => {
    const onChoose = vi.fn()
    const onOpenBehind = vi.fn()
    await renderWith(
      <main>
        <VariantGrid
          variants={[MASTER, SECOND]}
          chosenId="V1"
          onChoose={onChoose}
          onOpenBehind={onOpenBehind}
        />
      </main>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'More actions for German post' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open in a tab' }))
    expect(onOpenBehind.mock.calls).toEqual([['V2']])
    expect(onChoose).not.toHaveBeenCalled()
    await userEvent.click(tile('Master post'))
    expect(onChoose.mock.calls).toEqual([['V1']])
    expect(await axeViolations()).toEqual([])
  })
})

// ST-3 (spec/app-style.md, "App shell and tabs"): the shared tab row's close icon is hidden
// from assistive tech, and the row keeps its built overflow behaviour.
describe('variant tab row look [ST-3]', () => {
  it('draws a hidden "x" in the close button and keeps its name', async () => {
    await draw()
    await userEvent.dblClick(tile('German post'))
    const close = screen.getByRole('button', { name: 'Close tab' })
    expect(close.querySelectorAll('svg')).toHaveLength(1)
    expect(close.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(close).toHaveAccessibleDescription(SECOND_TAB)
  })

  it('keeps the row scrolling sideways when the tabs do not fit', () => {
    const file = path.resolve('src/renderer/ui/tab-row/tab-row.module.css')
    expect(fs.readFileSync(file, 'utf8')).toMatch(/overflow-x: auto/)
  })
})

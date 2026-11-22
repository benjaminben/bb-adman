// Design wave CAMP-1 (C-11, OI-DW-3): a tile is its picture and one strip of icon marks. The
// main button is named "{title} · {sizeLine}"; the master has a ★ corner, a video a film corner;
// each badge flag draws one StatusMark named by its word, in badge-words.ts order, clickable
// where its fix exists; the approval marks join the strip and the sign-off mark opens a popover.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityScope } from '@/renderer/app/activity-panel'
import { ActivityButton } from '@/renderer/app/activity-button'
import { NavScope } from '@/renderer/app/nav-context'
import { ApprovalMark } from '@/renderer/screens/campaign/approval-mark'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import { VariantTile } from '@/renderer/screens/campaign/variant-tile'
import { timeText } from '@/renderer/ui/signoff-list'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../../render'
import { VARIANTS } from '../../stores/approvals-fixture'
import { P, campaignApi, campaignGet, renderWith, variant } from './campaign-fixture'

const WORDS = [
  'Running',
  'New result',
  'Text does not fit',
  'File missing',
  'Translation not approved',
  'Out of date',
  'Check warning',
  'Not checked',
]
const KEYS = [
  'jobRunning',
  'resultUnseen',
  'overflow',
  'missingFile',
  'translationUnapproved',
  'outOfDate',
  'checkWarning',
  'checkStale',
]
const ALL = Object.fromEntries(Object.keys(variant('x').badges).map((key) => [key, true]))
const POST = variant('V1', { title: 'Summer post', width: 1080, height: 1920, sizeLabel: '9:16' })

const tile = (v: VariantSummary) => {
  render(
    <main>
      <VariantTile variant={v} chosen={false} onChoose={() => {}} />
    </main>,
  )
  return screen.getByRole('group', { name: `Marks for ${v.title}` })
}

const named = (strip: HTMLElement) =>
  [...strip.querySelectorAll('[title]')].map((el) => el.getAttribute('title'))

describe('VariantTile name and corners [CAMP-1]', () => {
  it.each([
    [false, 'Summer post · 1080×1920 · en · image'],
    [true, 'Summer post · 1080×1920 · en · image · master'],
  ])('names the main button "{title} · {sizeLine}" (master: %s)', (isMaster, name) => {
    tile({ ...POST, isMaster })
    const button = screen.getByRole('button', { name })
    expect(button).toHaveAttribute('title', name)
    expect(screen.queryByText(name.slice('Summer post · '.length))).toBeNull()
  })

  it('draws the master as a ★ corner titled "Master", with no "Master" text', () => {
    tile({ ...POST, isMaster: true })
    const star = screen.getByTitle('Master')
    expect(star).toHaveAttribute('aria-hidden', 'true')
    expect(star.querySelector('svg')).not.toBeNull()
    expect(screen.queryByText('Master')).toBeNull()
  })

  it.each([
    ['image', 0],
    ['video', 1],
  ] as const)('draws a film corner titled "Video" on a %s: %i', (format, count) => {
    tile({ ...POST, format })
    expect(screen.queryAllByTitle('Video')).toHaveLength(count)
  })
})

describe('VariantTile marks [CAMP-1]', () => {
  it('draws one mark per flag, named by its word, in badge-words.ts order', () => {
    const strip = tile({ ...POST, badges: { ...POST.badges, ...ALL } })
    expect(named(strip)).toEqual(WORDS)
  })

  it.each(WORDS.map((word, i) => [word, KEYS[i]!]))('draws "%s" alone for %s', (word, key) => {
    const strip = tile({ ...POST, badges: { ...POST.badges, [key]: true } })
    expect(named(strip)).toEqual([word])
  })

  it('draws an empty strip for a tile with no flag', () => {
    expect(named(tile(POST))).toEqual([])
  })

  it('has no accessibility violations with every mark', async () => {
    tile({ ...POST, isMaster: true, format: 'video', badges: { ...POST.badges, ...ALL } })
    expect(await axeViolations()).toEqual([])
  })
})

const flagged = { ...POST.badges, ...ALL, jobRunning: true }

async function drawGrids(withActivity = false) {
  const onView = vi.fn()
  const onOpen = vi.fn()
  const fake = campaignApi()
  fake.onQuery('job.activity', () => ({ ok: true, data: [] }))
  const base = campaignGet([
    variant('V1', { title: 'Master post', isMaster: true, badges: flagged }),
    variant('V2', { title: 'German post', language: 'de' }),
    variant('V3', { title: 'Night', directionId: 'D2', isMaster: true }),
    variant('V4', { title: 'Night', directionId: 'D2', language: 'de' }),
  ])
  const data = {
    ...base,
    directions: [
      { id: 'D1', campaignId: 'C1', name: 'Beach day', masterVariantId: 'V1', sort: 0 },
      { id: 'D2', campaignId: 'C1', name: 'City night', masterVariantId: 'V3', sort: 1 },
    ],
  }
  const grids = (
    <DirectionGrids
      projectId={P}
      campaign={data}
      chosenId={null}
      onChoose={() => {}}
      onOpen={onOpen}
      onOpenBehind={() => {}}
      onView={onView}
    />
  )
  const ui = withActivity ? (
    <NavScope>
      <ActivityScope projectId={P}>
        <ActivityButton />
        {grids}
      </ActivityScope>
    </NavScope>
  ) : (
    <main>{grids}</main>
  )
  await renderWith(ui, fake)
  return { onView, onOpen, strip: screen.getByRole('group', { name: 'Marks for Master post' }) }
}

describe('DirectionGrids tile marks [CAMP-1]', () => {
  it.each([
    ['Check warning', 'checks'],
    ['Not checked', 'checks'],
    ['Translation not approved', 'translations'],
  ])('"%s" shows the %s view', async (word, view) => {
    const { onView, strip } = await drawGrids()
    await userEvent.click(within(strip).getByRole('button', { name: word }))
    expect(onView).toHaveBeenCalledExactlyOnceWith(view)
  })

  it.each(['Text does not fit', 'New result'])('"%s" opens the variant', async (word) => {
    const { onOpen, strip } = await drawGrids()
    await userEvent.click(within(strip).getByRole('button', { name: word }))
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('V1')
  })

  it('"File missing" opens the relink dialog', async () => {
    const { strip } = await drawGrids()
    await userEvent.click(within(strip).getByRole('button', { name: 'File missing' }))
    expect(await screen.findByRole('dialog', { name: 'Find missing files' })).toBeInTheDocument()
  })

  it('"Out of date" is a plain mark here', async () => {
    const { strip } = await drawGrids()
    expect(within(strip).queryByRole('button', { name: 'Out of date' })).toBeNull()
    expect(within(strip).getByTitle('Out of date')).toBeInTheDocument()
  })

  it('"Running" opens Activity and starts nothing', async () => {
    const fake = await drawGrids(true)
    const activity = screen.getByRole('button', { name: 'Activity' })
    expect(activity).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(within(fake.strip).getByRole('button', { name: 'Running' }))
    expect(activity).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the title under the picture only where titles differ in the direction', async () => {
    await drawGrids()
    const beach = screen.getByRole('region', { name: 'Beach day' })
    const night = screen.getByRole('region', { name: 'City night' })
    expect(within(beach).getByText('German post')).toBeInTheDocument()
    expect(within(night).queryByText('Night')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    await drawGrids()
    expect(await axeViolations()).toEqual([])
  })
})

const SIGNED = VARIANTS[0] as ApprovalsVariant

describe('ApprovalMark sign-off popover [CAMP-1]', () => {
  it('opens the sign-off list from the "Signed off by 1" mark; Escape closes it', async () => {
    render(
      <main>
        <ApprovalMark title="Square post" entry={SIGNED} linkState="live" />
      </main>,
    )
    const mark = screen.getByRole('button', { name: 'Signed off by 1' })
    expect(mark).toHaveTextContent('1')
    expect(mark).not.toHaveAttribute('title', expect.stringContaining('@'))
    expect(screen.queryByRole('list', { name: 'Sign-offs for Square post' })).toBeNull()
    expect(mark).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(mark)
    expect(mark).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('list', { name: 'Sign-offs for Square post' })
    expect(within(list).getByRole('listitem')).toHaveTextContent(
      `ana@example.com · ${timeText('2026-11-19T10:00:00.000Z')}`,
    )
    expect(await axeViolations()).toEqual([])
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('list', { name: 'Sign-offs for Square post' })).toBeNull()
    expect(mark).toHaveFocus()
  })
})

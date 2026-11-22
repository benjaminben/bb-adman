// P6-12 (spec/phases/phase-06.md, design addition 8; P6-4b): the "Translations" section lists
// one group per language with its rows, edits with translation.set, approves one and all with
// each row's copy counter as read, and reads again on every change.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import type { TranslationRow } from '@/shared/schemas/queries/translation'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { MASTER, P, campaignGet } from './campaign-fixture'
import { translationRow as row, translations } from './translation-fixture'

const CHANGED = 'A text changed after you read it. Read it again, then approve.'

function panelApi(rows: TranslationRow[]) {
  const fake = makeFakeApi()
  let current = rows
  fake.onQuery('translation.forCampaign', () => ({ ok: true, data: translations(current) }))
  return { fake, setRows: (next: TranslationRow[]) => (current = next) }
}

async function show(rows: TranslationRow[]) {
  const made = panelApi(rows)
  const view = await renderApp(
    <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
    made.fake,
  )
  await screen.findByRole('region', { name: 'Translations' })
  return { ...made, ...view }
}

const reads = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'translation.forCampaign')
const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

async function group(name: string) {
  return within(await screen.findByRole('region', { name }))
}

async function rowOf(groupName: string, line: string) {
  const g = await group(groupName)
  const field = await g.findByRole('textbox', { name: `${groupName} ${line}` })
  return within(field.closest('li') as HTMLElement)
}

describe('TranslationPanel [P6-12]', () => {
  it('reads translation.forCampaign and shows one group per language, the primary absent', async () => {
    const { fake } = await show([
      row('L1', { status: 'approved' }),
      row('L2', { language: 'fr', title: 'Evening' }),
      row('L3'),
      row('L4', { language: 'en', title: 'Main' }),
    ])
    expect(reads(fake)[0]?.input).toEqual({ projectId: P, campaignId: 'C1' })
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['German', 'French'])
    expect((await group('German')).getByTitle('1 of 2 approved')).toBeTruthy()
    expect((await group('French')).getByTitle('0 of 1 approved')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /^English/ })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Main · Story · Headline' })).toBeNull()
  })

  it('shows each row with its source, its text, its mark and Approve on a proposed row only', async () => {
    const { container } = await show([
      row('L1', { title: '<b>Morning</b>', text: '<i>Hallo</i>', source: 'agent' }),
      row('L2', { title: 'Noon', sourceText: null, status: 'approved', source: 'user' }),
      row('L3', { title: 'Night', status: 'missing', source: null, text: '' }),
    ])
    const one = await rowOf('German', '<b>Morning</b> · Story · Headline')
    expect(one.getByText('Fresh coffee')).toBeTruthy()
    expect(one.getByRole('textbox')).toHaveProperty('value', '<i>Hallo</i>')
    expect(one.getByText('Proposed')).toBeTruthy()
    expect(one.getByText('from an agent')).toBeTruthy()
    expect(one.getByRole('button', { name: 'Proposed: approve' })).toBeTruthy()
    const two = await rowOf('German', 'Noon · Story · Headline')
    expect(two.getByText('No source text')).toBeTruthy()
    expect(two.getByText('Approved')).toBeTruthy()
    expect(two.getByText('from you')).toBeTruthy()
    expect(two.queryByRole('button', { name: 'Proposed: approve' })).toBeNull()
    const three = await rowOf('German', 'Night · Story · Headline')
    expect(three.getByText('Missing')).toBeTruthy()
    expect(three.queryByRole('button', { name: 'Proposed: approve' })).toBeNull()
    expect(container.querySelector('b, i')).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('sends translation.set on leaving an edited field, with and without the tick', async () => {
    const { fake } = await show([row('L1'), row('L2', { title: 'Noon' })])
    const one = await rowOf('German', 'Morning · Story · Headline')
    await userEvent.clear(one.getByRole('textbox'))
    await userEvent.type(one.getByRole('textbox'), 'Neuer Kaffee')
    await userEvent.tab()
    const two = await rowOf('German', 'Noon · Story · Headline')
    await userEvent.click(two.getByRole('button', { name: /^Use for every German post/ }))
    await userEvent.type(two.getByRole('textbox'), '!')
    await userEvent.tab()
    await waitFor(() =>
      expect(sent(fake, 'translation.set')).toEqual([
        { projectId: P, layerId: 'L1', text: 'Neuer Kaffee', applyToSameLanguage: false },
        { projectId: P, layerId: 'L2', text: 'Frischer Kaffee!', applyToSameLanguage: true },
      ]),
    )
    expect(
      two.getByRole('button', {
        name: 'Use for every German post with this text box',
        pressed: true,
      }),
    ).toBeTruthy()
  })

  it('sends nothing when a field is left unchanged', async () => {
    const { fake } = await show([row('L1')])
    const one = await rowOf('German', 'Morning · Story · Headline')
    await userEvent.click(one.getByRole('textbox'))
    await userEvent.tab()
    expect(sent(fake, 'translation.set')).toEqual([])
  })

  it('"Approve" and "Approve all German" send the proposed rows with their copy counters', async () => {
    const { fake } = await show([
      row('L1', { copyRev: 3 }),
      row('L2', { title: 'Noon', status: 'approved', copyRev: 5 }),
      row('L3', { title: 'Night', copyRev: 8 }),
      row('L4', { title: 'Late', status: 'missing', source: null, copyRev: 0 }),
    ])
    const one = await rowOf('German', 'Night · Story · Headline')
    await userEvent.click(one.getByRole('button', { name: 'Proposed: approve' }))
    const g = await group('German')
    await userEvent.click(g.getByRole('button', { name: 'Approve all German' }))
    await waitFor(() =>
      expect(sent(fake, 'translation.approve')).toEqual([
        { projectId: P, layers: [{ layerId: 'L3', copyRev: 8 }] },
        {
          projectId: P,
          layers: [
            { layerId: 'L1', copyRev: 3 },
            { layerId: 'L3', copyRev: 8 },
          ],
        },
      ]),
    )
  })

  it('offers no "Approve all" send when nothing in the group is proposed', async () => {
    await show([row('L1', { status: 'approved' })])
    const g = await group('German')
    expect(g.getByRole('button', { name: 'Approve all German' })).toHaveProperty('disabled', true)
  })

  it('shows "Approved" only once the rows read again say so', async () => {
    const { fake, setRows } = await show([row('L1')])
    const one = await rowOf('German', 'Morning · Story · Headline')
    await userEvent.click(one.getByRole('button', { name: 'Proposed: approve' }))
    await waitFor(() => expect(reads(fake).length).toBe(2))
    expect(one.getByText('Proposed')).toBeTruthy()
    setRows([row('L1', { status: 'approved' })])
    act(() =>
      fake.emit('project.changed', { projectId: P, changed: {}, removed: {}, actor: 'user' }),
    )
    expect(await (await group('German')).findByText('Approved')).toBeTruthy()
  })

  it('shows a refusal on its row; "text changed" shows its sentence and reads again', async () => {
    const { fake } = await show([row('L1'), row('L2', { title: 'Noon' })])
    const refuse = (message: string): Result<unknown> => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'translation_changed' } },
    })
    fake.onCommand('translation.set', () => refuse('That layer was not found.'))
    const one = await rowOf('German', 'Morning · Story · Headline')
    await userEvent.type(one.getByRole('textbox'), '!')
    await userEvent.tab()
    expect((await one.findByRole('alert')).textContent).toBe('That layer was not found.')
    fake.onCommand('translation.approve', () => refuse(CHANGED))
    const before = reads(fake).length
    const two = await rowOf('German', 'Noon · Story · Headline')
    await userEvent.click(two.getByRole('button', { name: 'Proposed: approve' }))
    expect((await two.findByRole('alert')).textContent).toBe(CHANGED)
    await waitFor(() => expect(reads(fake).length).toBeGreaterThan(before))
  })

  it('shows an "Approve all" refusal under the group', async () => {
    const { fake } = await show([row('L1')])
    fake.onCommand('translation.approve', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: CHANGED },
    }))
    const g = await group('German')
    await userEvent.click(g.getByRole('button', { name: 'Approve all German' }))
    expect((await g.findByRole('alert')).textContent).toBe(CHANGED)
  })

  it("reads again on project.changed for this project and on this campaign's translation jobs", async () => {
    const { fake } = await show([row('L1')])
    const changed = (projectId: string) =>
      act(() =>
        fake.emit('project.changed', { projectId, changed: {}, removed: {}, actor: 'agent' }),
      )
    changed('another project')
    act(() => fake.emit('job.updated', jobRow('J1', { kind: 'translation', campaignId: 'C2' })))
    act(() => fake.emit('job.updated', jobRow('J2', { kind: 'copy_options', campaignId: 'C1' })))
    expect(reads(fake).length).toBe(1)
    changed(P)
    await waitFor(() => expect(reads(fake).length).toBe(2))
    act(() => fake.emit('job.updated', jobRow('J3', { kind: 'translation', campaignId: 'C1' })))
    await waitFor(() => expect(reads(fake).length).toBe(3))
  })

  it('treats an empty reply as no rows', async () => {
    const fake = makeFakeApi()
    await renderApp(
      <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
      fake,
    )
    const region = within(await screen.findByRole('region', { name: 'Translations' }))
    expect(await region.findByText('No texts to translate yet.')).toBeTruthy()
  })

  it('shows a refused read with "Retry", which reads again', async () => {
    const fake = makeFakeApi()
    fake.onQuery('translation.forCampaign', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That campaign was not found.' },
    }))
    await renderApp(
      <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
      fake,
    )
    const region = within(await screen.findByRole('region', { name: 'Translations' }))
    expect((await region.findByRole('alert')).textContent).toBe('That campaign was not found.')
    await userEvent.click(region.getByRole('button', { name: 'Retry' }))
    expect(reads(fake).length).toBe(2)
  })
})

describe('TranslationPanel shows each source [R2C-4]', () => {
  it('says under "Export translation sheet…" that these are the texts on the posts', async () => {
    await show([row('L1')])
    const region = within(screen.getByRole('region', { name: 'Translations' }))
    const note =
      'These are the texts on the posts themselves. A change here changes that post at once.'
    expect(region.getByText(note)).toBeTruthy()
  })

  it('labels the source with the primary language and the field with the row language', async () => {
    await show([row('L1'), row('L2', { title: 'Noon', sourceText: null })])
    const g = await group('German')
    const field = g.getByRole('textbox', { name: 'German Morning · Story · Headline' })
    expect(field).toHaveAccessibleDescription('Fresh coffee')
    const one = within(field.closest('li') as HTMLElement)
    expect(g.getByText('English', { exact: true })).toBeTruthy()
    expect(g.queryByText('English (source)')).toBeNull()
    expect(one.getByText('Fresh coffee')).toBeTruthy()
    const two = await rowOf('German', 'Noon · Story · Headline')
    expect(two.getByText('No source text')).toBeTruthy()
    expect(two.getByRole('textbox')).toHaveAccessibleDescription('No source text')
    expect(await axeViolations()).toEqual([])
  })
})

// SH-1 (spec/phases/design-wave-screens-a.md, "SH-1 — Top bar"): Activity, Settings, "+" and
// Dismiss are icon buttons named by their title; the running count is in the accent ink and
// still reads "3 running"; the Project tab is a home icon named "Project"; a running tab shows
// the spinner alone in a fixed-size slot that every campaign tab keeps.
import * as Tabs from '@radix-ui/react-tabs'
import fs from 'node:fs'
import path from 'node:path'
import { useEffect } from 'react'
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActivityButton } from '@/renderer/app/activity-button'
import { ActivityScope } from '@/renderer/app/activity-panel'
import { AppShell } from '@/renderer/app/app-shell'
import { CampaignTabs, useCampaignTab } from '@/renderer/app/campaign-tabs'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import activityStyles from '@/renderer/app/activity-button/activity-button.module.css'
import markStyles from '@/renderer/ui/tab-marks/tab-marks.module.css'
import layout from '@/renderer/ui/layout.module.css'
import type { JobActivity } from '@/shared/schemas/queries/activity'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'
import { campaign, projectApi, projectGet } from '../screens/project-home/project-fixture'

const css = (file: string) =>
  fs.readFileSync(path.resolve(file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (text: string, name: string) =>
  text.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: null }
const RUNNING: JobActivity = ['R1', 'R2', 'R3'].map((id) => ({
  job: jobRow(id, { status: 'running' }),
  place: PLACE,
}))

async function drawActivity(jobs: JobActivity) {
  const fake = makeFakeApi()
  fake.onQuery('job.activity', () => ({ ok: true, data: jobs }))
  await renderApp(
    <NavScope>
      <ActivityScope projectId="P1">
        <header>
          <ActivityButton />
        </header>
      </ActivityScope>
    </NavScope>,
    fake,
  )
}

function Bar(props: { open: string[] }) {
  const nav = useNavStore()
  useEffect(() => {
    for (const id of props.open) nav.getState().openCampaign('P1', id)
  }, [nav, props.open])
  const tab = useCampaignTab('P1')
  return (
    <Tabs.Root value={tab.value} onValueChange={tab.onValueChange}>
      <header>
        <CampaignTabs projectId="P1" />
      </header>
      <Tabs.Content value={tab.value}>{`Showing ${tab.value}`}</Tabs.Content>
    </Tabs.Root>
  )
}

async function drawTabs() {
  const campaigns = [
    { ...campaign('C1', 'Summer Splash'), jobRunning: true },
    campaign('C2', 'Fall Harvest'),
  ]
  await renderApp(
    <main>
      <NavScope>
        <Bar open={['C1', 'C2']} />
      </NavScope>
    </main>,
    projectApi(projectGet(campaigns)),
  )
  await screen.findByRole('tab', { name: 'Fall Harvest' })
}

const iconButton = (name: string) => {
  const button = screen.getByRole('button', { name })
  expect(button).toHaveAttribute('title', name)
  expect(button).toHaveClass(layout.iconButton as string)
  expect(button.querySelectorAll('svg').length).toBeGreaterThan(0)
  return button
}

describe('top bar icon buttons [SH-1]', () => {
  it('draws Settings and Activity as icon buttons named by their title', async () => {
    await renderApp(<AppShell />)
    expect(iconButton('Settings')).toHaveAttribute('aria-pressed', 'false')
    expect(iconButton('Activity')).toHaveAttribute('aria-expanded', 'false')
    const header = screen.getByRole('banner')
    expect(within(header).queryByText('Settings')).toBeNull()
    expect(within(header).queryByText('Activity')).toBeNull()
  })

  it('shows the running count in the accent ink, not a warn colour, and still reads "3 running"', async () => {
    await drawActivity(RUNNING)
    expect(await screen.findByText('3 running')).toBeInTheDocument()
    const button = iconButton('Activity')
    const count = button.querySelector(`.${activityStyles.count as string}`)
    expect(count).toHaveTextContent(/^3$/)
    const file = css('src/renderer/app/activity-button/activity-button.module.css')
    expect(rule(file, 'count')).toMatch(/color:\s*var\(--color-accent-ink\)/)
    expect(file).not.toMatch(/--color-warn/)
    expect(button.querySelectorAll('svg')).toHaveLength(2)
  })

  it('draws the error banner\'s Dismiss as an "x" icon button', async () => {
    const { store } = await renderApp(<AppShell />)
    act(() => store.setState({ error: 'That project is not open.' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('That project is not open.')
    expect(within(alert).queryByText('Dismiss')).toBeNull()
    iconButton('Dismiss')
  })
})

describe('top bar tabs [SH-1]', () => {
  it('names the Project tab "Project" and shows no visible word on it', async () => {
    await drawTabs()
    const tab = screen.getByRole('tab', { name: 'Project' })
    expect(within(tab).getByTitle('Project home')).toBeInTheDocument()
    expect(tab.querySelectorAll('svg')).toHaveLength(1)
    const word = within(tab).getByText('Project')
    expect(word.className).toMatch(/hidden/)
  })

  it('draws "+" as an icon button named and titled "New campaign"', async () => {
    await drawTabs()
    expect(within(iconButton('New campaign')).queryByText('+')).toBeNull()
  })

  it('shows the spinner alone on a running tab, in a fixed slot every campaign tab keeps', async () => {
    await drawTabs()
    const running = screen.getByRole('tab', { name: 'Summer Splash Running' })
    expect(within(running).getByTitle('Running')).toBeInTheDocument()
    expect(within(running).getByText('Running').className).toMatch(/hidden/)
    expect(running.querySelectorAll(`.${markStyles.slot as string}`)).toHaveLength(1)
    expect(running.querySelectorAll('svg')).toHaveLength(1)
    const marks = css('src/renderer/ui/tab-marks/tab-marks.module.css')
    expect(rule(marks, 'slot')).toMatch(/width:\s*var\(--icon-size-small\)/)
    expect(rule(marks, 'slot')).toMatch(/height:\s*var\(--icon-size-small\)/)
    expect(rule(marks, 'marks')).toMatch(/margin-left:\s*var\(--space-1\)/)
    // A campaign tab with no mark keeps the same room: the marks' gap, the slot, its own pad.
    const row = css('src/renderer/ui/tab-row/tab-row.module.css')
    const idle = row.match(/\.bar \.closable:not\(:has\(> :nth-child\(2\)\)\)\s*\{([^}]*)\}/)?.[1]
    expect(idle).toMatch(
      /padding-right:\s*calc\(var\(--space-1\) \* 2 \+ var\(--icon-size-small\)\)/,
    )
    expect(rule(row, 'closable')).toMatch(/padding-right:\s*var\(--space-1\)/)
  })

  it('has no axe violations on the bar with two campaigns, one running', async () => {
    await drawTabs()
    expect(await axeViolations()).toEqual([])
  })
})

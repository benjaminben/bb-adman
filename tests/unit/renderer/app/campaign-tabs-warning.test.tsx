// spec/screens-ai.md, "Where it shows": closing a campaign tab asks first when an attached job
// of one of its variant tabs is queued or running; with none it closes at once. Jobs are
// registered through the store directly.
import * as Tabs from '@radix-ui/react-tabs'
import { useEffect } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignTabs, useCampaignTab } from '@/renderer/app/campaign-tabs'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import { renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import { campaign, projectApi, projectGet } from '../screens/project-home/project-fixture'

// Summer Splash has the variant tabs V1 and V2 open; Fall Harvest has V3.
function Shell() {
  const nav = useNavStore()
  useEffect(() => {
    const s = nav.getState()
    s.openCampaign('P1', 'C1')
    s.openVariant('P1', 'C1', 'V1')
    s.openVariant('P1', 'C1', 'V2')
    s.openCampaign('P1', 'C2')
    s.openVariant('P1', 'C2', 'V3')
  }, [nav])
  const tab = useCampaignTab('P1')
  return (
    <Tabs.Root value={tab.value} onValueChange={tab.onValueChange}>
      <CampaignTabs projectId="P1" />
      <Tabs.Content value={tab.value}>{`Showing ${tab.value}`}</Tabs.Content>
    </Tabs.Root>
  )
}

async function draw(jobOf: string | null) {
  const fake = projectApi(projectGet([campaign('C1', 'Summer Splash'), campaign('C2', 'Fall')]))
  if (jobOf) {
    attachedStoreFor(fake.api).getState().register('J1', { projectId: 'P1', variantId: jobOf })
    fake.emit('job.updated', jobRow('J1', { kind: 'copy_options', status: 'running' }))
  }
  const view = await renderApp(
    <main>
      <NavScope>
        <Shell />
      </NavScope>
    </main>,
    fake,
  )
  await screen.findByRole('tab', { name: 'Summer Splash' })
  return view
}

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Open campaigns' }))
    .getAllByRole('tab')
    .map((t) => t.textContent)

const closeSummer = () =>
  userEvent.click(screen.getByRole('button', { name: 'Close Summer Splash' }))

describe('closing a campaign tab with an attached job [spec/screens-ai.md, D-036]', () => {
  it('closes at once when no job of its variant tabs runs', async () => {
    await draw('V3')
    await closeSummer()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(tabs()).toEqual(['Project', 'Fall'])
  })

  it('warns first when a job of one of its variant tabs runs; "Keep open" keeps it', async () => {
    await draw('V2')
    await closeSummer()
    expect(screen.getByRole('dialog', { name: 'Stop writing copy options?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep open' }))
    expect(tabs()).toEqual(['Project', 'Summer Splash', 'Fall'])
  })

  it('closes it after "Stop and close", having sent job.cancel', async () => {
    const { fake } = await draw('V1')
    await closeSummer()
    await userEvent.click(screen.getByRole('button', { name: 'Stop and close' }))
    expect(fake.commands).toContainEqual({
      name: 'job.cancel',
      input: { projectId: 'P1', jobId: 'J1' },
    })
    expect(tabs()).toEqual(['Project', 'Fall'])
  })
})

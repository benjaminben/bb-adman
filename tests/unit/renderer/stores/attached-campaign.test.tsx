// P6-13 (spec/screens-ai.md, "Attached jobs and the close warning"; spec/phases/phase-06.md):
// a job owned by a campaign (a translation job) is listed under that campaign, and closing the
// campaign's tab while it runs warns first with the task words "translating".
import * as Tabs from '@radix-ui/react-tabs'
import { useEffect } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignTabs, useCampaignTab } from '@/renderer/app/campaign-tabs'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import {
  attachedStoreFor,
  campaignJobs,
  createAttachedStore,
  variantJobs,
} from '@/renderer/stores/attached-store'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { jobRow } from './job-fixture'
import { campaign, projectApi, projectGet } from '../screens/project-home/project-fixture'

const ids = (jobs: { jobId: string }[]) => jobs.map((j) => j.jobId)

describe('campaign-owned attached jobs [P6-13]', () => {
  it('lists a job under its campaign owner only', () => {
    const store = createAttachedStore(makeFakeApi().api)
    const s = () => store.getState()
    s().register('J1', { projectId: 'P1', campaignId: 'C1' })
    s().register('J2', { projectId: 'P1', variantId: 'V1' })
    s().register('J3', { projectId: 'P2', campaignId: 'C1' })
    expect(ids(campaignJobs(s(), 'P1', 'C1'))).toEqual(['J1'])
    expect(ids(campaignJobs(s(), 'P1', 'C2'))).toEqual([])
    expect(ids(variantJobs(s(), 'P1', ['V1']))).toEqual(['J2'])
  })
})

function Shell() {
  const nav = useNavStore()
  useEffect(() => {
    const s = nav.getState()
    s.openCampaign('P1', 'C1')
    s.openCampaign('P1', 'C2')
  }, [nav])
  const tab = useCampaignTab('P1')
  return (
    <Tabs.Root value={tab.value} onValueChange={tab.onValueChange}>
      <CampaignTabs projectId="P1" />
      <Tabs.Content value={tab.value}>{`Showing ${tab.value}`}</Tabs.Content>
    </Tabs.Root>
  )
}

async function draw(owner: string) {
  const fake = projectApi(projectGet([campaign('C1', 'Summer Splash'), campaign('C2', 'Fall')]))
  attachedStoreFor(fake.api).getState().register('J1', { projectId: 'P1', campaignId: owner })
  fake.emit('job.updated', jobRow('J1', { kind: 'translation', status: 'running' }))
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

describe('closing a campaign tab with a running translation [P6-13]', () => {
  it('warns with "translating", and "Stop and close" sends job.cancel', async () => {
    const { fake } = await draw('C1')
    await userEvent.click(screen.getByRole('button', { name: 'Close Summer Splash' }))
    const dialog = screen.getByRole('dialog', { name: 'Stop translating?' })
    // SH-5: the sentence that repeated the title is gone.
    expect(dialog).not.toHaveTextContent('Translating is still running.')
    await userEvent.click(screen.getByRole('button', { name: 'Stop and close' }))
    expect(fake.commands).toContainEqual({
      name: 'job.cancel',
      input: { projectId: 'P1', jobId: 'J1' },
    })
    expect(tabs()).toEqual(['Project', 'Fall'])
  })

  it("closes another campaign's tab at once", async () => {
    await draw('C2')
    await userEvent.click(screen.getByRole('button', { name: 'Close Summer Splash' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(tabs()).toEqual(['Project', 'Fall'])
  })
})

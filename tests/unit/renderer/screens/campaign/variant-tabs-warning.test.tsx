// spec/screens-ai.md, "Where it shows": closing a variant tab with an attached job of its own
// queued or running asks first; with none it closes at once. Jobs are registered through the
// store directly.
import { useEffect } from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NavScope, useNavStore } from '@/renderer/app/nav-context'
import { VariantTabs } from '@/renderer/screens/campaign/variant-tabs'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import { renderApp } from '../../render'
import { makeFakeApi } from '../../fake-api'
import { jobRow } from '../../stores/job-fixture'
import { MASTER, P, SECOND } from './campaign-fixture'

const SECOND_TAB = 'German post · 1:1 · de'

function Tabs() {
  const nav = useNavStore()
  useEffect(() => {
    nav.getState().openVariant(P, 'C1', MASTER.id, true)
    nav.getState().openVariant(P, 'C1', SECOND.id)
  }, [nav])
  return (
    <VariantTabs
      projectId={P}
      campaignId="C1"
      variants={[MASTER, SECOND]}
      overview={<p>Grid</p>}
      renderVariant={(id) => <p>{`Editor ${id}`}</p>}
    />
  )
}

async function draw(jobOf: string | null) {
  const fake = makeFakeApi()
  if (jobOf) {
    attachedStoreFor(fake.api).getState().register('J1', { projectId: P, variantId: jobOf })
    fake.emit('job.updated', jobRow('J1', { kind: 'layout_proposal', status: 'running' }))
  }
  const view = await renderApp(
    <main>
      <NavScope>
        <Tabs />
      </NavScope>
    </main>,
    fake,
  )
  await screen.findByRole('tab', { name: SECOND_TAB })
  return view
}

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Campaign' }))
    .getAllByRole('tab')
    .map((t) => t.textContent)

const closeSecond = () => userEvent.click(screen.getAllByRole('button', { name: 'Close tab' })[1]!)

describe('closing a variant tab with an attached job [spec/screens-ai.md, D-036]', () => {
  it('closes at once when no job of the tab runs', async () => {
    await draw(MASTER.id)
    await closeSecond()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(tabs()).toEqual(['Variants', 'Master post · 1:1 · en'])
  })

  it('warns first when one runs, and "Keep open" keeps the tab', async () => {
    await draw(SECOND.id)
    await closeSecond()
    expect(screen.getByRole('dialog', { name: 'Stop placing text with AI?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep open' }))
    expect(tabs()).toContain(SECOND_TAB)
  })

  it('closes the tab after "Stop and close", having sent job.cancel', async () => {
    const { fake } = await draw(SECOND.id)
    await closeSecond()
    await userEvent.click(screen.getByRole('button', { name: 'Stop and close' }))
    expect(fake.commands).toContainEqual({
      name: 'job.cancel',
      input: { projectId: P, jobId: 'J1' },
    })
    await act(async () => {})
    expect(tabs()).toEqual(['Variants', 'Master post · 1:1 · en'])
  })
})

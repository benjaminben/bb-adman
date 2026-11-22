// P9-13 (spec/phases/phase-09.md "Screens", campaign page): "Publish…" in the campaign header
// opens the publish dialog for this campaign. Opening it reads with publish.inspect only.
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PublishButton } from '@/renderer/screens/campaign/publish-button'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { inspectReply } from '../../dialogs/publish-fixture'

async function draw() {
  const fake = makeFakeApi()
  fake.onQuery('publish.inspect', () => ({ ok: true, data: inspectReply() }))
  await renderApp(
    <PublishButton
      projectId="p1"
      campaignId="01JD00000000000000000000CA"
      campaignName="Summer Launch"
    />,
    fake,
  )
  return fake
}

describe('the Publish… button [P9-13]', () => {
  it('opens the publish dialog for this campaign, and sends nothing before', async () => {
    const fake = await draw()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fake.queries.filter((q) => q.name === 'publish.inspect')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Publish…' }))
    expect(screen.getByRole('dialog', { name: 'Publish Summer Launch' })).toBeInTheDocument()
    await screen.findByRole('radio', { name: 'Amazon S3' })
    expect(fake.queries.filter((q) => q.name === 'publish.inspect').map((q) => q.input)).toEqual([
      { projectId: 'p1', campaignId: '01JD00000000000000000000CA', storage: null },
    ])
    expect(fake.commands).toEqual([])
  })

  it('closes the dialog on Cancel', async () => {
    await draw()
    await userEvent.click(screen.getByRole('button', { name: 'Publish…' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Publish…' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
  })
})

// P4-12 (spec/screens-ai.md, "The paid count"): the campaign's paid calls in one line, read
// again on a job.updated of that campaign only.
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PaidCount } from '@/renderer/ui/paid-count'
import type { PaidCount as Counts } from '@/shared/schemas/queries/paid-count'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

function withCounts(...answers: Counts[]) {
  const fake = makeFakeApi()
  let i = 0
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: answers[Math.min(i++, answers.length - 1)],
  }))
  return fake
}

const reads = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'campaign.paidCount')

describe('PaidCount [P4-12, FR-230]', () => {
  it.each<[string, Counts, string]>([
    [
      'no text requests',
      { pictures: 6, videos: 1, text: 0 },
      'Paid generations for this campaign so far: 6 pictures, 1 videos.',
    ],
    [
      'text requests',
      { pictures: 0, videos: 0, text: 3 },
      'Paid generations for this campaign so far: 0 pictures, 0 videos. Text requests: 3.',
    ],
  ])('draws the line with %s', async (_name, counts, line) => {
    const fake = withCounts(counts)
    await renderApp(<PaidCount projectId="P1" campaignId="C1" />, fake)
    expect(await screen.findByTitle(line)).toBeInTheDocument()
    expect(reads(fake)[0]?.input).toEqual({ projectId: 'P1', campaignId: 'C1' })
  })

  it('reads again on a job.updated of its campaign only', async () => {
    const fake = withCounts(
      { pictures: 1, videos: 0, text: 0 },
      { pictures: 5, videos: 0, text: 0 },
    )
    await renderApp(<PaidCount projectId="P1" campaignId="C1" />, fake)
    await screen.findByTitle(/1 pictures/)
    fake.emit('job.updated', jobRow('J1', { campaignId: 'C2' }))
    fake.emit('job.updated', jobRow('J2', { campaignId: null }))
    expect(reads(fake)).toHaveLength(1)
    fake.emit('job.updated', jobRow('J3', { campaignId: 'C1' }))
    expect(await screen.findByTitle(/5 pictures/)).toBeInTheDocument()
    expect(reads(fake)).toHaveLength(2)
  })

  it('draws nothing when the query is refused', async () => {
    const fake = makeFakeApi()
    fake.onQuery('campaign.paidCount', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That campaign was not found.' },
    }))
    const { container } = await renderApp(<PaidCount projectId="P1" campaignId="C1" />, fake)
    await waitFor(() => expect(reads(fake)).toHaveLength(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('has no accessibility violations', async () => {
    // A page always holds the line inside a landmark.
    await renderApp(
      <main>
        <PaidCount projectId="P1" campaignId="C1" />
      </main>,
      withCounts({ pictures: 2, videos: 0, text: 1 }),
    )
    await screen.findByText(/Text requests: 1/)
    expect(await axeViolations()).toEqual([])
  })
})

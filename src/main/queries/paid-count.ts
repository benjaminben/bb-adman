// campaign.paidCount (spec/ai-jobs.md "The three queries") [REQ: FR-230]: the calls sent to
// paid providers for one campaign's jobs, by what they made. A count of calls, not money.
// Local providers add nothing: their paid_calls is 0.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { campaignPaidCountInput, type PaidCount } from '@/shared/schemas/queries/paid-count'
import type { JobKind } from '@/shared/config/job-kinds'
import { AppError } from '@/shared/schemas/result'

const SUM_OF: Partial<Record<JobKind, keyof PaidCount>> = {
  image_generation: 'pictures',
  generative_fill: 'pictures',
  cutout: 'pictures',
  video_generation: 'videos',
  layout_proposal: 'text',
  copy_options: 'text',
  translation: 'text',
}

export function paidCount(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): PaidCount => {
    const parsed = campaignPaidCountInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const { projectId, campaignId } = parsed.data
    const { db } = deps.projects.requireOpen(projectId)
    if (!db.prepare('SELECT 1 FROM campaign WHERE id = ?').get(campaignId)) {
      throw new AppError('NOT_FOUND', 'That campaign was not found.')
    }
    const sums = db
      .prepare('SELECT kind, SUM(paid_calls) AS calls FROM job WHERE campaign_id = ? GROUP BY kind')
      .all(campaignId) as Array<{ kind: JobKind; calls: number }>
    const count: PaidCount = { pictures: 0, videos: 0, text: 0 }
    for (const { kind, calls } of sums) {
      const sum = SUM_OF[kind]
      if (sum) count[sum] += calls
    }
    return count
  }
}

export function paidCountQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'campaign.paidCount': paidCount(deps) }
}

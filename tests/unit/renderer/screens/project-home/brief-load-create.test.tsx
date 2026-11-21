// SP-4 (spec/subject-photos.md, "Create campaign"): subject.create, then asset.update for each
// photo to attach, then campaign.create with placeSubjectPhoto; the first refusal stops it.
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { briefApi, openForm, sent } from './brief-load-photos-fixture'

const names = (fake: ReturnType<typeof briefApi>['fake']) => fake.commands.map((c) => c.name)

describe('Create campaign: the order of the steps [SP-4]', () => {
  it.each([
    ['not ticked (the default)', false],
    ['ticked', true],
  ])(
    'sends subject.create, asset.update for each photo, then campaign.create; place box %s',
    async (_, tick) => {
      const { fake } = briefApi()
      await openForm(fake)
      if (tick) {
        await userEvent.click(
          screen.getByRole('checkbox', { name: 'Start the ad with a subject photo placed' }),
        )
      }
      await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
      await waitFor(() => expect(names(fake)).toContain('campaign.create'))
      expect(names(fake)).toEqual([
        'brief.parse',
        'asset.import',
        'asset.import',
        'subject.create',
        'subject.create',
        'asset.update',
        'asset.update',
        'campaign.create',
      ])
      expect(sent(fake, 'asset.update')).toEqual([
        { projectId: 'P1', assetId: 'B1', subjectId: 'citrus-can' },
        { projectId: 'P1', assetId: 'B2', subjectId: 'berry-bottle' },
      ])
      expect(sent(fake, 'campaign.create')[0]).toMatchObject({ placeSubjectPhoto: tick })
    },
  )

  it('stops before campaign.create when an asset.update is refused', async () => {
    const { fake } = briefApi()
    const message = 'That subject is not in this project.'
    fake.onCommand('asset.update', () => ({ ok: false, error: { code: 'NOT_FOUND', message } }))
    await openForm(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(names(fake)).toEqual([
      'brief.parse',
      'asset.import',
      'asset.import',
      'subject.create',
      'subject.create',
      'asset.update',
    ])
    expect(screen.getByRole('region', { name: 'Brief' })).toBeInTheDocument()
  })
})

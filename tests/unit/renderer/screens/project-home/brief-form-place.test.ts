import { describe, it, expect } from 'vitest'
import { formFromDraft, planFromForm } from '@/renderer/screens/project-home/brief-form-model'
import { IMAGES, photosFor } from './brief-photo-fixture'
import { DRAFT } from './project-fixture'

describe('planFromForm: placeSubjectPhoto [SP-4, A-119]', () => {
  it.each([false, true])(
    'sends the place box (%s) as campaign.create placeSubjectPhoto',
    (tick) => {
      const values = formFromDraft({ draft: DRAFT, primaryLanguage: 'en' }, [], photosFor(DRAFT))
      const result = planFromForm('P1', { ...values, placeSubjectPhoto: tick }, [], IMAGES)
      if (!result.ok) throw new Error(result.problems.join())
      expect(result.campaign.placeSubjectPhoto).toBe(tick)
    },
  )
})

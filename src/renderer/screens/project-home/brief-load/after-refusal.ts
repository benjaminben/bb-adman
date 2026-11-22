// SP-4 (spec/subject-photos.md, "After a refusal"; A-118): the brief form after a refused step
// of Create campaign.
import { subjectIds } from '@/renderer/screens/project-home/brief-form-problems'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'

export type Change = (values: BriefFormValues) => BriefFormValues

// The form after a refused step: each row whose subject was made uses that subject, so it is
// not made twice, and each photo now attached leaves the form's photos, so it is not removed.
export function afterRefusal(made: string[], attached: string[]): Change {
  return (values) => {
    const ids = subjectIds(values.subjects)
    const subjects = values.subjects.map((s, i) => {
      const id = ids[i] ?? ''
      const row =
        s.mode === 'new' && made.includes(id) ? { mode: 'existing' as const, existingId: id } : {}
      return { ...s, ...row, photos: s.photos.filter((p) => !attached.includes(p.assetId)) }
    })
    return { ...values, subjects }
  }
}

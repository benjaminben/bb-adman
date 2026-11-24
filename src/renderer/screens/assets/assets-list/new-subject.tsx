// R2C-6 (spec/screens-campaign.md, "The Assets panel"; D-109, "Project home"): the `plus`
// button "Subject", named "New subject…", that opens the subject dialog. In the panel's action
// row and in the home page's Assets header row.
import { useState } from 'react'
import { SubjectDialog } from '@/renderer/dialogs/subject-dialog'
import { Icon } from '@/renderer/ui/icon'
import type { SubjectRow } from '@/shared/schemas/rows/subject'

export function NewSubject(props: { projectId: string; subjects: SubjectRow[] }) {
  const [making, setMaking] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="New subject…"
        title="New subject…"
        onClick={() => setMaking(true)}
      >
        <Icon name="plus" />
        Subject
      </button>
      <SubjectDialog
        projectId={props.projectId}
        open={making}
        subjects={props.subjects}
        onClose={() => setMaking(false)}
      />
    </>
  )
}

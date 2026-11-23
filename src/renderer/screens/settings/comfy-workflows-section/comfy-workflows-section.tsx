// Settings: "ComfyUI workflows" (spec/comfyui-custom.md "Screens", D-104), placed right after
// "ComfyUI server" and not part of it, so the first-run setup does not change. The intro, the
// folded "How to mark steps", the licence line (always shown), the list of added workflows and
// "Add workflow…". "Change" and the trash icon only open their dialogs; nothing is sent before
// a click there. Every result and refusal stays on the page as a line.
import { useState } from 'react'
import { MAX_CUSTOM_WORKFLOWS } from '@/shared/comfy/custom-workflow'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { ChangeWorkflow } from '@/renderer/dialogs/change-workflow'
import { RemoveWorkflow } from '@/renderer/dialogs/remove-workflow'
import { ComfyWorkflowRow } from '@/renderer/screens/settings/comfy-workflow-row'
import { MarkHelp } from '@/renderer/screens/settings/mark-help'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { EmptyState } from '@/renderer/ui/empty-state'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { useAddWorkflow } from './use-add-workflow'
import { useCustomWorkflows } from './use-custom-workflows'
import styles from './comfy-workflows-section.module.css'

const INTRO =
  'Add a workflow you made in ComfyUI. Start the title of each step Adman fills with adman:, then use Export (API).'
const LICENCE =
  'Adman cannot know the licence of a workflow you add. Check the licence of every model it uses before you use what it makes.'
const AT_LIMIT = `You can add at most ${MAX_CUSTOM_WORKFLOWS} workflows.`

export function ComfyWorkflowsSection() {
  const { workflows, read } = useCustomWorkflows()
  const { add, line, busy } = useAddWorkflow(read)
  const [changing, setChanging] = useState<WorkflowInfo | null>(null)
  const [removing, setRemoving] = useState<WorkflowInfo | null>(null)
  const full = workflows.length >= MAX_CUSTOM_WORKFLOWS

  // A closed dialog may have changed the list; the read is a query, so it is safe after Cancel.
  function close(clear: (w: null) => void) {
    clear(null)
    void read()
  }

  return (
    <Section
      id="settings.comfyWorkflows"
      title="ComfyUI workflows"
      level={3}
      summary={`${workflows.length} added`}
    >
      <p className={styles.line}>{INTRO}</p>
      <MarkHelp />
      <p className={`${layout.muted} ${styles.line}`}>{LICENCE}</p>
      {workflows.length === 0 ? (
        <EmptyState icon="file" words="No workflows added yet." />
      ) : (
        <ul className={styles.list} aria-label="Added workflows">
          {workflows.map((w) => (
            <ComfyWorkflowRow
              key={w.id}
              workflow={w}
              onChange={() => setChanging(w)}
              onRemove={() => setRemoving(w)}
            />
          ))}
        </ul>
      )}
      <div className={styles.add}>
        <button
          type="button"
          disabled={full || busy}
          title={full ? AT_LIMIT : undefined}
          onClick={() => void add()}
        >
          Add workflow…
        </button>
      </div>
      {line !== null && (
        <NoticeLine kind={line.kind} role="status">
          {line.words}
        </NoticeLine>
      )}
      <ChangeWorkflow
        workflow={changing}
        sizeMarks={changing?.custom?.sizeMarks ?? false}
        onClose={() => close(setChanging)}
      />
      <RemoveWorkflow workflow={removing} onClose={() => close(setRemoving)} />
    </Section>
  )
}

// "Load a brief" and "Paste a brief" (spec/screens-campaign.md, "The brief form"; R2P-4, D4):
// the picker and brief.parse, or the paste dialog (brief.parse of the text, or an empty form);
// then the brief form. P4-15: a Markdown or text brief is
// read with AI instead (use-text-brief.tsx, spec/screens-ai.md "Reading a brief with AI"). Create campaign sends
// subject.create for each new subject, asset.update for each photo to attach, then
// campaign.create (spec/subject-photos.md, "Create campaign"); it stops at the first refusal,
// whose message the app store shows in the alert. A made campaign opens at once (A-45):
// onCreated gets campaign.create's campaignId. SP-4: a loaded brief's photos are imported
// before the form opens (use-brief-photos.ts). Cancel, and the page going away with the form
// open, remove every photo the form added (A-111); after a refused step the form is made safe
// to press again (A-118). R2-Q: the top bar's "+" asks for a new campaign; this answers by
// opening the typed form, or, with a form open, by putting the focus back in its first field.
// HOME-1: with no form open it returns `home(actions)`; the project home draws its Sections
// around the two buttons. It stays mounted while the home shows, so the clean-up above holds.
// HOME-2: the form is the "New campaign" page. Its Back and Escape leave as Cancel does, asking
// first when the form holds typed work (use-leave-brief.tsx); after Cancel or a leave the focus
// goes to "Load a brief".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { useNewCampaignAsk } from '@/renderer/app/nav-context'
import { briefFileKind } from '@/shared/brief/brief-file-kind'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { BriefForm } from '@/renderer/screens/project-home/brief-form'
import { focusFirstField, usePasteBrief } from '@/renderer/screens/project-home/brief-paste'
import { removeAddedPhotos } from '@/renderer/screens/project-home/subject-photos'
import {
  formFromDraft,
  type BriefFormValues,
  type CampaignPlan,
} from '@/renderer/screens/project-home/brief-form-model'
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brief-load.module.css'
import { afterRefusal, type Change } from './after-refusal'
import { useBriefPhotos } from './use-brief-photos'
import { useLeaveBrief } from './use-leave-brief'
import { useTextBrief } from './use-text-brief'

export type BriefLoadProps = {
  projectId: string
  subjects: SubjectRow[]
  campaigns: CampaignSummary[]
  onCreated: (campaignId: string) => void
  // HOME-1: draws the home around the two buttons and their dialogs while no form is open.
  home: (actions: ReactNode) => ReactNode
}

export function BriefLoad(props: BriefLoadProps) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [opened, setOpened] = useState<BriefFormValues | null>(null)
  const [creating, setCreating] = useState(false)
  const { projectId } = props
  const heldSubjectIds = props.subjects.map((s) => s.id)
  const briefPhotos = useBriefPhotos(projectId)
  // The open form's newest values, kept without a re-render; null once no form is open.
  const formValues = useRef<BriefFormValues | null>(null)
  const formBox = useRef<HTMLDivElement>(null)
  const loadButton = useRef<HTMLButtonElement>(null)
  const focusLoad = useRef(false)
  const { askedFor, ask } = useNewCampaignAsk()
  const paste = usePasteBrief(projectId, opened !== null, formBox, {
    onEmpty: () => setOpened(formFromDraft(null, heldSubjectIds)),
    onRead: (parsed) => void openParsed(parsed),
  })
  const { keepFocus } = paste
  const textBrief = useTextBrief(projectId, (parsed) =>
    setOpened(formFromDraft(parsed, heldSubjectIds)),
  )

  useEffect(() => {
    const form = formValues
    return () => dropPhotos(form.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page goes away
  }, [])

  useEffect(() => {
    if (askedFor !== projectId) return
    ask(null)
    if (formValues.current !== null) return focusFirstField(formBox.current)
    keepFocus()
    setOpened(formFromDraft(null, heldSubjectIds))
  }, [askedFor, ask, projectId, heldSubjectIds, keepFocus])

  // A dialog closed with the form hands the focus back a moment later; this comes after it.
  useEffect(() => {
    if (opened !== null || !focusLoad.current) return
    focusLoad.current = false
    const timer = setTimeout(() => loadButton.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [opened])

  function cancel() {
    dropPhotos(formValues.current)
    closeForm()
    focusLoad.current = true
  }

  function closeForm() {
    formValues.current = null
    paste.shut()
    setOpened(null)
  }

  function dropPhotos(values: BriefFormValues | null) {
    formValues.current = null
    if (values)
      removeAddedPhotos(
        api,
        projectId,
        values.subjects.flatMap((s) => s.photos),
      )
  }

  const leaving = useLeaveBrief({
    open: opened !== null,
    busy: creating,
    typed: () =>
      formValues.current !== null && JSON.stringify(formValues.current) !== JSON.stringify(opened),
    onLeave: cancel,
  })

  async function load() {
    const picked = await api.query('dialog.pickFiles', { purpose: 'brief' })
    const filePath = picked.ok ? (picked.data as PickedPaths | null)?.paths[0] : undefined
    if (filePath === undefined) return
    if (briefFileKind(filePath) === 'text') return textBrief.start(filePath)
    const result = await command('brief.parse', { projectId, filePath })
    if (result.ok) await openParsed(result.data as BriefParsed)
  }

  // A read brief, from a file or pasted: its photos are added, then the form opens (SP-4).
  async function openParsed(parsed: BriefParsed) {
    const photos = await briefPhotos.importPhotos(parsed)
    if (photos !== null) setOpened(formFromDraft(parsed, heldSubjectIds, photos))
  }

  async function create(plan: Extract<CampaignPlan, { ok: true }>): Promise<Change | void> {
    setCreating(true)
    const made: string[] = []
    const attached: string[] = []
    const refused = () => {
      setCreating(false)
      return afterRefusal(made, attached)
    }
    for (const subject of plan.subjects) {
      if (!(await command('subject.create', subject)).ok) return refused()
      made.push(subject.id)
    }
    for (const entry of plan.attach) {
      if (!(await command('asset.update', entry)).ok) return refused()
      attached.push(entry.assetId)
    }
    const result = await command('campaign.create', plan.campaign)
    if (!result.ok) return refused()
    setCreating(false)
    closeForm()
    const created = result.data as CampaignCreated | null
    if (created) props.onCreated(created.campaignId)
  }

  if (opened === null) {
    return props.home(
      <div className={styles.actions}>
        <button
          ref={loadButton}
          type="button"
          className={layout.primary}
          onClick={() => void load()}
        >
          {briefPhotos.adding ? <BusySpinner /> : <Icon name="file" />}
          Load a brief
        </button>
        {briefPhotos.adding && (
          <span role="status" className={styles.hidden}>
            Adding the brief's photos…
          </span>
        )}
        <button type="button" className={layout.secondary} onClick={paste.start}>
          <Icon name="text" />
          Paste a brief
        </button>
        {paste.dialog}
        {textBrief.dialogs}
      </div>,
    )
  }

  return (
    <div ref={formBox}>
      <BriefForm
        projectId={projectId}
        initial={opened}
        subjects={props.subjects}
        campaigns={props.campaigns}
        creating={creating}
        onCreate={create}
        onCancel={cancel}
        onBack={leaving.leave}
        onValues={(values) => {
          formValues.current = values
        }}
      />
      {leaving.dialog}
    </div>
  )
}

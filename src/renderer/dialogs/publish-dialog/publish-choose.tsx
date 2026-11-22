// The publish dialog's first view (DLG-6b; spec/phases/phase-09.md "Screens"): "To" with the
// storages, what is published there, the short prompt line (its full sentence in an InfoTip and
// as the dialog's description: data leaving the machine stays on the page), every file that
// will leave this computer, the font ticks (A-260) and what else is uploaded, as chips.
import { FontShareChoice } from '@/renderer/ui/font-share-choice'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { PublishFileList } from '@/renderer/ui/publish-file-list'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import { ReplaceWarning } from './replace-warning'
import { StorageChoice } from './storage-choice'
import styles from './publish-dialog.module.css'

export const PROMPT_LINE =
  'Generated images and videos carry the prompt that made them. Anyone with these files can read it.'

const ALSO: Array<[string, string]> = [
  ['Ads', 'The exported ads'],
  ['Report', 'The report'],
  ['Sheet', 'The translation sheet'],
  ['List', 'A list of the files'],
]

export type PublishChooseProps = {
  projectId: string
  reply: PublishInspect
  storage: PublishStorageId | null
  looking: boolean
  existing: PublishInspect['existing']
  replaceOn: boolean
  sending: boolean
  onChoose: (id: PublishStorageId) => void
  onReplace: (on: boolean) => void
  onFontsChanged: () => void
  onClose: () => void
}

function AlsoUploaded() {
  return (
    <div className={styles.also}>
      <span className={styles.label}>Also uploaded</span>
      <ul aria-label="Also uploaded" className={styles.chips}>
        {ALSO.map(([word, tip]) => (
          <li key={word} className={layout.chip} title={tip}>
            {word}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PublishChoose(props: PublishChooseProps) {
  const { reply, existing } = props
  const fonts = reply.components.filter((c) => c.kind === 'font')
  return (
    <>
      <StorageChoice
        storages={reply.storages}
        chosen={props.storage}
        disabled={props.sending}
        onChoose={props.onChoose}
        onClose={props.onClose}
      />
      {props.storage !== null && props.looking && (
        <p role="status" className={styles.line}>
          Looking at the published folder…
        </p>
      )}
      {existing !== null && (
        <ReplaceWarning
          existing={existing}
          confirmed={props.replaceOn}
          disabled={props.sending}
          onConfirm={props.onReplace}
        />
      )}
      <p className={styles.prompt}>
        <span>Files carry their prompts.</span>
        <InfoTip about="prompts">{PROMPT_LINE}</InfoTip>
      </p>
      <PublishFileList projectId={props.projectId} components={reply.components} />
      {fonts.length > 0 && (
        <FontShareChoice
          projectId={props.projectId}
          fonts={fonts}
          disabled={props.sending}
          onChanged={props.onFontsChanged}
        />
      )}
      <AlsoUploaded />
    </>
  )
}

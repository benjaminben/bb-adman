// R3-3: the primary language's block, first in the Translations tab and marked "Source". Its
// texts are the ones the translations come from. Saving a text sends layer.update { copy }, the
// command the editor sends for a text layer's words, so the same rules run: one undo step on
// that variant's list, linked variants follow, and the translations of a changed text read as
// out of date. Nothing here starts a translation. After every reply the rows are read again; a
// refusal's own message shows on its row.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { Section } from '@/renderer/ui/section'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { SourceRow as Row } from '@/shared/schemas/queries/translation'
import { DirectionLists } from './direction-lists'
import { SourceRow } from './source-row'
import { languageName } from './translation-words'
import styles from './translation-panel.module.css'

export type SourceGroupProps = {
  projectId: string
  language: string // the primary language's code
  rows: Row[]
  data: CampaignGet
  revs: ReadonlyMap<string, number> // each variant's revision, for its thumbnail
  reload: () => void
}

export function SourceGroup(props: SourceGroupProps) {
  const api = useApi()
  const [messages, setMessages] = useState<Record<string, string>>({})
  const name = languageName(props.language)

  const save = async (layerId: string, copy: string) => {
    setMessages({})
    const input = { projectId: props.projectId, layerId, patch: { copy } }
    const reply = await api.command('layer.update', input)
    if (!reply.ok) setMessages({ [layerId]: reply.error.message })
    props.reload()
  }

  return (
    <div className={styles.block}>
      <Section
        id={`translations.${props.language}`}
        title={name}
        level={2}
        size="title"
        fold="none"
        summary={<span className={styles.sourceMark}>Source</span>}
      >
        <div className={styles.heads}>
          <span />
          <span className={styles.spans}>{name}</span>
        </div>
        <DirectionLists rows={props.rows} data={props.data} label={`${name} texts`}>
          {(row) => (
            <SourceRow
              key={`${row.layerId}:${row.copyRev}`}
              projectId={props.projectId}
              row={row}
              rev={props.revs.get(row.variantId)}
              language={name}
              message={messages[row.layerId] ?? null}
              onSave={(text) => void save(row.layerId, text)}
            />
          )}
        </DirectionLists>
      </Section>
    </div>
  )
}

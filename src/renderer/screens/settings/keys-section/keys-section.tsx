// Keys for the AI providers (FR-170, R-10) as one Section (SET-2). The summary counts the
// available providers whose keys are all saved. Storage keys are on the Publish page.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { KeyRow, SoonRow } from '@/renderer/screens/settings/key-row'
import { Section } from '@/renderer/ui/section'
import { InfoTip } from '@/renderer/ui/info-tip'
import styles from './keys-section.module.css'

export function KeysSection(props: { fold?: 'open' | 'none' }) {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const secrets = useApp((s) => s.app?.secrets ?? EMPTY)
  const aiProviders = providers.filter((p) => p.secrets.length > 0 && !p.jobs.includes('storage'))
  const available = aiProviders.filter((p) => p.available)
  const saved = available.filter((p) => p.secrets.every((n) => secrets.some((s) => s.name === n)))

  return (
    <Section
      id="settings.keys"
      title="Keys"
      level={3}
      fold={props.fold ?? 'open'}
      summary={`${saved.length} of ${available.length}`}
      info={
        <InfoTip about="keys">
          Keys are stored encrypted on this computer. After saving, only the last four characters
          are shown.
        </InfoTip>
      }
    >
      <div className={styles.rows}>
        {aiProviders.map((p) =>
          p.available ? (
            p.secrets.map((name) => <KeyRow key={name} provider={p} name={name} />)
          ) : (
            <SoonRow key={p.id} provider={p} />
          ),
        )}
      </div>
    </Section>
  )
}

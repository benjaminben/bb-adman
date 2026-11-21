// Settings: Cloud storage, the Amazon S3 part (D-096, A-95; spec/approvals.md "Cloud storage:
// the S3 part"). The keys use the Settings key rows: a saved key is shown by its last four only.
// Dropbox joins this section in Phase 9.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { KeyRow } from '@/renderer/screens/settings/key-row'
import { S3Check } from '@/renderer/screens/settings/s3-check'
import layout from '@/renderer/ui/layout.module.css'
import { S3Form } from './s3-form'
import styles from './s3-section.module.css'

const S3_PERMISSIONS =
  'The keys need permission to list the bucket and to read, write and delete files in it.'

export function S3Section() {
  const saved = useApp((s) => s.app?.settings.storage.s3 ?? null)
  const provider = useApp((s) => s.app?.providers ?? EMPTY).find((p) => p.id === 's3')
  // A new save remounts the form with the saved values; a refused one changes nothing.
  const formKey = saved === null ? 'none' : JSON.stringify(saved)

  return (
    <section className={layout.card} aria-labelledby="s3-title">
      <h2 id="s3-title">Cloud storage</h2>
      <h3 className={styles.subheading}>Amazon S3</h3>
      <p className={layout.muted}>
        Adman keeps pictures in your own Amazon S3 bucket. Enter the bucket and the keys from your
        Amazon Web Services account.
      </p>
      <dl className={styles.saved}>
        <dt>Saved bucket</dt>
        <dd>{saved === null || saved.bucket === '' ? 'Not set up.' : saved.bucket}</dd>
        {saved !== null && (
          <>
            <dt>Saved region</dt>
            <dd>{saved.region === '' ? 'not set up' : saved.region}</dd>
          </>
        )}
      </dl>
      <S3Form key={formKey} saved={saved} />
      <p>{S3_PERMISSIONS}</p>
      {provider?.secrets.map((name) => (
        <KeyRow key={name} provider={provider} name={name} />
      ))}
      <S3Check />
    </section>
  )
}

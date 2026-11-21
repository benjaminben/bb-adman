// "Test connection" for Amazon S3 (spec/storage-and-publish.md "Test connection (S3)"). Sends
// storage.checkS3 and shows "Connected." or the main process's one sentence. Disabled until a
// bucket and a region are saved; keys are not needed to press it (a missing key gives the
// NEEDS_KEY sentence). The line is cleared when the saved S3 settings or keys change.
import { useState } from 'react'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { S3_CONNECTED_MESSAGE } from '@/shared/schemas/commands/storage-check'
import layout from '@/renderer/ui/layout.module.css'
import styles from './s3-check.module.css'

const S3_KEYS = new Set(['s3.accessKeyId', 's3.secretAccessKey'])

export function S3Check() {
  const saved = useApp((s) => s.app?.settings.storage.s3 ?? null)
  const secrets = useApp((s) => s.app?.secrets ?? EMPTY)
  const keys = secrets.filter((secret) => S3_KEYS.has(secret.name))
  // A new value remounts the button part, which clears the result line.
  const changed = JSON.stringify([saved, keys])
  const setUp = saved !== null && saved.bucket !== '' && saved.region !== ''
  return <CheckButton key={changed} setUp={setUp} />
}

function CheckButton(props: { setUp: boolean }) {
  const command = useApp((s) => s.command)
  const [testing, setTesting] = useState(false)
  const [line, setLine] = useState('')

  async function test() {
    setTesting(true)
    setLine('')
    const reply = await command('storage.checkS3', {})
    setLine(reply.ok ? S3_CONNECTED_MESSAGE : reply.error.message)
    setTesting(false)
  }

  return (
    <div className={styles.check}>
      <div className={layout.row}>
        <button
          type="button"
          disabled={!props.setUp || testing}
          aria-describedby="s3-check-hint"
          onClick={() => void test()}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>
      <p id="s3-check-hint" className={styles.hint}>
        Tests the saved bucket, region and keys.
      </p>
      <p role="status" className={styles.result}>
        {line}
      </p>
    </div>
  )
}

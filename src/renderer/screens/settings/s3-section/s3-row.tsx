// The Amazon S3 row of Cloud storage (SET-4; D-096, A-95; spec/approvals.md "Cloud storage: the
// S3 part"). The mark says set up or not, or the last Test's result. The form starts open while
// the bucket or region is missing. The keys use the Settings key rows: a saved key is shown by
// its last four only. The line that says where pictures go stays under the row.
import { useEffect, useState } from 'react'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { KeyRow } from '@/renderer/screens/settings/key-row'
import {
  CheckMark,
  CheckNotice,
  ServiceRow,
  TestButton,
  rowButtonId,
  useS3Check,
} from '@/renderer/screens/settings/s3-check'
import { InfoTip } from '@/renderer/ui/info-tip'
import { S3Form } from './s3-form'
import { onRevealS3Row, openSectionAround } from './s3-reveal'

const ROW_ID = 's3'

export function S3Row() {
  const saved = useApp((s) => s.app?.settings.storage.s3 ?? null)
  const provider = useApp((s) => s.app?.providers ?? EMPTY).find((p) => p.id === 's3')
  const check = useS3Check()
  const [open, setOpen] = useState(!check.setUp)
  const [revealed, setRevealed] = useState(0)
  // A new save remounts the form with the saved values; a refused one changes nothing.
  const formKey = saved === null ? 'none' : JSON.stringify(saved)

  useEffect(
    () =>
      onRevealS3Row(() => {
        openSectionAround(document.getElementById(rowButtonId(ROW_ID)))
        setOpen(true)
        setRevealed((n) => n + 1)
      }),
    [],
  )
  useEffect(() => {
    if (revealed > 0) document.getElementById(rowButtonId(ROW_ID))?.focus()
  }, [revealed])

  const setUp =
    check.setUp && saved !== null
      ? { label: `${saved.bucket} · ${saved.region}`, tip: `Set up: ${saved.bucket}` }
      : null

  return (
    <ServiceRow
      id={ROW_ID}
      name="Amazon S3"
      info={
        <InfoTip about="Amazon S3">
          Enter the bucket and the keys from your Amazon Web Services account. The keys need
          permission to list the bucket and to read, write and delete files in it.
        </InfoTip>
      }
      mark={<CheckMark result={check.result} setUp={setUp} />}
      action={
        <TestButton
          missing={check.setUp ? null : 'Save a bucket and region first'}
          testing={check.testing}
          onTest={check.test}
        />
      }
      notices={<CheckNotice result={check.result} />}
      line="Pictures are kept in your own Amazon S3 bucket."
      open={open}
      onToggle={() => setOpen(!open)}
      form={
        <>
          <S3Form key={formKey} saved={saved} />
          {provider?.secrets.map((name) => (
            <KeyRow key={name} provider={provider} name={name} />
          ))}
        </>
      }
    />
  )
}

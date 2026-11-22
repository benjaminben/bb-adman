// The mark, the Test button and the failure notice shared by the Amazon S3 and approvals rows
// (SET-4). A test's result is not stored: it shows until the page is left or the saved values
// change (OI-DW-2). A failure's sentence is the mark's tip and also a notice under the row, so
// it stays on the page. The mark sits in a status region, so a screen reader hears the change.
import { StatusMark } from '@/renderer/ui/status-mark'
import { NoticeIcon, noticeClass } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'

export type CheckResult = { ok: boolean; sentence: string }
export type SetUpMark = { label: string; tip: string }

export function CheckMark(props: { result: CheckResult | null; setUp: SetUpMark | null }) {
  return <span role="status">{mark(props)}</span>
}

function mark(props: { result: CheckResult | null; setUp: SetUpMark | null }) {
  const { result, setUp } = props
  if (result?.ok === true)
    return <StatusMark tone="ok" icon="check" label="Connected" tip={result.sentence} />
  if (result?.ok === false)
    return <StatusMark tone="danger" icon="xCircle" label="Failed" tip={result.sentence} />
  if (setUp !== null) return <StatusMark tone="ok" label={setUp.label} tip={setUp.tip} />
  return <StatusMark tone="none" label="Not set" tip="Not set" />
}

export function CheckNotice(props: { result: CheckResult | null }) {
  if (props.result === null || props.result.ok) return null
  return (
    <p className={noticeClass('danger')}>
      <NoticeIcon kind="danger" />
      {props.result.sentence}
    </p>
  )
}

// "Test" on the row, named "Test connection"; disabled with what is missing in its title.
export function TestButton(props: {
  missing: string | null
  testing: boolean
  onTest: () => void
}) {
  return (
    <button
      type="button"
      className={`${layout.secondary} ${layout.small}`}
      aria-label="Test connection"
      title={props.missing ?? undefined}
      disabled={props.missing !== null || props.testing}
      onClick={props.onTest}
    >
      {props.testing ? 'Testing…' : 'Test'}
    </button>
  )
}

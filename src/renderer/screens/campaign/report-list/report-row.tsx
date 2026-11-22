// One export in the reports list (CAMP-6, spec/phases/design-wave-screens-b.md): an ObjectRow
// with the file icon, "Export {n}" (numbered from the oldest), the time, a mark for the files
// written and, when any failed, a mark with "{n} failed" as visible words. The tooltip is the
// export folder's base name only. A click (or Enter, which clicks the button) opens the report.
import { utcTime } from '@/renderer/dialogs/report-view/report-words'
import { Icon } from '@/renderer/ui/icon'
import { ObjectRow } from '@/renderer/ui/object-row'
import { plural } from '@/renderer/ui/plural'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { ReportEntry } from './read-reports'

export function ReportRow(props: { report: ReportEntry; onOpen: () => void }) {
  const { report } = props
  const { exported, failed } = report.summary
  const marks = (
    <>
      <StatusMark
        tone="ok"
        icon="check"
        label={String(exported)}
        tip={`${plural(exported, 'file')} written`}
      />
      {failed > 0 && (
        <StatusMark
          tone="danger"
          icon="xCircle"
          label={`${failed} failed`}
          tip={`${plural(failed, 'file')} failed`}
        />
      )}
    </>
  )
  return (
    <li>
      <ObjectRow
        name={`Export ${report.exportNumber}`}
        label={`Export ${report.exportNumber}…`}
        thumb={<Icon name="file" />}
        meta={utcTime(report.createdAt)}
        marks={marks}
        title={report.folder}
        onSelect={props.onOpen}
      />
    </li>
  )
}

// A refused Dropbox command's sentence, as an alert (spec/phases/phase-09.md "Screens"). The
// look is the Settings danger notice; the words are the main process's, drawn as text.
import type { ReactNode } from 'react'
import { NoticeIcon, noticeClass } from '@/renderer/screens/settings/notice-line'

export function Refusal(props: { id: string; children: ReactNode }) {
  return (
    <p id={props.id} role="alert" className={noticeClass('danger')}>
      <NoticeIcon kind="danger" />
      {props.children}
    </p>
  )
}

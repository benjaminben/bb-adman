// Settings: Cloud storage (SET-4, the storage rows): Amazon S3, then Dropbox, each a row of its
// own. The approvals service is not here. The first-run setup draws it with fold="none".
import { Section } from '@/renderer/ui/section'
import { DropboxSection } from '@/renderer/screens/settings/dropbox-section'
import { S3Row } from './s3-row'

export function S3Section(props: { fold?: 'open' | 'none' }) {
  return (
    <Section id="settings.storage" title="Cloud storage" level={3} fold={props.fold ?? 'open'}>
      <S3Row />
      <DropboxSection />
    </Section>
  )
}

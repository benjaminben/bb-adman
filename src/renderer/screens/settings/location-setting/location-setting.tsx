// Settings "Projects folder" (FR-004, SET-3): the default folder for new projects as one row.
// The path is the user's own choice, so it may show: cut in the middle on the row, whole in the
// tooltip and the row's accessible name. Change opens the system folder picker.
import { useApi, useApp, pickPath } from '@/renderer/app/app-context'
import { Section } from '@/renderer/ui/section'
import { ObjectRow } from '@/renderer/ui/object-row'
import { Icon } from '@/renderer/ui/icon'
import { middleCut } from '@/renderer/ui/middle-cut'
import layout from '@/renderer/ui/layout.module.css'

export function LocationSetting() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const dir = useApp((s) => s.app?.settings.defaultProjectDir ?? '')

  async function change() {
    const picked = await pickPath(api, 'dialog.pickFolder', dir)
    if (picked) await command('settings.update', { defaultProjectDir: picked })
  }

  return (
    <Section id="settings.folder" title="Projects folder" level={3} fold="none">
      <ObjectRow
        thumb={<Icon name="folder" />}
        name={middleCut(dir)}
        title={dir}
        label={dir === '' ? 'Projects folder' : `Projects folder ${dir}`}
        stateActions={
          <button
            type="button"
            className={layout.secondary}
            aria-label="Change default location"
            onClick={() => void change()}
          >
            Change
          </button>
        }
      />
    </Section>
  )
}

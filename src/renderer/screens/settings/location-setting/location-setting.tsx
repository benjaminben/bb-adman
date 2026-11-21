import { useApi, useApp, pickPath } from '@/renderer/app/app-context'
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
    <div className={layout.card}>
      <h2 id="location-title">New projects</h2>
      <p className={layout.label}>Default location</p>
      <p className={layout.path}>{dir}</p>
      <div className={layout.row}>
        <button type="button" onClick={() => void change()}>
          Change default location
        </button>
      </div>
    </div>
  )
}

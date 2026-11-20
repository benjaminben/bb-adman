import { useApi, useApp, pickPath } from '../../app/app-context'
import styles from '../screens.module.css'

export function LocationSetting() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const dir = useApp((s) => s.app?.settings.defaultProjectDir ?? '')

  async function change() {
    const picked = await pickPath(api, 'dialog.pickFolder', dir)
    if (picked) await command('settings.update', { defaultProjectDir: picked })
  }

  return (
    <div className={styles.card}>
      <h2 id="location-title">New projects</h2>
      <p className={styles.label}>Default location</p>
      <p className={styles.path}>{dir}</p>
      <button type="button" onClick={() => void change()}>
        Change default location
      </button>
    </div>
  )
}

// The throwaway hand-test screen (SPEC 14 slice I, OI-28 option (a)). Shown only when
// app.getState says devTools. Not product UI: removed once the real screens exist.
import { S3SettingsForm } from './s3-settings-form'
import { DropboxSignIn } from './dropbox-sign-in'
import { StorageActions } from './storage-actions'
import { HAND_TEST_DROPBOX } from '../../shared/config/dev-tools'
import styles from '../screens/screens.module.css'

export function HandTestScreen() {
  return (
    <section className={styles.screen} aria-labelledby="hand-test-title">
      <h1 id="hand-test-title">Hand test</h1>
      <p>Development tools only. Not part of the product.</p>
      <S3SettingsForm />
      {HAND_TEST_DROPBOX && <DropboxSignIn />}
      <StorageActions />
    </section>
  )
}

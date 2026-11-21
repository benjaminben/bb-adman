// SPEC 12 [1.8], 4.2 dev.storage: the one folder the hand-test tools may touch in any storage
// (under the S3 prefix, the Dropbox root folder, or the app data folder for `local`).
export const HAND_TEST_FOLDER = 'adman-hand-test'

// [1.21] F-01: the root for `local`, {userData}/hand-test-local, its own folder and not the app
// data folder. Files land in {userData}/hand-test-local/adman-hand-test/.
export const HAND_TEST_LOCAL_ROOT = 'hand-test-local'

// [1.21] F-03: the largest file the hand-test `write` takes, from its stat size, before reading.
export const HAND_TEST_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

// SPEC 14 M5, [1.22] M8: Dropbox stays off the hand-test screen (no storage choice, no sign-in
// button) until slice G sets this to true.
export const HAND_TEST_DROPBOX = false

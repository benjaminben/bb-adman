import type { EventMap } from '@/shared/schemas/events'
import type { GalleryRuns } from './runs'

// One approvals.progress event without its IDs: the step and its counts.
export type PublishProgress = Omit<EventMap['approvals.progress'], 'projectId' | 'campaignId'>

// The approvals services on CoreDeps (spec/approvals.md "Kept passwords", "Pictures"). AP-5
// fixes these shapes; AP-6 fills the password store and AP-7 the picture stores.

// {userData}/approval-passwords.bin: one encrypted map from `{projectId}/{campaignId}` to the
// password. keep and forget refuse rather than write over a file they cannot read.
export type PasswordStore = {
  keep(projectId: string, campaignId: string, password: string): void
  // null when none is kept on this computer.
  read(projectId: string, campaignId: string): string | null
  forget(projectId: string, campaignId: string): void
  // False when encryption is not available, so keep would refuse (AP-8 ruling).
  canKeep(): boolean
}

// Paths come only from src/shared/approvals/picture-paths.ts, inside
// adman-approvals/{projectId}/{campaignId}/.
export type PictureStore = {
  // A still: a path as picturePath builds it, nothing else.
  put(path: string, png: Uint8Array): Promise<void>
  // A video variant's clip: a path as clipPath builds it, nothing else.
  putClip(path: string, data: ReadableStream<Uint8Array>): Promise<void>
  signedUrl(path: string, seconds: number): Promise<{ url: string; expiresAt: string }>
  list(folder: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}

export type ApprovalsDeps = {
  // The running gallery updates (runs.ts), for update_running and approvals.cancelUpdate.
  runs: GalleryRuns
  passwords: PasswordStore
  // The test store under its condition (dev tools and ADMAN_APPROVALS_TEST_PICTURES), else the
  // S3 store. Nothing else chooses.
  pictures: () => PictureStore
  // Sends approvals.changed { projectId, campaignId } (AP-8): IDs only, after a command
  // changed the local tables.
  changed(projectId: string, campaignId: string): void
  // Sends approvals.progress to the app window only: IDs and counts, nothing else.
  progress(projectId: string, campaignId: string, counts: PublishProgress): void
}

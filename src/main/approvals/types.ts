// The approvals services on CoreDeps (spec/approvals.md "Kept passwords", "Pictures"). AP-5
// fixes these shapes; AP-6 fills the password store and AP-7 the picture stores.

// {userData}/approval-passwords.bin: one encrypted map from `{projectId}/{campaignId}` to the
// password. keep and forget refuse rather than write over a file they cannot read.
export type PasswordStore = {
  keep(projectId: string, campaignId: string, password: string): void
  // null when none is kept on this computer.
  read(projectId: string, campaignId: string): string | null
  forget(projectId: string, campaignId: string): void
}

// Paths come only from src/shared/approvals/picture-paths.ts, inside
// adman-approvals/{projectId}/{campaignId}/.
export type PictureStore = {
  put(path: string, png: Uint8Array): Promise<void>
  signedUrl(path: string, seconds: number): Promise<{ url: string; expiresAt: string }>
  list(folder: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}

export type ApprovalsDeps = {
  passwords: PasswordStore
  // The test store under its condition (dev tools and ADMAN_APPROVALS_TEST_PICTURES), else the
  // S3 store. Nothing else chooses.
  pictures: () => PictureStore
  // Sends approvals.changed { projectId, campaignId } (AP-8): IDs only, after a command
  // changed the local tables.
  changed(projectId: string, campaignId: string): void
}

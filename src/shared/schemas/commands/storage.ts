import { z } from 'zod'

// SPEC 4.2 storage commands [1.8], app-scope. Built in Phase 2 slice G.
export const storageDropboxSignInInput = z.object({}).strict()
export const storageDropboxSignOutInput = z.object({}).strict()

// P9-1 (A-213): the folder inside the Dropbox app folder; '' is the app folder itself. Each
// part's storage path check is the command's, with its own sentence.
export const DROPBOX_ROOT_PATH_MAX = 200
export const storageSetDropboxFolderInput = z
  .object({ rootPath: z.string().trim().max(DROPBOX_ROOT_PATH_MAX) })
  .strict()
export type StorageSetDropboxFolderInput = z.infer<typeof storageSetDropboxFolderInput>

// The sign-in returns the account name and never the token.
export type DropboxSignInResult = { accountName: string }

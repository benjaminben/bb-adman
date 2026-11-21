import { z } from 'zod'

// SPEC 4.2 storage commands [1.8], app-scope. Built in Phase 2 slice G.
export const storageDropboxSignInInput = z.object({}).strict()
export const storageDropboxSignOutInput = z.object({}).strict()

// The sign-in returns the account name and never the token.
export type DropboxSignInResult = { accountName: string }

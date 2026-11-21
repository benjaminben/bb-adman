import { z } from 'zod'

// SPEC 4.2 dev.storage [1.8], app-scope; registered only with the hand-test tools on.
export const devStorageInput = z
  .object({
    storage: z.enum(['s3', 'dropbox', 'local']),
    action: z.enum(['write', 'list', 'remove']),
    filePath: z.string().min(1).optional(),
  })
  .strict()
  .refine((i) => i.action !== 'write' || i.filePath !== undefined, {
    message: 'Choose a file to upload.',
    path: ['filePath'],
  })
export type DevStorageInput = z.infer<typeof devStorageInput>

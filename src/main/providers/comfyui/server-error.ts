// SPEC 6.10.6 "A short break" (F-16): the failure the client throws for a 5xx answer, so a
// poll can count it as a failed poll. Its error is the same as any other unexpected status.
import { ProviderFailure } from '@/main/providers/types'

export class ServerErrorAnswer extends ProviderFailure {}

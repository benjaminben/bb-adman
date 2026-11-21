// approvals.setService (spec/approvals.md "approvals.setService"): the one writer of
// approvals.baseUrl. Security class; agent policy deny. Contacts nothing. Plain http is accepted
// only as the dev-tools test origin, decided by deps.devTools and never by the input.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import {
  approvalsSetServiceInput,
  type ApprovalsSetServiceReply,
} from '@/shared/schemas/commands/approvals'
import { parseApprovalsAddress } from '@/shared/approvals/address'
import { APPROVALS_ADDRESS_MESSAGE } from '@/shared/approvals/messages'
import { AppError } from '@/shared/schemas/result'

export function approvalsSetService(deps: Pick<CoreDeps, 'settings' | 'devTools'>) {
  return defineCommand({
    name: 'approvals.setService',
    input: approvalsSetServiceInput,
    changesAppState: true,
    run(_ctx, input): HandlerResult<ApprovalsSetServiceReply> {
      const baseUrl =
        input.address === null
          ? null
          : parseApprovalsAddress(input.address, { allowLocalHttp: deps.devTools })
      // The typed text goes into no message or detail.
      if (input.address !== null && baseUrl === null) {
        throw new AppError('INVALID_INPUT', APPROVALS_ADDRESS_MESSAGE)
      }
      deps.settings.setApprovalsAddress(baseUrl)
      return { data: { baseUrl } }
    },
  })
}

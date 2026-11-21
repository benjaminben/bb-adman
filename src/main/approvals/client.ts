// The approvals service client (spec/approvals.md "The service client", security class). One
// function per route of spec/approvals-service.md "The keyed API". The caller reads the origin
// and the key at the start of each command and makes a client for that command only.
// - Paths are constants plus IDs that passed the contract's rules; bodies pass the contract's
//   schema before they are sent.
// - Every reply is checked against the contract's schema before use; anything else is a
//   failure with a fixed sentence (failure.ts), logged once without the address, key or body.
// - 404 not_found on a link route is not a failure: the function answers null.
import type { z } from 'zod'
import {
  CONTRACT_VERSION,
  CampaignId,
  CreateLink,
  CreatedLink,
  EmptyReply,
  Gallery,
  GalleryReply,
  HealthReply,
  LinkState,
  NewPassword,
  PictureRenewals,
  ProjectId,
  RenewedReply,
} from '@/shared/approvals/contract'
import type { ActivityLog } from '@/main/log/activity-log'
import { AppError } from '@/shared/schemas/result'
import {
  APPROVALS_REQUEST_REFUSED,
  ApprovalsFailure,
  errorCodeOf,
  failureOf,
  logFailure,
  type ApprovalsRoute,
} from './failure'
import { send, type Call } from './request'

export const TOTAL_MS = 20_000
export const MAX_REPLY_BYTES = 4 * 1024 * 1024

export type ApprovalsService = { origin: string; key: string }

export type ClientOptions = {
  // deps.devTools: only then is the http://127.0.0.1:{port} test origin accepted.
  allowLocalHttp: boolean
  log: ActivityLog
  totalMs?: number
}

export type LinkStateReply = z.infer<typeof LinkState>
type Pair = { projectId: string; campaignId: string }

// What the route answers on success, and which refusals it hands back as values.
type Expect<T> = { status: number; schema: z.ZodType<T>; notFound?: true; exists?: true }
type Outcome<T> = { data: T } | 'not_found' | 'exists'

function refused(): AppError {
  return new AppError('INVALID_INPUT', APPROVALS_REQUEST_REFUSED)
}

function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw refused()
  return parsed.data
}

function linkPath(pair: Pair, tail = ''): string {
  const p = checked(ProjectId, pair.projectId)
  const c = checked(CampaignId, pair.campaignId)
  return `/api/v1/links/${encodeURIComponent(p)}/${encodeURIComponent(c)}${tail}`
}

function readJson(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    return undefined
  }
}

export function createApprovalsClient(service: ApprovalsService, opts: ClientOptions) {
  const target = {
    origin: service.origin,
    key: service.key,
    allowLocalHttp: opts.allowLocalHttp,
    totalMs: opts.totalMs ?? TOTAL_MS,
    maxBytes: MAX_REPLY_BYTES,
  }

  async function ask<T>(route: ApprovalsRoute, call: () => Call, expect: Expect<T>) {
    try {
      const answer = await send(target, call())
      const code = errorCodeOf(answer.bytes)
      if (expect.notFound && answer.status === 404 && code === 'not_found') return 'not_found'
      if (expect.exists && answer.status === 409 && code === 'link_exists') return 'exists'
      if (answer.status !== expect.status) throw failureOf(answer.status, answer.bytes)
      const parsed = expect.schema.safeParse(readJson(answer.bytes))
      if (!parsed.success) throw new ApprovalsFailure('other', answer.status)
      return { data: parsed.data } satisfies Outcome<T>
    } catch (error) {
      // Only fixed sentences leave the client; anything unforeseen is the 'other' failure.
      const known = error instanceof AppError
      const failure = known ? error : new ApprovalsFailure('other')
      if (failure instanceof ApprovalsFailure) logFailure(opts.log, route, failure)
      throw failure
    }
  }

  const found = <T>(outcome: Outcome<T>): T | null =>
    typeof outcome === 'object' ? outcome.data : null

  return {
    // GET /api/v1/health: the service and its contract number.
    async health(): Promise<void> {
      const reply = await ask('health', () => ({ method: 'GET', path: '/api/v1/health' }), {
        status: 200,
        schema: HealthReply,
      })
      if (typeof reply === 'object' && reply.data.contract !== CONTRACT_VERSION) {
        const failure = new ApprovalsFailure('version', 200)
        logFailure(opts.log, 'health', failure)
        throw failure
      }
    },
    // POST /api/v1/links: the new slug, or 'exists' on 409 link_exists.
    async createLink(input: z.input<typeof CreateLink>): Promise<{ slug: string } | 'exists'> {
      const call = (): Call => ({
        method: 'POST',
        path: '/api/v1/links',
        body: checked(CreateLink, input),
      })
      const reply = await ask('createLink', call, {
        status: 201,
        schema: CreatedLink,
        exists: true,
      })
      return typeof reply === 'object' ? { slug: reply.data.slug } : 'exists'
    },
    async getLink(pair: Pair): Promise<LinkStateReply | null> {
      const call = (): Call => ({ method: 'GET', path: linkPath(pair) })
      return found(await ask('getLink', call, { status: 200, schema: LinkState, notFound: true }))
    },
    // true when set; false when the link is gone.
    async setPassword(pair: Pair, password: string): Promise<boolean> {
      const call = (): Call => ({
        method: 'PUT',
        path: linkPath(pair, '/password'),
        body: checked(NewPassword, { password }),
      })
      const reply = await ask('setPassword', call, {
        status: 200,
        schema: EmptyReply,
        notFound: true,
      })
      return found(reply) !== null
    },
    async replaceGallery(pair: Pair, gallery: z.input<typeof Gallery>): Promise<number | null> {
      const call = (): Call => ({
        method: 'PUT',
        path: linkPath(pair, '/gallery'),
        body: checked(Gallery, gallery),
      })
      const reply = await ask('replaceGallery', call, {
        status: 200,
        schema: GalleryReply,
        notFound: true,
      })
      return found(reply)?.variants ?? null
    },
    async renewPictures(
      pair: Pair,
      renewals: z.input<typeof PictureRenewals>,
    ): Promise<number | null> {
      const call = (): Call => ({
        method: 'PUT',
        path: linkPath(pair, '/pictures'),
        body: checked(PictureRenewals, renewals),
      })
      const reply = await ask('renewPictures', call, {
        status: 200,
        schema: RenewedReply,
        notFound: true,
      })
      return found(reply)?.renewed ?? null
    },
    // true when deleted; false when the link was already gone.
    async deleteLink(pair: Pair): Promise<boolean> {
      const call = (): Call => ({ method: 'DELETE', path: linkPath(pair) })
      const reply = await ask('deleteLink', call, {
        status: 200,
        schema: EmptyReply,
        notFound: true,
      })
      return found(reply) !== null
    },
  }
}

export type ApprovalsClient = ReturnType<typeof createApprovalsClient>

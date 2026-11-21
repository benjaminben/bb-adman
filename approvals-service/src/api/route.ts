// One entry of the keyed API's route table. A handler gets its body typed and parsed by its own
// schema, after the route's check; it never reads the raw request.
import type { z } from 'zod'
import type { Parts } from '../app'
import { CampaignId, ProjectId } from '../contract'
import type { Env } from '../env'
import { apiError, notBuilt, type Code } from './errors'
import { readJsonBody } from './body'

export type ApiContext<B> = {
  env: Env
  parts: Parts
  // The link's pair from the path, checked against the contract; null on routes without one.
  link: { projectId: string; campaignId: string } | null
  // The body as the route's schema parsed it (trimmed, lower-cased where it says so).
  body: B
}

export type ApiHandler<B = undefined> = (ctx: ApiContext<B>) => Promise<Response>

export type Refusal = { status: number; code: Code }

// A check the schema cannot make (a picture address's host): null lets the request through.
export type BodyCheck<B> = (body: B, env: Env) => Refusal | null | Promise<Refusal | null>

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

type Head = { name: string; method: Method; path: RegExp }

// The table's form: the body's type is kept inside `run`, so routes of any body share a list.
export type ApiRoute = Head & {
  hasCheck: boolean
  isStub: boolean
  run: (request: Request, base: Base, ids: string[]) => Promise<Response>
}

type Base = { env: Env; parts: Parts }
type Link = ApiContext<undefined>['link']

// The path's IDs, checked against the contract (step 5); undefined when they fail.
function linkOf(ids: string[]): Link | undefined {
  if (ids.length !== 2) return null
  const projectId = ProjectId.safeParse(ids[0])
  const campaignId = CampaignId.safeParse(ids[1])
  if (!projectId.success || !campaignId.success) return undefined
  return { projectId: projectId.data, campaignId: campaignId.data }
}

export function plainRoute(def: Head & { handler: ApiHandler }): ApiRoute {
  const { handler, ...head } = def
  return {
    ...head,
    hasCheck: false,
    isStub: handler === notBuilt,
    async run(_request, base, ids) {
      const link = linkOf(ids)
      if (link === undefined) return apiError(400, 'invalid_input')
      return handler({ ...base, link, body: undefined })
    },
  }
}

export function bodyRoute<S extends z.ZodType>(
  def: Head & { body: S; check?: BodyCheck<z.output<S>>; handler: ApiHandler<z.output<S>> },
): ApiRoute {
  const { body: schema, check, handler, ...head } = def
  return {
    ...head,
    hasCheck: check !== undefined,
    isStub: handler === notBuilt,
    async run(request, base, ids) {
      // Steps 4 and 5: the body's type and size, then the contract, then the route's check.
      const read = await readJsonBody(request)
      if (!read.ok) return read.reply
      const parsed = schema.safeParse(read.value)
      const link = linkOf(ids)
      if (!parsed.success || link === undefined) return apiError(400, 'invalid_input')
      const refusal = check === undefined ? null : await check(parsed.data, base.env)
      if (refusal !== null) return apiError(refusal.status, refusal.code)
      return handler({ ...base, link, body: parsed.data })
    },
  }
}

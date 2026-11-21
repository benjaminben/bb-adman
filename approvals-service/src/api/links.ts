// POST /links, PUT .../password and DELETE of a link (spec/approvals-service.md "The keyed API").
import type { z } from 'zod'
import type { CreateLink, NewPassword } from '../contract'
import { hashPassword } from '../crypto/password'
import { randomLetters } from '../crypto/random'
import { deleteLink, findLinkByPair, insertLink, setLinkPassword } from '../db/links'
import { deleteLinkSessions } from '../db/sessions'
import { apiError, apiJson } from './errors'
import { linkOf } from './link-of'
import type { ApiHandler } from './route'

const SLUG_TRIES = 3

export const createLink: ApiHandler<z.output<typeof CreateLink>> = async (ctx) => {
  const { env, parts, body } = ctx
  const exists = async () =>
    (await findLinkByPair(env.DB, body.projectId, body.campaignId)) !== null
  if (await exists()) return apiError(409, 'link_exists')
  const password = await hashPassword(body.password)
  for (let attempt = 0; attempt < SLUG_TRIES; attempt++) {
    const slug = randomLetters(12, parts.random)
    const row = {
      id: randomLetters(24, parts.random),
      slug,
      projectId: body.projectId,
      campaignId: body.campaignId,
      campaignName: body.campaignName,
      password,
      createdAt: parts.now(),
    }
    try {
      await insertLink(env.DB, row).run()
      return apiJson({ slug }, 201)
    } catch {
      // A UNIQUE refusal: the pair was taken meanwhile, or the slug (or ID) clashed.
      if (await exists()) return apiError(409, 'link_exists')
    }
  }
  // The router logs the route and this error's name, and answers 500 internal.
  throw new Error('slug clash')
}

// A new salt and hash, the wrong-password count reset, and every session of the link ended,
// all in one batch.
export const setPassword: ApiHandler<z.output<typeof NewPassword>> = async (ctx) => {
  const link = await linkOf(ctx)
  if (link === null) return apiError(404, 'not_found')
  const password = await hashPassword(ctx.body.password)
  const db = ctx.env.DB
  await db.batch([setLinkPassword(db, link.id, password), deleteLinkSessions(db, link.id)])
  return apiJson({})
}

export const removeLink: ApiHandler = async (ctx) => {
  const link = await linkOf(ctx)
  if (link === null) return apiError(404, 'not_found')
  await deleteLink(ctx.env.DB, link.id)
  return apiJson({})
}

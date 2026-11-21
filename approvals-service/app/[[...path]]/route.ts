// spec/approvals-service.md "How Next.js and the service code fit": every request except the
// page goes to createApp. Every HTTP method is exported, so Next.js answers none of its own.
import { serve } from '../../src/server/serve'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = serve
export const HEAD = serve
export const POST = serve
export const PUT = serve
export const DELETE = serve
export const PATCH = serve
export const OPTIONS = serve

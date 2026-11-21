// spec/approvals-gallery.md "Routes": the password page or the gallery. The link comes only from
// the path's slug and the session cookie; only the view reaches a component. The page sets no
// cookie and never sends a right-shape slug elsewhere: the same 200 for a real and unknown one.
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Slug } from '../../../src/contract'
import { loadEnv } from '../../../src/server/env'
import { GalleryScreen } from '../../../src/ui/gallery-screen/gallery-screen'
import { PasswordScreen } from '../../../src/ui/password-screen/password-screen'
import { openGallery, type GalleryResult } from '../../../src/visitor/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

class PageFailed extends Error {
  override name = 'PageFailed'
  constructor() {
    super('The page could not be drawn.')
  }
}

async function load(slug: string, cookie: string | null, m: string | null) {
  try {
    return await openGallery(loadEnv().DB, { slug, cookie, m }, Date.now())
  } catch (error) {
    // spec "Logs": the page's name and the error's name only.
    console.error('gallery-page', error instanceof Error ? error.name : 'unknown')
    throw new PageFailed()
  }
}

export default async function GalleryPage({ params, searchParams }: Props) {
  const { slug } = await params
  // A second guard: proxy.ts already answers a wrong-shape slug with the plain 404.
  if (!Slug.safeParse(slug).success) notFound()
  const { m } = await searchParams
  const cookie = (await headers()).get('cookie')
  const result: GalleryResult = await load(slug, cookie, typeof m === 'string' ? m : null)
  if (result.kind === 'gallery') return <GalleryScreen view={result.view} />
  return <PasswordScreen slug={slug} notice={result.notice} />
}

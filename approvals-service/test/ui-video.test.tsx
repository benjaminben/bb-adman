import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { clipLength } from '../src/ui/clip-length'
import { GalleryScreen } from '../src/ui/gallery-screen/gallery-screen'
import { Lightbox } from '../src/ui/lightbox/lightbox'
import { SignoffAll } from '../src/ui/signoff-all/signoff-all'
import { VariantCard } from '../src/ui/variant-card/variant-card'
import type { GalleryView, Variant } from '../src/visitor/actions'

// round-2-approvals-video.md "The gallery" (R2V-4): the video mark, the button names, the
// lightbox's <video>, its line and notices, and the "Sign off all" sentence, as static markup.
const html = (element: ReactElement) => renderToStaticMarkup(element)
const SLUG = 'abcdEFGH2345'
const KEY = 'aaaa22'
const NO_PLAY = 'This browser cannot play the video.'
const CLIP_ERROR =
  'The video could not be loaded. Reload the page to try again. If it still fails, ask the person who sent the link to update the gallery.'
const STILL_ONLY =
  'This variant is a video, but only its still picture was sent. Ask the person who sent the link to update the gallery.'

const variant = (extra: Partial<Variant> = {}): Variant => ({
  variantKey: KEY,
  position: 0,
  title: 'Morning run, 9:16',
  sizeLine: '1080 × 1920 · 0:30',
  version: 3,
  expired: false,
  video: null,
  ...extra,
})
const withClip = (durationMs = 30000, extra: Partial<Variant> = {}) =>
  variant({ video: { clip: { durationMs } }, ...extra })
const stillOnly = (extra: Partial<Variant> = {}) => variant({ video: { clip: null }, ...extra })

const box = (given: Variant) =>
  html(<Lightbox slug={SLUG} variant={given} signoffs={[]} reviewer={null} />)
const card = (given: Variant) =>
  html(<VariantCard slug={SLUG} variant={given} signoffs={[]} reviewer={null} mine={false} />)

// Every <tag ...> in the markup, as its attribute text with a leading space.
const tags = (markup: string, tag: string) =>
  [...markup.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g'))].map((m) => ` ${m[1] ?? ''}`)

const text = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

describe('clipLength [round-2-approvals-video.md "The gallery"]', () => {
  it.each([
    [1, '0:01'],
    [999, '0:01'],
    [1000, '0:01'],
    [1001, '0:02'],
    [30000, '0:30'],
    [65000, '1:05'],
    [180000, '3:00'],
  ])('shows %d ms as %s', (ms, shown) => {
    expect(clipLength(ms)).toBe(shown)
  })
})

describe('the lightbox of a video with a clip [round-2-approvals-video.md "The lightbox"]', () => {
  const markup = box(withClip())

  it('draws the browser player from the clip route, with nothing that plays by itself', () => {
    const videos = tags(markup, 'video')
    expect(videos).toHaveLength(1)
    const video = videos[0] ?? ''
    for (const attr of [
      'controls=""',
      'preload="none"',
      'playsinline=""',
      'controlslist="nodownload"',
      `poster="/l/${SLUG}/p/${KEY}/3"`,
      'width="1080"',
      'height="1920"',
    ]) {
      // HTML attribute names are case-insensitive; React writes playsInline and controlsList.
      expect(video.toLowerCase()).toContain(` ${attr}`.toLowerCase())
    }
    expect(video).not.toMatch(/autoplay|muted|\ssrc=|style=/i)
    expect(markup.match(/<source[^>]*>/g)).toEqual([
      `<source src="/l/${SLUG}/c/${KEY}/3" type="video/mp4"/>`,
    ])
    expect(markup).not.toContain('<img')
  })

  it('has the fallback text, the line and the hidden error notice', () => {
    expect(markup).toMatch(new RegExp(`<video[^>]*>.*${NO_PLAY}</video>`))
    expect(text(markup)).toContain('Video, 0:30. Sound plays when you press play.')
    const notice = tags(markup, 'div').find((attrs) => attrs.includes(' data-clip-error'))
    expect(notice).toBeDefined()
    expect(notice).toContain(' hidden=""')
    expect(notice).toContain(' role="alert"')
    expect(text(markup)).toContain(CLIP_ERROR)
    expect(text(markup)).not.toContain(STILL_ONLY)
  })

  it('shows the expiry sentence and no player once the picture has expired', () => {
    const expired = box(withClip(30000, { expired: true }))
    expect(expired).not.toContain('<video')
    expect(expired).not.toContain('/c/')
  })
})

describe('the lightbox of a video sent as its still only', () => {
  it('shows the still and the info notice, and no player', () => {
    const markup = box(stillOnly())
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('/c/')
    expect(tags(markup, 'img')[0]).toContain(` src="/l/${SLUG}/p/${KEY}/3"`)
    expect(markup).toMatch(new RegExp(`role="status"[^>]*>${STILL_ONLY}<`))
    expect(text(markup)).not.toContain(CLIP_ERROR)
  })

  it('draws an image variant with neither notice', () => {
    const markup = box(variant())
    expect(text(markup)).not.toContain(STILL_ONLY)
    expect(markup).not.toContain('data-clip-error')
  })
})

describe('the card of a video variant [round-2-approvals-video.md "The card"]', () => {
  const opener = (markup: string) =>
    tags(markup, 'button').find((attrs) => attrs.includes(' command="show-modal"')) ?? ''

  it.each([
    ['with a clip', withClip(65000), 'Open video: Morning run, 9:16, 1:05', 'Video 1:05'],
    [
      'still only',
      stillOnly(),
      'View larger: Morning run, 9:16. Video, still picture only.',
      'Video, still only',
    ],
  ])('%s: names the picture button and marks the picture', (_name, given, label, mark) => {
    const markup = card(given)
    expect(opener(markup)).toContain(` aria-label="${label}"`)
    expect(markup).toMatch(new RegExp(`command="show-modal"[^>]*>.*${mark}.*</button>`))
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('keeps an image card unmarked under its old name', () => {
    const markup = card(variant())
    expect(opener(markup)).toContain(' aria-label="View larger: Morning run, 9:16"')
    expect(markup).not.toContain('<svg')
    expect(text(markup)).not.toContain('Video')
  })

  it('escapes a hostile title in the names and the lightbox [S-13]', () => {
    const hostile = `<script>alert(1)</script>"'&`
    const markup = html(
      <GalleryScreen
        view={view([
          withClip(30000, { title: hostile }),
          stillOnly({ variantKey: 'bbbb22', title: hostile }),
        ])}
      />,
    )
    expect(markup).not.toContain('<script')
    expect(markup).toContain(
      'Open video: &lt;script&gt;alert(1)&lt;/script&gt;&quot;&#x27;&amp;, 0:30',
    )
  })
})

function view(variants: Variant[]): GalleryView {
  return {
    link: { slug: SLUG, campaignName: 'Spring juice launch' },
    variants,
    signoffs: [],
    reviewer: null,
    stamp: '0'.repeat(64),
    notice: null,
  }
}

const BASE =
  'This signs off on every variant shown that you have not signed yet, as the email under “Signing off as:”. You can remove a sign-off later, one at a time.'

describe('"Sign off all" with videos [round-2-approvals-video.md "Sign off all"]', () => {
  const confirmation = (markup: string) =>
    text(markup).split('Sign off all? ')[1]?.split(' Cancel')[0] ?? ''

  it.each([
    [0, BASE],
    [1, `${BASE} It includes 1 video. Watch each one before you sign off.`],
    [2, `${BASE} It includes 2 videos. Watch each one before you sign off.`],
  ])('with %d videos', (videos, words) => {
    const markup = html(
      <SignoffAll slug={SLUG} reviewer={null} left={3} live={3} videos={videos} />,
    )
    expect(confirmation(markup)).toBe(words)
  })

  it('counts only live videos with a clip in the gallery', () => {
    const markup = html(
      <GalleryScreen
        view={view([
          withClip(30000, { variantKey: 'aaaa22' }),
          withClip(30000, { variantKey: 'bbbb22' }),
          withClip(30000, { variantKey: 'cccc22', expired: true }),
          stillOnly({ variantKey: 'dddd22' }),
          variant({ variantKey: 'eeee22' }),
        ])}
      />,
    )
    expect(text(markup)).toContain('It includes 2 videos. Watch each one before you sign off.')
  })
})

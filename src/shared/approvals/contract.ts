// The approvals service's request and reply shapes (spec/approvals-service.md "The shared
// contract"). The service keeps a byte-equal copy at approvals-service/src/contract.ts; a change
// is made here and copied in the same commit. Constants and schemas only.
import { z } from 'zod'

export const CONTRACT_VERSION = 1
export const SERVICE_NAME = 'adman-approvals'
export const GALLERY_MAX = 500

// The ID rules repeat the app's formats (spec/data-model.md "ID formats").
export const ProjectId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
export const CampaignId = z.string().regex(/^[a-z0-9-]{1,40}-[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)
export const VariantKey = z.string().regex(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)
export const Slug = z.string().regex(/^[0-9A-Za-z]{12}$/)
export const SignoffId = z.string().regex(/^[0-9A-Za-z]{24}$/)

// Text a visitor's page shows: trimmed, then 1 to max, with no control or format character
// (Cc, Cf: no direction-changing marks).
export const shownText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\p{Cc}\p{Cf}]*$/u)

export const CampaignName = shownText(200)
export const Title = shownText(200)
export const SizeLine = shownText(100)

export const Password = z
  .string()
  .min(12)
  .max(128)
  .regex(/^\P{Cc}*$/u)

// ASCII only, so no look-alike letters or direction marks reach a page (A-99).
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[a-z0-9.!#$%&'*+/=?^_{}~-]{1,64}@[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/)

export const Version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

// The host rule is checked in the service (checkPictureUrl), not here.
export const PictureUrl = z.url().max(2048)

export const Time = z.iso.datetime({ precision: 3 })

// Request bodies refuse unknown keys.
export const CreateLink = z.strictObject({
  projectId: ProjectId,
  campaignId: CampaignId,
  campaignName: CampaignName,
  password: Password,
})

export const NewPassword = z.strictObject({ password: Password })

export const GalleryVariant = z.strictObject({
  variantKey: VariantKey,
  title: Title,
  sizeLine: SizeLine,
  version: Version,
  pictureUrl: PictureUrl,
  pictureExpiresAt: Time,
})

export const Gallery = z.strictObject({
  campaignName: CampaignName,
  variants: z
    .array(GalleryVariant)
    .max(GALLERY_MAX)
    .refine((list) => new Set(list.map((v) => v.variantKey)).size === list.length, {
      message: 'Each variant may appear once.',
    }),
})

export const PictureRenewal = z.strictObject({
  variantKey: VariantKey,
  version: Version,
  pictureUrl: PictureUrl,
  pictureExpiresAt: Time,
})

export const PictureRenewals = z.strictObject({
  pictures: z.array(PictureRenewal).min(1).max(GALLERY_MAX),
})

// Replies.
export const HealthReply = z.object({
  service: z.literal(SERVICE_NAME),
  contract: z.number().int(),
})

export const CreatedLink = z.object({ slug: Slug })

export const GalleryReply = z.object({ variants: z.number().int().min(0) })

export const RenewedReply = z.object({ renewed: z.number().int().min(0) })

export const EmptyReply = z.object({})

export const LinkState = z.object({
  slug: Slug,
  campaignName: CampaignName,
  createdAt: Time,
  variants: z.array(z.object({ variantKey: VariantKey, version: Version, pictureExpiresAt: Time })),
  signoffs: z.array(
    z.object({
      id: SignoffId,
      variantKey: VariantKey,
      version: Version,
      email: Email,
      signedAt: Time,
    }),
  ),
})

export const ERROR_CODES = [
  'bad_request',
  'not_set_up',
  'bad_key',
  'too_large',
  'invalid_input',
  'not_found',
  'link_exists',
  'internal',
] as const

export const ErrorCode = z.enum(ERROR_CODES)

export const ErrorBody = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
})

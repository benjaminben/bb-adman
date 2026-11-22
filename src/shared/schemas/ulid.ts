// The ULID form (spec/data-model.md "ID formats"): 26 Crockford base-32 capitals.
import { z } from 'zod'

export const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/
export const Ulid = z.string().regex(ULID)

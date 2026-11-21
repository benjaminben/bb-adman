import { z } from 'zod'

// comfy.setAddress (SPEC 4.2): the address as typed, or null to remove it.
export const comfySetAddressInput = z.object({ address: z.string().nullable() })

// phase-07 "fal.ai Seedance", "Two origins" (A-170): the only places a fal request may go.
// The key is sent to the queue origin only; the media hosts get no key and no other header.

export const FAL_QUEUE_ORIGIN = 'https://queue.fal.run'

// Matched against the host of an https address with no port and no user part.
export const FAL_MEDIA_HOST = /^([a-z0-9-]+\.)*fal\.media$/

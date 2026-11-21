// SPEC 6 "Plain messages" [REQ: FR-069]: one sentence per error kind, naming the provider.
// The one copy of the table in the code. The raw provider text never reaches the window.
// SPEC 14 1.41 TP-0: kept in src/shared so the window can show a failed job's sentence.
// Sentences only: nothing here may read keys, addresses or main-process modules.
import type { ProviderErrorKind, ProviderErrorReason } from '@/shared/schemas/queries/app'
import type { ComfyCheckOutcome } from '@/shared/schemas/commands/comfy-check'

const MESSAGES: Record<ProviderErrorKind, (p: string) => string> = {
  bad_key: (p) => `${p} did not accept your key. Check it in Settings and try again.`,
  quota: (p) =>
    `Your ${p} account has reached its limit. Check your plan with ${p}, then try again.`,
  refused: (p) =>
    `${p} declined this request because of its content rules. Change the prompt or the images and try again.`,
  timeout: (p) => `${p} took too long to answer. Try again.`,
  offline: (p) => `The app could not reach ${p}. Check your internet connection and try again.`,
  other: (p) => `${p} could not finish this request. Try again.`,
}

export function plainMessage(kind: ProviderErrorKind, providerLabel: string): string {
  return MESSAGES[kind](providerLabel)
}

// [1.41] CU-4: the sentence for each reason of SPEC 6.10.9, the one copy. `{address}` and
// `{n}` are marks the window fills; no sentence here holds an address.
const REASONS: Record<ProviderErrorReason, string> = {
  address_needed: "Enter your ComfyUI server's address to use it.",
  no_answer:
    'Nothing answered at {address}. Check that ComfyUI is running and the address is right.',
  not_comfyui: 'Something answered at {address}, but it is not a ComfyUI server.',
  sign_in_needed:
    'The server at {address} asked for a sign-in. Adman can only use ComfyUI servers without one.',
  redirect_refused:
    'The server tried to send Adman to another address. Adman did not follow, and the run was stopped.',
  certificate: "Adman could not check the server's security certificate.",
  address_refused: 'Adman cannot use that address.',
  missing_items:
    'The server is missing {n} thing(s) this workflow needs. Add them to the server yourself, then try again.',
  server_refused: 'The ComfyUI server did not accept this request.',
  out_of_memory:
    'The ComfyUI server ran out of memory. Try a smaller size or a shorter clip, or free memory on the server.',
  run_failed: 'The ComfyUI server could not finish this run.',
  server_stopped: 'The ComfyUI server stopped or lost this run.',
  lost_contact:
    'Adman lost contact with the ComfyUI server. The server may still be working on this run.',
  too_long: 'This run took longer than Adman waits. The server may still be working on it.',
  address_changed: 'The ComfyUI address was changed while this run was going. The run was stopped.',
  bad_result: 'The ComfyUI server sent a result Adman cannot use.',
  clip_has_sound: 'The server made a clip with sound. Adman stores silent clips only.',
  // P4-1 (spec/ai-jobs.md, OI-68): local failure causes. `{provider}` is the registry label.
  key_missing:
    'Your {provider} key was removed after this run was queued. Add it in Settings, then try again.',
  picture_missing:
    'A picture this run uses can no longer be found. Find it again from the project page, then try again.',
  picture_too_large:
    'A picture this run uses is now larger than 32 MB. Choose a smaller picture, then try again.',
  picture_changed:
    'A picture this run uses has changed and can no longer be sent. Choose another picture, then try again.',
  assets_folder_missing:
    "The project's assets folder could not be found, so the results were not saved. Choose the assets folder again from the project page, then try again.",
  assets_not_writable:
    "The results could not be saved in the project's assets folder. Check that the folder can be written to, then try again.",
  results_not_added: 'The results were made but could not be added to the project. Try again.',
  target_gone: 'The layer or variant this run was for has been deleted.',
}

export function reasonMessage(reason: ProviderErrorReason): string {
  return REASONS[reason]
}

// S2-1 [F-12]: the six Settings check sentences. No run is going during a check, so the
// Settings form of redirect_refused stops after "did not follow".
const CHECK_SENTENCES: Record<Exclude<ComfyCheckOutcome, 'ok'>, string> = {
  no_answer: REASONS.no_answer,
  not_comfyui: REASONS.not_comfyui,
  sign_in_needed: REASONS.sign_in_needed,
  redirect_refused: 'The server tried to send Adman to another address. Adman did not follow.',
  certificate: REASONS.certificate,
  address_refused: REASONS.address_refused,
}

export function checkMessage(outcome: Exclude<ComfyCheckOutcome, 'ok'>): string {
  return CHECK_SENTENCES[outcome]
}

// S2-1: fills a sentence's {address} and {n} marks. An unknown address reads "the saved
// address" and an unknown count "some", so the sentence stays readable. P4-5 (OI-68):
// {provider} is the registry label; without one it reads "provider".
export function fillMarks(
  text: string,
  values: { address?: string; n?: number; provider?: string },
): string {
  const address = values.address ?? 'the saved address'
  const n = values.n === undefined ? 'some' : String(values.n)
  const provider = values.provider ?? 'provider'
  return text
    .replaceAll('{address}', address)
    .replaceAll('{n}', n)
    .replaceAll('{provider}', provider)
}

// S2-1 [D-088]: the refusal of a run whose workflow needs a licence not yet confirmed (S2-4).
export function licenceNotConfirmedMessage(model: string): string {
  return `${model} requires a commercial license. Confirm that you have one first.`
}

// SPEC 4.2 "Not offered" and 1.46 part B: the refusals of a ComfyUI run made before a job row.
export const COMFY_JOB_NOT_OFFERED_MESSAGE = 'ComfyUI cannot make this kind of picture yet.'

export function tooManyReferencesMessage(max: number): string {
  if (max === 1) return 'ComfyUI takes one reference picture for this run.'
  return `ComfyUI takes at most ${max} reference pictures for this run.`
}

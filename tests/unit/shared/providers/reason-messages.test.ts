import { describe, it, expect } from 'vitest'
import { reasonMessage } from '../../../../src/shared/providers/messages'
import { PROVIDER_ERROR_REASONS } from '../../../../src/shared/schemas/queries/app'
import { COMFY_ADDRESS_NEEDED_MESSAGE } from '../../../../src/main/commands/comfy/check'

describe('reasonMessage: the sentence of each 6.10.9 reason [SPEC 6.10.9, 14 1.41 CU-4]', () => {
  it.each([
    ['address_needed', "Enter your ComfyUI server's address to use it."],
    [
      'no_answer',
      'Nothing answered at {address}. Check that ComfyUI is running and the address is right.',
    ],
    ['not_comfyui', 'Something answered at {address}, but it is not a ComfyUI server.'],
    [
      'sign_in_needed',
      'The server at {address} asked for a sign-in. Adman can only use ComfyUI servers without one.',
    ],
    [
      'redirect_refused',
      'The server tried to send Adman to another address. Adman did not follow, and the run was stopped.',
    ],
    ['certificate', "Adman could not check the server's security certificate."],
    ['address_refused', 'Adman cannot use that address.'],
    [
      'missing_items',
      'The server is missing {n} thing(s) this workflow needs. Add them to the server yourself, then try again.',
    ],
    ['server_refused', 'The ComfyUI server did not accept this request.'],
    [
      'out_of_memory',
      'The ComfyUI server ran out of memory. Try a smaller size or a shorter clip, or free memory on the server.',
    ],
    ['run_failed', 'The ComfyUI server could not finish this run.'],
    ['server_stopped', 'The ComfyUI server stopped or lost this run.'],
    [
      'lost_contact',
      'Adman lost contact with the ComfyUI server. The server may still be working on this run.',
    ],
    ['too_long', 'This run took longer than Adman waits. The server may still be working on it.'],
    [
      'address_changed',
      'The ComfyUI address was changed while this run was going. The run was stopped.',
    ],
    ['bad_result', 'The ComfyUI server sent a result Adman cannot use.'],
    ['clip_has_sound', 'The server made a clip with sound. Adman stores silent clips only.'],
  ] as const)('%s', (reason, sentence) => {
    expect(reasonMessage(reason)).toBe(sentence)
  })

  it('has a sentence for every reason', () => {
    for (const reason of PROVIDER_ERROR_REASONS) expect(reasonMessage(reason)).not.toBe('')
  })

  it('is the one copy of the address_needed sentence comfy.check uses [CU-3 DV-5]', () => {
    expect(COMFY_ADDRESS_NEEDED_MESSAGE).toBe(reasonMessage('address_needed'))
  })
})

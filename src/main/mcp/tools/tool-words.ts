// The tool words more than one tool carries (spec/phases/phase-10.md, A-247). Every run tool and
// every tool that can put an asset on a layer carries LEAVE_THE_CHOICE [D-059 item 5].
import { comfyModels, registryModel } from './model-words'

export const LEAVE_THE_CHOICE =
  'A run you start makes options for the user to choose from. Leave the choice to the user ' +
  'unless they asked you to choose.'

// R3-2: each provider's words name the model it uses (model-words.ts).
export const PROVIDER_WORDS =
  `provider is "comfyui" (the user's own ComfyUI server, no charge; the model is the one its ` +
  `workflow uses: ${comfyModels(['image', 'image_refs'])} for pictures, ` +
  `${comfyModels(['video'])} for videos) or "gemini" (pictures with ` +
  `${registryModel('gemini', 'image')}, not videos; paid, charged to the user's Google account ` +
  'with no click). Runs are refused unless the user allowed agents for that provider in ' +
  "Adman's Settings."

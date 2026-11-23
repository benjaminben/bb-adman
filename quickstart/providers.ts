// The quickstart's providers: the app's own Gemini or fake adapters, given the key and the
// models from the command line in place of the app's Settings and saved secrets.
import { adapters as fake } from '@/main/providers/fake'
import { FAKE_IMAGE_MODEL } from '@/main/providers/fake/image'
import { adapters as gemini } from '@/main/providers/gemini'
import { listProviders } from '@/main/providers/registry'
import type {
  AdapterContext,
  ImageProvider,
  LayoutProvider,
  TextProvider,
} from '@/main/providers/types'
import type { Args } from './args'

export type Providers = {
  image: ImageProvider
  layout: LayoutProvider
  text: TextProvider
  models: { image: string; text: string }
}

const FAKE_TEXT_MODEL = 'fake-text'

// The app's default model for a Gemini job, from the registry that owns the model IDs.
function geminiDefault(job: 'image' | 'layout' | 'text'): string {
  const info = listProviders({}).find((provider) => provider.id === 'gemini')
  return info?.defaultModels[job] ?? ''
}

export function providersFor(args: Args): Providers {
  if (args.provider === 'fake') {
    const { image, layout, text } = fake
    if (!image || !layout || !text) throw new Error('The fake provider is incomplete.')
    const ctx = {} as AdapterContext
    return {
      image: image(ctx),
      layout: layout(ctx),
      text: text(ctx),
      models: { image: FAKE_IMAGE_MODEL, text: FAKE_TEXT_MODEL },
    }
  }
  const models = {
    image: args.model ?? geminiDefault('image'),
    text: args.textModel ?? geminiDefault('text'),
  }
  const ctx: AdapterContext = {
    secret: () => args.key ?? '',
    settings: () => {
      throw new Error('The quickstart has no settings.')
    },
    model: (job) => (job === 'image' ? models.image : models.text),
  }
  const { image, layout, text } = gemini
  if (!image || !layout || !text) throw new Error('The Gemini provider is incomplete.')
  return { image: image(ctx), layout: layout(ctx), text: text(ctx), models }
}

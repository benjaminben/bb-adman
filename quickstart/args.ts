// The quickstart's command-line options. Pure: reads the given list and environment only.
// A value is written `--name=value` or `--name value`; `_` and `-` in a name mean the same.

export const PROVIDER_IDS = ['gemini', 'fake'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export type Args = {
  provider: ProviderId
  // The picture model and the model for text placement and translation; null = the app's own.
  model: string | null
  textModel: string | null
  key: string | null
  brief: string | null
  out: string | null
  prompt: string | null
  help: boolean
}

export type ArgsResult = { ok: true; args: Args } | { ok: false; message: string }

const VALUE_NAMES = [
  'provider',
  'model',
  'text-model',
  'gemini-api-key',
  'brief',
  'out',
  'prompt',
] as const
type ValueName = (typeof VALUE_NAMES)[number]

export const USAGE = [
  'Usage: npm run quickstart -- --provider=gemini --gemini_api_key=<key> [options]',
  '',
  '  --provider=gemini|fake   gemini makes real pictures; fake is free and draws grey ones',
  '  --gemini_api_key=<key>   or set GEMINI_API_KEY',
  "  --model=<id>             the picture model (default: the app's own)",
  "  --text_model=<id>        the model that places text and translates (default: the app's own)",
  '  --brief=<file>           a YAML or JSON brief (default: quickstart/brief.yaml)',
  '  --out=<folder>           where the ads are written (default: quickstart/output)',
  '  --prompt="<words>"       the picture prompt, in place of the one built from the brief',
].join('\n')

const isValueName = (name: string): name is ValueName => VALUE_NAMES.some((known) => known === name)

function fail(message: string): ArgsResult {
  return { ok: false, message: `${message}\n\n${USAGE}` }
}

// One pass over the list: each known name with its value, or the sentence that refuses it.
function readValues(argv: readonly string[]): Map<ValueName | 'help', string> | string {
  const values = new Map<ValueName | 'help', string>()
  for (let i = 0; i < argv.length; i += 1) {
    const word = argv[i] ?? ''
    if (word === '--help' || word === '-h') {
      values.set('help', 'yes')
      continue
    }
    if (!word.startsWith('--')) return `"${word}" is not an option.`
    const equals = word.indexOf('=')
    const name = (equals < 0 ? word.slice(2) : word.slice(2, equals)).replaceAll('_', '-')
    if (!isValueName(name)) return `"--${name}" is not an option.`
    const value = equals < 0 ? argv[i + 1] : word.slice(equals + 1)
    if (equals < 0) i += 1
    if (value === undefined || value.trim() === '') return `"--${name}" needs a value.`
    values.set(name, value.trim())
  }
  return values
}

type Env = Readonly<Record<string, string | undefined>>

// Some shells (PowerShell with some npm versions) drop the `--` after `npm run quickstart`, so
// npm keeps the options for itself. npm still hands each one on as `npm_config_<name>`; an
// option missing from the list is read from there.
function addFromNpm(values: Map<ValueName | 'help', string>, env: Env): void {
  for (const name of VALUE_NAMES) {
    const value = env[`npm_config_${name.replaceAll('-', '_')}`]?.trim()
    if (!values.has(name) && value) values.set(name, value)
  }
}

export function parseArgs(argv: readonly string[], env: Env): ArgsResult {
  const values = readValues(argv)
  if (typeof values === 'string') return fail(values)
  addFromNpm(values, env)
  const provider = values.get('provider') ?? 'gemini'
  const known = PROVIDER_IDS.find((id) => id === provider)
  if (!known) return fail(`"${provider}" is not a provider. Use gemini or fake.`)
  const key = values.get('gemini-api-key') ?? env.GEMINI_API_KEY?.trim() ?? null
  const help = values.has('help')
  if (!help && known === 'gemini' && !key) {
    return fail('Gemini needs a key: add --gemini_api_key=<key> or set GEMINI_API_KEY.')
  }
  return {
    ok: true,
    args: {
      provider: known,
      model: values.get('model') ?? null,
      textModel: values.get('text-model') ?? null,
      key: key || null,
      brief: values.get('brief') ?? null,
      out: values.get('out') ?? null,
      prompt: values.get('prompt') ?? null,
      help,
    },
  }
}

import { describe, expect, it } from 'vitest'
import { parseArgs } from '../../../quickstart/args'

const read = (argv: string[], env: Record<string, string | undefined> = {}) => parseArgs(argv, env)

describe('quickstart parseArgs', () => {
  it('reads the documented command', () => {
    const result = read(['--provider=gemini', '--model=some-model', '--gemini_api_key=abc'])
    expect(result).toMatchObject({
      ok: true,
      args: { provider: 'gemini', model: 'some-model', key: 'abc', help: false },
    })
  })

  it('takes a value after a space, and a dash for an underscore', () => {
    const result = read(['--provider', 'fake', '--text-model', 'm', '--out', 'somewhere'])
    expect(result).toMatchObject({
      ok: true,
      args: { provider: 'fake', textModel: 'm', out: 'somewhere', key: null },
    })
  })

  it('defaults to gemini and takes the key from GEMINI_API_KEY', () => {
    const result = read([], { GEMINI_API_KEY: ' from-env ' })
    expect(result).toMatchObject({ ok: true, args: { provider: 'gemini', key: 'from-env' } })
  })

  it('prefers the key on the command line to the environment', () => {
    const result = read(['--gemini_api_key=typed'], { GEMINI_API_KEY: 'from-env' })
    expect(result).toMatchObject({ ok: true, args: { key: 'typed' } })
  })

  it('refuses gemini with no key, and never for fake', () => {
    const refused = read(['--provider=gemini'])
    expect(refused.ok).toBe(false)
    expect(!refused.ok && refused.message).toContain('Gemini needs a key')
    expect(read(['--provider=fake']).ok).toBe(true)
  })

  it('refuses an unknown provider, an unknown option and an option with no value', () => {
    expect(read(['--provider=other']).ok).toBe(false)
    expect(read(['--provider=fake', '--colour=red']).ok).toBe(false)
    expect(read(['--provider=fake', 'stray']).ok).toBe(false)
    expect(read(['--provider=fake', '--brief']).ok).toBe(false)
    expect(read(['--provider=fake', '--brief=']).ok).toBe(false)
  })

  it('a refusal never repeats a key that was typed', () => {
    const refused = read(['--gemini_api_key=secret-key', '--provider=other'])
    expect(refused.ok).toBe(false)
    expect(!refused.ok && refused.message).not.toContain('secret-key')
  })

  it('asks for help without needing a key', () => {
    expect(read(['--help'])).toMatchObject({ ok: true, args: { help: true } })
  })

  it('reads an option npm kept for itself when the shell dropped the "--"', () => {
    const env = { npm_config_provider: 'fake', npm_config_text_model: 'm', npm_config_brief: 'b' }
    expect(read([], env)).toMatchObject({
      ok: true,
      args: { provider: 'fake', textModel: 'm', brief: 'b' },
    })
    expect(read(['--provider=gemini', '--gemini_api_key=k'], env)).toMatchObject({
      ok: true,
      args: { provider: 'gemini' },
    })
  })
})

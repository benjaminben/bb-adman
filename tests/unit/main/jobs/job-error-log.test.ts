import { describe, it, expect } from 'vitest'
import { jobErrorContext } from '../../../../src/main/jobs/job-error-log'

// Made up for the test; not the shape of any real key.
const SECRET = 'not/a real+secret=1'
const forms = [SECRET, encodeURIComponent(SECRET), Buffer.from(SECRET).toString('base64')]

function errorWith(message: string): Error {
  const e = new Error(message)
  e.stack = `Error: ${message}\n    at run (/app/a.js:1:2)\n    at next (/app/b.js:3:4)`
  return e
}

describe('the log line of an unforeseen job error [SPEC 9.1 1.38, 14 1.38 Y9]', () => {
  it.each(forms)('removes a secret from the message and the stack, in the form %s', (form) => {
    const c = jobErrorContext(errorWith(`bad ${form} here`), [SECRET], false)
    expect(c.name).toBe('Error')
    expect(c.message).toBe('bad [key removed] here')
    expect(JSON.stringify(c)).not.toContain(form)
  })

  it('keeps only the frame lines of the stack', () => {
    const e = errorWith('first line\nsecond line of the message')
    const c = jobErrorContext(e, [], false)
    expect(c.stack).toBe('    at run (/app/a.js:1:2)\n    at next (/app/b.js:3:4)')
  })

  it('logs no message when the provider may put server text in it', () => {
    const c = jobErrorContext(errorWith('MARKER 10.1.2.3:8188'), [], true)
    expect(c.message).toBeNull()
    expect(JSON.stringify(c)).not.toContain('MARKER')
    expect(JSON.stringify(c)).not.toContain('10.1.2.3')
  })

  it('gives the type of a thrown value that is not an Error, and no stack', () => {
    expect(jobErrorContext('oops', [], false)).toMatchObject({ name: 'string', stack: null })
    expect(jobErrorContext({ a: 1 }, [], true)).toEqual({
      name: 'object',
      message: null,
      stack: null,
    })
  })
})

// A message whose second line looks like a call frame.
const TRICK = 'it broke\n    at http://10.1.2.3:8188/x (MARKER:1:2)'
const hasFrame = (stack: string | null) => /^\s*at /m.test(stack ?? '')

describe('the header is cut off the stack first [SPEC 9.1 1.40, 14 1.40 AA1]', () => {
  it('keeps no line of the message as a frame, for a provider whose message is not logged', () => {
    const c = jobErrorContext(new Error(TRICK), [], true)
    expect(c.stack).not.toContain('MARKER')
    expect(c.stack).not.toContain('10.1.2.3')
    expect(hasFrame(c.stack)).toBe(true)
  })

  it('does the same after the error was renamed', () => {
    const e = new Error(TRICK)
    e.name = 'RenamedError'
    const c = jobErrorContext(e, [], true)
    expect(c.name).toBe('RenamedError')
    expect(c.stack).not.toContain('MARKER')
    expect(c.stack).not.toContain('10.1.2.3')
    expect(hasFrame(c.stack)).toBe(true)
  })

  it('keeps no message line in the stack when the message is logged', () => {
    const c = jobErrorContext(new Error(TRICK), [], false)
    expect(c.stack).not.toContain('MARKER')
    expect(c.message).toContain('MARKER')
    expect(hasFrame(c.stack)).toBe(true)
  })

  it('gives no stack when the message was changed and is not logged', () => {
    const e = new Error('first words')
    // The engine writes the stack text when it is first read; read it before the change.
    expect(e.stack).toContain('first words')
    e.message = TRICK
    expect(jobErrorContext(e, [], true).stack).toBeNull()
  })

  it('keeps the redacted frames when the message was changed and is logged', () => {
    const e = new Error('first words')
    e.stack = `${e.stack}\n    at run (/app/${SECRET}.js:1:2)`
    e.message = 'other words'
    const c = jobErrorContext(e, [SECRET], false)
    expect(c.stack).toContain('    at run (/app/[key removed].js:1:2)')
    expect(c.stack).not.toContain(SECRET)
    expect(c.stack?.split('\n').every((line) => line.trimStart().startsWith('at '))).toBe(true)
  })

  it('keeps the frames of an error with an empty message', () => {
    const c = jobErrorContext(new Error(''), [], false)
    expect(hasFrame(c.stack)).toBe(true)
    expect(c.stack?.split('\n').every((line) => line.trimStart().startsWith('at '))).toBe(true)
  })
})

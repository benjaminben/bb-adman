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

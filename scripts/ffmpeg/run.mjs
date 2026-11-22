// Runs one program by its absolute path with an argument array: no shell, no PATH lookup.
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import path from 'node:path'

const MAX_STDOUT = 16 * 1024 * 1024

/**
 * @param {string} command absolute path of the program
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string>, show?: boolean }} [options]
 *   `show` sends the program's output to this terminal instead of collecting it.
 * @returns {Promise<{ code: number, stdout: string }>}
 */
export function run(command, args, options = {}) {
  if (!path.isAbsolute(command)) {
    return Promise.reject(new Error(`Refusing to run "${command}": the path must be absolute.`))
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      cwd: options.cwd,
      env: options.env ?? {},
      stdio: options.show ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'inherit'],
    })
    const chunks = []
    let size = 0
    child.stdout?.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_STDOUT) {
        child.kill()
        reject(new Error(`${path.basename(command)} printed more than expected.`))
        return
      }
      chunks.push(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout: Buffer.concat(chunks).toString('utf8') })
    })
  })
}

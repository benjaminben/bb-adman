// The one place the app starts FFmpeg (spec/phases/phase-07.md, "How FFmpeg is run").
// Security: the binary is the fixed path of ffmpeg-path.ts, checked by lstat before each run; the
// arguments are an array from a builder (embed-args.ts, export/video/), with no shell; the child
// gets an empty environment and the run folder as its working folder. Standard error is read so
// the pipe never fills and dropped as it arrives (nothing kept, inside the 64 KiB cap): it is
// never logged, shown or returned, since it can hold paths. One run at a time; a run over the
// time limit is killed, and the next run starts only once it has ended.
// P8-16: a run may also be fed on standard input (the export's frames, read as pipe:0), hand its
// standard output to the caller (the report still, pipe:1), be stopped by a signal, and have its
// own time limit. Without those options a run is exactly as before.
// P8-17: a start that throws at once gives null, and the queue goes on to the next run.
import { spawn, type ChildProcess } from 'node:child_process'
import type { Writable } from 'node:stream'
import { binaryUsable } from './ffmpeg-path'

const TIME_LIMIT_MS = 60_000

export type FfmpegFeed = (child: { stdin: Writable; kill(): void }) => Promise<void>

export type RunOptions = {
  // This run's time limit, in place of the runner's.
  timeoutMs?: number
  // Writes standard input; it must respect back-pressure. A rejection kills the program.
  feed?: FfmpegFeed
  // Gets standard output as it arrives.
  output?: (chunk: Buffer) => void
  // Kills the program when aborted; an aborted signal starts nothing.
  signal?: AbortSignal
}

export type FfmpegRunner = {
  // 'done' on a clean exit; null when the run could not start, failed or was killed.
  run(args: string[], runFolder: string, options?: RunOptions): Promise<'done' | null>
}

function runOnce(
  binary: string,
  args: string[],
  runFolder: string,
  timeoutMs: number,
  options: RunOptions,
): Promise<'done' | null> {
  const { feed, output, signal } = options
  if (signal?.aborted) return Promise.resolve(null)
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(binary, args, {
        shell: false,
        windowsHide: true,
        stdio: [feed ? 'pipe' : 'ignore', output ? 'pipe' : 'ignore', 'pipe'],
        env: {},
        cwd: runFolder,
      })
    } catch {
      // A start refused at once (a bad argument): nothing ran.
      resolve(null)
      return
    }
    let settled = false
    let killed = false
    const kill = () => {
      killed = true
      child.kill('SIGKILL')
    }
    const finish = (result: 'done' | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', kill)
      resolve(result)
    }
    const timer = setTimeout(kill, timeoutMs)
    signal?.addEventListener('abort', kill)
    child.stderr?.resume()
    if (output) child.stdout?.on('data', output)
    child.on('error', () => finish(null))
    child.on('close', (code) => finish(code === 0 && !killed ? 'done' : null))
    if (feed && child.stdin) {
      // A program that ends early breaks the pipe; the feed sees it, nothing goes unhandled.
      child.stdin.on('error', () => undefined)
      feed({ stdin: child.stdin, kill }).catch(kill)
    }
  })
}

export function createFfmpegRunner(opts: { binary: string; timeoutMs?: number }): FfmpegRunner {
  const timeoutMs = opts.timeoutMs ?? TIME_LIMIT_MS
  let queue: Promise<unknown> = Promise.resolve()
  return {
    run(args, runFolder, options = {}) {
      const limit = options.timeoutMs ?? timeoutMs
      const next = queue.then(async () =>
        (await binaryUsable(opts.binary))
          ? runOnce(opts.binary, args, runFolder, limit, options)
          : null,
      )
      // Whatever happens to this run, the next one still starts.
      queue = next.catch(() => null)
      return next
    },
  }
}

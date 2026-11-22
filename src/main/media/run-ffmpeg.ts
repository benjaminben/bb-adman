// The one place the app starts FFmpeg (spec/phases/phase-07.md, "How FFmpeg is run").
// Security: the binary is the fixed path of ffmpeg-path.ts, checked by lstat before each run; the
// arguments are an array from a builder (embed-args.ts), with no shell; the child gets an empty
// environment and the run folder as its working folder. Standard error is read so the pipe never
// fills and dropped as it arrives (nothing kept, inside the 64 KiB cap): it is never logged, shown
// or returned, since it can hold paths. One run at a time; a run over the time limit is killed,
// and the next run starts only once it has ended.
import { spawn } from 'node:child_process'
import { binaryUsable } from './ffmpeg-path'

const TIME_LIMIT_MS = 60_000

export type FfmpegRunner = {
  // 'done' on a clean exit; null when the run could not start, failed or was killed.
  run(args: string[], runFolder: string): Promise<'done' | null>
}

function runOnce(
  binary: string,
  args: string[],
  runFolder: string,
  timeoutMs: number,
): Promise<'done' | null> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {},
      cwd: runFolder,
    })
    let settled = false
    let killed = false
    const finish = (result: 'done' | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.stderr?.resume()
    child.on('error', () => finish(null))
    child.on('close', (code) => finish(code === 0 && !killed ? 'done' : null))
  })
}

export function createFfmpegRunner(opts: { binary: string; timeoutMs?: number }): FfmpegRunner {
  const timeoutMs = opts.timeoutMs ?? TIME_LIMIT_MS
  let queue: Promise<unknown> = Promise.resolve()
  return {
    run(args, runFolder) {
      const next = queue.then(async () =>
        (await binaryUsable(opts.binary)) ? runOnce(opts.binary, args, runFolder, timeoutMs) : null,
      )
      queue = next
      return next
    },
  }
}

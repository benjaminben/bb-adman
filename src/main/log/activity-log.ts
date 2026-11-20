// JSON lines activity log (SPEC 9.1, FR-153). Nothing is sent anywhere.
// Callers must never pass secret values; the bus logs command names, not inputs.
import fs from 'node:fs'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogEvent = 'command' | 'query' | 'job' | 'provider' | 'mcp' | 'asset' | 'app'
export type LogActor = 'user' | 'agent' | 'system'

export type LogEntry = {
  timestamp: string
  level: LogLevel
  event: LogEvent
  name: string
  actor: LogActor
  agentClient: string | null
  projectId: string | null
  campaignId: string | null
  variantId: string | null
  jobId: string | null
  ok: boolean
  errorKind: string | null
  message: string
  context: Record<string, unknown>
}

export type LogInput = Pick<LogEntry, 'level' | 'event' | 'name' | 'actor' | 'ok' | 'message'> &
  Partial<Omit<LogEntry, 'timestamp'>>

export type ActivityLog = { write(entry: LogInput): void; prune(): void }

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const KEEP_DAYS = 30
const FILE_PATTERN = /^activity-(\d{4}-\d{2}-\d{2})\.jsonl$/

export function parseLogLevel(value: string | undefined): LogLevel {
  return LEVELS.includes(value as LogLevel) ? (value as LogLevel) : 'info'
}

export function createActivityLog(opts: {
  dir: string
  minLevel: LogLevel
  now: () => Date
}): ActivityLog {
  const min = LEVELS.indexOf(opts.minLevel)

  return {
    write(input) {
      if (LEVELS.indexOf(input.level) < min) return
      const timestamp = opts.now().toISOString()
      const entry: LogEntry = {
        timestamp,
        level: input.level,
        event: input.event,
        name: input.name,
        actor: input.actor,
        agentClient: input.agentClient ?? null,
        projectId: input.projectId ?? null,
        campaignId: input.campaignId ?? null,
        variantId: input.variantId ?? null,
        jobId: input.jobId ?? null,
        ok: input.ok,
        errorKind: input.errorKind ?? null,
        message: input.message,
        context: input.context ?? {},
      }
      fs.mkdirSync(opts.dir, { recursive: true })
      const file = path.join(opts.dir, `activity-${timestamp.slice(0, 10)}.jsonl`)
      fs.appendFileSync(file, JSON.stringify(entry) + '\n')
    },

    prune() {
      if (!fs.existsSync(opts.dir)) return
      const cutoff = new Date(opts.now().getTime() - KEEP_DAYS * 86_400_000)
      const cutoffDay = cutoff.toISOString().slice(0, 10)
      for (const name of fs.readdirSync(opts.dir)) {
        const day = FILE_PATTERN.exec(name)?.[1]
        if (day !== undefined && day < cutoffDay) fs.rmSync(path.join(opts.dir, name))
      }
    },
  }
}

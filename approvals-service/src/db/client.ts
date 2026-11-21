import 'server-only'
import { createClient, type Client, type ResultSet } from '@libsql/client'

// spec/approvals-service.md "The Db interface": the same shape as the database calls the
// reviewed query files make. Rows leave this file only as plain objects of column name to value,
// so no libSQL type is seen anywhere else.

export type Value = string | number | null
export type RunResult = { meta: { changes: number } }

type Plain = Record<string, unknown>

// The type defaults are D1's: a whole row is an object, one column's value is unknown.
export interface Statement {
  bind(...values: Value[]): Statement
  first<T = Plain>(): Promise<T | null>
  first<T = unknown>(column: string): Promise<T | null>
  all<T = Plain>(): Promise<{ results: T[] }>
  run(): Promise<RunResult>
}

export interface Db {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<RunResult[]>
}

function plainRows(result: ResultSet): Plain[] {
  return result.rows.map((row) => {
    const plain: Plain = {}
    result.columns.forEach((name, i) => {
      plain[name] = row[i]
    })
    return plain
  })
}

function runResult(result: ResultSet): RunResult {
  return { meta: { changes: result.rowsAffected } }
}

class LibsqlStatement implements Statement {
  constructor(
    readonly owner: Client,
    readonly sql: string,
    readonly args: readonly Value[],
  ) {}

  bind(...values: Value[]): Statement {
    return new LibsqlStatement(this.owner, this.sql, values)
  }

  private execute(): Promise<ResultSet> {
    return this.owner.execute({ sql: this.sql, args: [...this.args] })
  }

  first<T = Plain>(): Promise<T | null>
  first<T = unknown>(column: string): Promise<T | null>
  async first<T>(column?: string): Promise<T | null> {
    const row = plainRows(await this.execute())[0]
    if (row === undefined) return null
    return (column === undefined ? row : (row[column] ?? null)) as T
  }

  async all<T = Plain>(): Promise<{ results: T[] }> {
    return { results: plainRows(await this.execute()) as T[] }
  }

  async run(): Promise<RunResult> {
    return runResult(await this.execute())
  }
}

// A batch is one write transaction: a failing statement rolls every statement back.
export function createDb(client: Client): Db {
  return {
    prepare: (sql) => new LibsqlStatement(client, sql, []),
    async batch(statements) {
      const own = statements.map((statement) => {
        if (!(statement instanceof LibsqlStatement) || statement.owner !== client) {
          throw new Error('statement from another database')
        }
        return { sql: statement.sql, args: [...statement.args] }
      })
      return (await client.batch(own, 'write')).map(runResult)
    },
  }
}

// Every stored whole number is under 2^53, so `number` is exact.
export function openDb(url: string, authToken?: string): Db {
  return createDb(createClient({ url, authToken, intMode: 'number' }))
}

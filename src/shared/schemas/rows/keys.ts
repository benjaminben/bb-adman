// SPEC 4.4 row keys: the one place that names each table's key fields and joins them.
export const ROW_KEYS = {
  project_meta: ['key'],
  subject: ['id'],
  asset: ['id'],
  campaign: ['id'],
  campaign_subject: ['campaignId', 'subjectId'],
  rule_set: ['campaignId'],
  direction: ['id'],
  variant: ['id'],
  variant_subject: ['variantId', 'subjectId'],
  layer: ['id'],
  background_clip: ['id'],
  job: ['id'],
  report: ['id'],
  variant_check: ['variantId'],
} as const satisfies Record<string, readonly string[]>

export type TableName = keyof typeof ROW_KEYS

export function rowKey(table: TableName, row: Record<string, unknown>): string {
  return ROW_KEYS[table]
    .map((field) => {
      const value = row[field]
      if (typeof value !== 'string') throw new Error(`${table} row has no ${field}`)
      return value
    })
    .join('/')
}

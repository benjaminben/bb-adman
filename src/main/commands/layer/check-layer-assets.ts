// spec/editor-commands.md, "Which asset a layer may name": the one check, for every layer
// command that takes values. A picture source must be an image and a font a font, of this
// project and in the asset library. A named asset whose file is missing is accepted; the
// badge shows it.
import type Database from 'better-sqlite3'
import { AppError } from '@/shared/schemas/result'

type Named = { source?: { assetId: string } | null; style?: object }

type Wanted = { kind: 'image' | 'font'; wrongKind: string }

const PICTURE: Wanted = { kind: 'image', wrongKind: 'Choose a picture for a picture layer.' }
const FONT: Wanted = { kind: 'font', wrongKind: 'Choose a font file.' }

function check(db: Database.Database, assetId: string, wanted: Wanted): void {
  const asset = db.prepare('SELECT kind, library FROM asset WHERE id = ?').get(assetId) as
    { kind: string; library: string } | undefined
  if (!asset) throw new AppError('NOT_FOUND', 'That file is not in this project.')
  if (asset.kind !== wanted.kind) throw new AppError('INVALID_INPUT', wanted.wrongKind)
  if (asset.library !== 'asset') {
    throw new AppError(
      'RULE_VIOLATION',
      'This file is in the reference library. Move it to the asset library to use it on a post.',
      { reason: 'reference_library' },
    )
  }
}

export function checkLayerAssets(db: Database.Database, values: Named): void {
  if (values.source) check(db, values.source.assetId, PICTURE)
  const font = values.style && 'fontAssetId' in values.style ? values.style.fontAssetId : null
  if (typeof font === 'string') check(db, font, FONT)
}

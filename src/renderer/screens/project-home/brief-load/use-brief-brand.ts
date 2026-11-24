// A loaded brief's brand files (spec/brief-brand.md, "The brief form", "Loading"; A-396). After
// the photos, each distinct path of brief.parse's brandFiles is copied into the asset library
// with one asset.import, in role order; roles that share a path share its result. A role named
// by asset ID is already in the project, so it is kept with no import and never removed.
// Security: the only paths sent are the reply's brandFiles paths, always with copy: true; no
// path is drawn or kept. If the page goes away meanwhile, the import stops and the new assets
// are removed again at once.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { BrandRole, BriefParsed } from '@/shared/schemas/commands/brief'
import type { BriefFormValues } from '@/renderer/screens/project-home/brief-form-model'
import {
  removedBrandAssets,
  type BriefBrand,
  type FormAsset,
} from '@/renderer/screens/project-home/brief-form-brand'
import { brandFileNoteLine, brandImportNoteLine } from '@/renderer/screens/project-home/brand-notes'
import { removeBrandAssets } from '@/renderer/screens/project-home/brand-fields'
import { removeAddedPhotos } from '@/renderer/screens/project-home/subject-photos'

const ROLES: BrandRole[] = ['logo', 'headingFont', 'bodyFont']

type Imported = { asset: FormAsset | null } | { refused: string }

// Cancel and the page going away: every photo and brand asset the form added (A-111, A-396).
export function dropFormAssets(api: AdmanApi, projectId: string, values: BriefFormValues) {
  removeAddedPhotos(
    api,
    projectId,
    values.subjects.flatMap((s) => s.photos),
  )
  removeBrandAssets(api, projectId, removedBrandAssets(values, ROLES))
}

export function useBriefBrand(projectId: string) {
  const api = useApi()
  const [adding, setAdding] = useState(false)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  async function importOne(path: string): Promise<Imported> {
    const reply = await api.command('asset.import', {
      projectId,
      paths: [path],
      library: 'asset',
      copy: true,
    })
    if (!reply.ok) return { refused: reply.error.message }
    const { assetIds, reusedAssetIds } = reply.data as AssetImportReply
    const assetId = assetIds[0]
    if (assetId === undefined) return { asset: null }
    return { asset: { assetId, added: !reusedAssetIds.includes(assetId) } }
  }

  // The brief's brand files and their notes, or null when the page went away meanwhile.
  async function importBrand(parsed: BriefParsed): Promise<BriefBrand | null> {
    const { files = [], notes = [] } = parsed.brandFiles ?? {}
    const brand: BriefBrand = {
      logo: null,
      headingFont: null,
      bodyFont: null,
      notes: notes.map(brandFileNoteLine),
    }
    const byPath = new Map<string, Imported>()
    const made = new Set<string>()
    setAdding(files.some((f) => f.path !== null))
    for (const { role, path, assetId } of files) {
      if (assetId !== null) brand[role] = { assetId, added: false }
      if (path === null) continue
      let done = byPath.get(path)
      if (done === undefined) {
        done = await importOne(path)
        byPath.set(path, done)
        if ('asset' in done && done.asset?.added) made.add(done.asset.assetId)
        if (!live.current) break
      }
      if ('refused' in done) brand.notes.push(brandImportNoteLine(role, done.refused))
      else brand[role] = done.asset
    }
    if (!live.current) {
      removeBrandAssets(api, projectId, [...made])
      return null
    }
    setAdding(false)
    return brand
  }

  return { adding, importBrand }
}

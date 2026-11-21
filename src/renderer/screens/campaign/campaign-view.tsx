// The campaign page (SPEC 14 1.41 TP-2): the variants from campaign.get, the picture panel
// for the chosen one, and its runs. The master is chosen at the start. One job store per
// open page.
import { useEffect, useState } from 'react'
import { useApi, useApp } from '../../app/app-context'
import { createJobStore } from '../../stores/job-store'
import type { CampaignGet } from '../../../shared/schemas/queries/campaign'
import { GeneratePanel } from './generate-panel'
import { RunList } from './run-list'
import { VariantList } from './variant-list'
import styles from '../screens.module.css'

function useCampaign(projectId: string, campaignId: string): CampaignGet | null {
  const api = useApi()
  const [data, setData] = useState<CampaignGet | null>(null)
  useEffect(() => {
    let live = true
    void api.query('campaign.get', { projectId, campaignId }).then((result) => {
      if (live && result.ok && result.data) setData(result.data as CampaignGet)
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return data
}

export function CampaignView(props: { projectId: string; campaignId: string; onBack: () => void }) {
  const { projectId, campaignId } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const data = useCampaign(projectId, campaignId)
  const [store] = useState(() => createJobStore({ api, command }, projectId))
  const [chosenId, setChosenId] = useState<string | null>(null)
  const variantId = chosenId ?? data?.variants[0]?.id ?? null

  useEffect(() => store.getState().subscribe(), [store])
  useEffect(() => {
    if (variantId !== null) void store.getState().load(variantId)
  }, [store, variantId])

  const variant = data?.variants.find((v) => v.id === variantId)
  return (
    <section className={styles.card} aria-label="Campaign">
      <div className={styles.row}>
        <button type="button" onClick={props.onBack}>
          Back to project
        </button>
      </div>
      {data === null ? (
        <p className={styles.muted}>Loading the campaign…</p>
      ) : (
        <>
          <h2>{data.campaign.name}</h2>
          <VariantList variants={data.variants} chosenId={variantId} onChoose={setChosenId} />
          {variant && (
            <GeneratePanel
              key={variant.id}
              projectId={projectId}
              campaignId={campaignId}
              variantId={variant.id}
              data={data}
              onStarted={(reply) => store.getState().track(reply)}
            />
          )}
          <RunList projectId={projectId} store={store} />
        </>
      )}
    </section>
  )
}

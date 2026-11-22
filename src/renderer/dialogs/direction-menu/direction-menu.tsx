// spec/screens-variants.md, "Direction dialogs", as design wave CAMP-2 (AP-3, AP-8) draws them:
// the More menu "{direction name}" at the end of the direction's header, with "New direction…",
// "Rename…" and "Delete direction…" (danger, last). Each item opens its dialog; none sends
// anything itself. With one direction, "Delete direction…" stays focusable but is marked
// disabled, with the reason "A campaign keeps at least one direction." in its title. The keys
// are the shared MoreMenu's: arrows move and wrap, Escape closes and puts the focus back.
import { useState } from 'react'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import { MoreMenu, type MoreItem } from '@/renderer/ui/more-menu'
import { DeleteDirection } from './delete-direction'
import { NameDialog } from './name-dialog'
import { nextDirectionName } from './next-name'

type Shown = 'new' | 'rename' | 'delete' | null

export const LAST_DIRECTION_HINT = 'A campaign keeps at least one direction.'

export function DirectionMenu({ projectId, campaign, direction }: DirectionControlProps) {
  const [shown, setShown] = useState<Shown>(null)
  const only = campaign.directions.length <= 1
  const items: MoreItem[] = [
    { id: 'new', label: 'New direction…', onChoose: () => setShown('new') },
    { id: 'rename', label: 'Rename…', onChoose: () => setShown('rename') },
    {
      id: 'delete',
      label: 'Delete direction…',
      danger: true,
      ...(only && { disabled: true, reason: LAST_DIRECTION_HINT }),
      onChoose: () => setShown('delete'),
    },
  ]
  const variantCount = campaign.variants.filter((v) => v.directionId === direction.id).length
  const shut = () => setShown(null)
  return (
    <>
      <MoreMenu label={direction.name} items={items} />
      <NameDialog
        open={shown === 'new'}
        title="New direction"
        action="Make direction"
        initialName={nextDirectionName(campaign.directions.map((d) => d.name))}
        command="direction.createFromMaster"
        input={(name) => ({ projectId, masterVariantId: direction.masterVariantId, name })}
        onClose={shut}
      />
      <NameDialog
        open={shown === 'rename'}
        title={`Rename ${direction.name}`}
        action="Rename"
        initialName={direction.name}
        command="direction.rename"
        input={(name) => ({ projectId, directionId: direction.id, name })}
        onClose={shut}
      />
      <DeleteDirection
        open={shown === 'delete'}
        projectId={projectId}
        direction={direction}
        variantCount={variantCount}
        onClose={shut}
      />
    </>
  )
}

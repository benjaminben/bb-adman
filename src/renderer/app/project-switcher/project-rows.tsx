// SH-3: one ObjectRow per open project inside the project menu. The row's main button is the
// menu item that shows the project (aria-current on the shown one); the always-shown ✕ is the
// menu item "Close {name}". The spinner marks the shown project while it has a queued or
// running job (the window's activity rows; other projects show none, OI-DW-2). Names only, no
// path.
import type { OpenProjectSummary } from '@/shared/schemas/project'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark } from '@/renderer/ui/status-mark'

export type ProjectRowsProps = {
  projects: readonly OpenProjectSummary[]
  shownId: string | null
  running: boolean
  onShow: (projectId: string) => void
  onClose: (projectId: string, name: string) => void
}

export function ProjectRows(props: ProjectRowsProps) {
  return props.projects.map((p) => {
    const shown = p.projectId === props.shownId
    return (
      <li key={p.projectId} role="none">
        <ObjectRow
          name={p.name}
          label={p.name}
          thumb={<Icon name="file" />}
          selected={shown}
          marks={shown && props.running ? <StatusMark tone="running" tip="Running" /> : undefined}
          mainProps={{ role: 'menuitem', tabIndex: -1, 'aria-current': shown || undefined }}
          onSelect={() => props.onShow(p.projectId)}
          stateActions={
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={layout.iconButton}
              aria-label={`Close ${p.name}`}
              title={`Close ${p.name}`}
              onClick={() => props.onClose(p.projectId, p.name)}
            >
              <Icon name="x" />
            </button>
          }
        />
      </li>
    )
  })
}

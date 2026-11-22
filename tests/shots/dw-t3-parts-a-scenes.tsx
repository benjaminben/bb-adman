// The scenes of dw-t3-parts-a.shots.ts: the T3a, T3b and T3e parts drawn outside any screen,
// since no screen uses them yet. The shots file bundles this file and draws one scene at a time
// over the built app's page, which brings the app's tokens and base styles. Made-up content.
import { useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { InfoTip } from '@/renderer/ui/info-tip'
import { PanelHead } from '@/renderer/ui/panel-head'
import { Section } from '@/renderer/ui/section'
import { SideList } from '@/renderer/ui/side-list'
import { StatusMark, type StatusMarkProps } from '@/renderer/ui/status-mark'
import { SubPage } from '@/renderer/ui/sub-page'

const noop = () => {}

function Column(props: { title: string; compact?: boolean; children: ReactNode }) {
  return (
    <div
      data-density={props.compact ? 'compact' : undefined}
      style={{ width: 'var(--editor-props-width)', padding: 'var(--pad-panel)' }}
    >
      <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-muted)' }}>
        {props.title}
      </p>
      <div style={{ background: 'var(--color-bg)', padding: '0 var(--pad-panel)' }}>
        {props.children}
      </div>
    </div>
  )
}

function Bucket() {
  return (
    <label style={{ display: 'grid', gap: 'var(--space-1)' }}>
      Bucket
      <input defaultValue="spring-pictures" />
    </label>
  )
}

function Sections(props: { prefix: string }) {
  const info = <InfoTip about="cloud storage">Pictures you publish are copied here.</InfoTip>
  const connected = <StatusMark tone="ok" label="Connected" tip="Connected" icon="check" />
  return (
    <>
      <Section id={`${props.prefix}.storage`} title="Cloud storage" info={info} summary={connected}>
        <Bucket />
      </Section>
      <Section id={`${props.prefix}.keys`} title="Keys" fold="closed" summary="2 saved" />
      <Section id={`${props.prefix}.folders`} title="Server folders" onOpenPage={noop} />
      <Section id={`${props.prefix}.name`} title="Name" fold="none">
        <input aria-label="Name" defaultValue="Mosswood spring launch" />
      </Section>
    </>
  )
}

function SectionScene() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
      <Column title="Regular">
        <Sections prefix="regular" />
      </Column>
      <Column title="Compact" compact>
        <Sections prefix="compact" />
      </Column>
    </div>
  )
}

const MARKS: [string, StatusMarkProps][] = [
  ['Not set', { tone: 'none', label: 'Not set', tip: 'Not set' }],
  ['Key saved', { tone: 'ok', label: '•••4821', tip: 'Key saved, ends in 4821. Replace' }],
  ['Set up', { tone: 'ok', label: 'spring-pictures', tip: 'Set up: spring-pictures' }],
  ['Connected', { tone: 'ok', label: 'Connected', tip: 'Connected in 0.4 seconds', icon: 'check' }],
  [
    'Failed',
    { tone: 'danger', label: 'Failed', tip: 'The bucket refused the key', icon: 'xCircle' },
  ],
  ['Soon', { tone: 'none', label: 'Soon', tip: 'Not yet available' }],
  ['Working', { tone: 'running', label: 'Checking', tip: 'Checking the key' }],
  ['Saved', { tone: 'ok', label: 'Saved', tip: 'Saved', icon: 'check' }],
  [
    'Warnings',
    { tone: 'warn', label: '2 warnings', tip: 'Headline runs past the safe area', icon: 'alert' },
  ],
  [
    'Paid',
    { tone: 'warn', label: 'Paid', tip: 'Each run is charged to your account', icon: 'coin' },
  ],
  ['New result', { tone: 'accent', tip: 'New result' }],
  ['Info', { tone: 'info', label: '3 sizes', tip: '3 sizes in this campaign' }],
]

function MarkScene() {
  const row = { display: 'grid', gridTemplateColumns: 'repeat(3, 160px)', alignItems: 'center' }
  return (
    <div style={{ background: 'var(--color-bg)', padding: 'var(--space-4)', display: 'grid' }}>
      <div style={{ ...row, color: 'var(--color-text-muted)' }}>
        <span>State</span>
        <span>Shown</span>
        <span>Clickable</span>
      </div>
      {MARKS.map(([name, mark]) => (
        <div key={name} style={{ ...row, minHeight: 'var(--row-height)' }}>
          <span>{name}</span>
          <span>
            <StatusMark {...mark} />
          </span>
          <span>
            <StatusMark {...mark} onClick={noop} />
          </span>
        </div>
      ))}
    </div>
  )
}

function TipScene() {
  const info = (
    <InfoTip about="region">
      The region your bucket lives in, for example eu-west-1. Ask whoever set up the bucket.
    </InfoTip>
  )
  return (
    <Column title="InfoTip open">
      <Section id="tip.storage" title="Cloud storage" info={info}>
        <Bucket />
      </Section>
      <Section id="tip.keys" title="Keys" fold="closed" />
    </Column>
  )
}

function PageScene() {
  const [current, setCurrent] = useState('files')
  const items = [
    { id: 'ai', label: 'AI services', icon: 'sparkle' as const },
    { id: 'files', label: 'Files', icon: 'folder' as const },
    { id: 'publish', label: 'Publish', icon: 'cloud' as const, mark: 'warn' as const },
    { id: 'agents', label: 'Agents', icon: 'bot' as const, mark: 'danger' as const },
  ]
  const foot = <button type="button">Setup</button>
  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)', height: '420px' }}>
      <div style={{ width: '200px', padding: 'var(--pad-panel)', background: 'var(--color-bg)' }}>
        <SideList
          label="Settings pages"
          items={items}
          current={current}
          onChoose={setCurrent}
          foot={foot}
        />
      </div>
      <div style={{ width: '420px', padding: 'var(--pad-panel)', background: 'var(--color-bg)' }}>
        <SubPage title="Server folders" onBack={noop}>
          <p style={{ margin: 0 }}>Pictures, Models, Workflows</p>
        </SubPage>
      </div>
      <div
        data-density="compact"
        style={{ width: 'var(--activity-width)', background: 'var(--color-bg)' }}
      >
        <PanelHead title="Activity" icon="pulse" onClose={noop} closeLabel="Close activity" />
        <PanelHead title="Layers" icon="layers" level={3} />
      </div>
    </div>
  )
}

const SCENES = { section: SectionScene, marks: MarkScene, tip: TipScene, page: PageScene }
export type SceneName = keyof typeof SCENES

let root: Root | null = null

export function show(name: SceneName): void {
  root?.unmount()
  document.body.replaceChildren()
  Object.assign(document.body.style, { background: 'var(--color-page)', margin: '0' })
  const holder = document.createElement('div')
  holder.style.padding = 'var(--space-6)'
  document.body.append(holder)
  const Scene = SCENES[name]
  root = createRoot(holder)
  root.render(<Scene />)
}

// P10-1 (spec/phases/phase-10.md, "The tools left" and "Design additions", A-230): the 29
// tools of the plan, in listing order. A notBuilt row is in ALL_TOOLS but never in MCP_TOOLS,
// so an agent never sees it. Placeholder (spec/testing.md): each tool slice removes its own
// names from STILL_NOT_BUILT when it fills its rows; P10-14 checks the list is empty.
import { describe, it, expect } from 'vitest'
import { ALL_TOOLS, MCP_TOOLS } from '@/main/mcp/tools/table'

const PLAN = [
  'list_projects',
  'get_project',
  'list_assets',
  'get_campaign',
  'create_campaign',
  'get_slots',
  'get_job',
  'list_jobs',
  'generate_images',
  'generate_video',
  'cancel_job',
  'list_subjects',
  'get_variant',
  'render_variant',
  'create_layer',
  'update_layer',
  'update_layers',
  'delete_layer',
  'reorder_layers',
  'propose_layout',
  'copy_options',
  'cut_out',
  'delete_campaign',
  'add_variant',
  'delete_variant',
  'set_translation',
  'run_checks',
  'get_check_results',
  'set_variant_format',
]

// The tools not built yet. A tool slice removes exactly its own names.
const STILL_NOT_BUILT = [
  'list_subjects',
  'get_variant',
  'create_layer',
  'update_layer',
  'update_layers',
  'delete_layer',
  'reorder_layers',
  'propose_layout',
  'copy_options',
  'cut_out',
  'delete_campaign',
  'add_variant',
  'delete_variant',
  'set_translation',
  'run_checks',
  'get_check_results',
  'set_variant_format',
]

// What each tool runs (spec/phases/phase-10.md, "The tools left").
const TARGETS: Record<string, [kind: 'command' | 'query', target: string]> = {
  list_subjects: ['query', 'subject.list'],
  get_variant: ['query', 'variant.get'],
  render_variant: ['query', 'variant.render'],
  create_layer: ['command', 'layer.create'],
  update_layer: ['command', 'layer.update'],
  update_layers: ['command', 'layer.updateMany'],
  delete_layer: ['command', 'layer.delete'],
  reorder_layers: ['command', 'layer.reorder'],
  propose_layout: ['command', 'generation.proposeLayout'],
  copy_options: ['command', 'generation.copyOptions'],
  cut_out: ['command', 'generation.cutOut'],
  delete_campaign: ['command', 'campaign.delete'],
  add_variant: ['command', 'variant.add'],
  delete_variant: ['command', 'variant.delete'],
  set_translation: ['command', 'translation.set'],
  run_checks: ['command', 'check.run'],
  get_check_results: ['query', 'check.results'],
  set_variant_format: ['command', 'variant.setFormat'],
}

describe('the Phase 10 tool plan [P10-1, A-230, A-231]', () => {
  it('holds the 29 tools of the plan, each once, in listing order', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(names).toEqual(PLAN)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has a notBuilt row for exactly the tools still not built', () => {
    expect(ALL_TOOLS.filter((t) => t.notBuilt).map((t) => t.name)).toEqual(STILL_NOT_BUILT)
  })

  it('lists no notBuilt row to an agent, and every other row', () => {
    expect(MCP_TOOLS.some((t) => t.notBuilt)).toBe(false)
    expect(MCP_TOOLS.map((t) => t.name)).toEqual(PLAN.filter((n) => !STILL_NOT_BUILT.includes(n)))
  })

  it.each(Object.entries(TARGETS))('%s names its own target', (name, [kind, target]) => {
    const row = ALL_TOOLS.find((t) => t.name === name)
    expect(row?.kind).toBe(kind)
    expect(row?.target).toBe(target)
  })

  it('has no tool that reaches agent.answerPermission or any agent.* command', () => {
    expect(ALL_TOOLS.filter((t) => t.target.startsWith('agent.'))).toEqual([])
  })
})

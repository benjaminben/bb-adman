import { z } from 'zod'

// project.listOpen (MCP-D): app scope, no input. Each open project's ID and name only; the
// file path stays out, so the reply can go to an agent (FR-198, FR-201).
export const projectListOpenInput = z.object({})

export type OpenProject = { id: string; name: string }
export type ProjectListOpen = OpenProject[]

import { z } from 'zod'
import { projectName } from '@/shared/schemas/project-name'

// project.createInDefaultFolder (spec/phases/round-2-platform.md, D8): the name only. The folder
// is the default projects folder, so nothing in the input names a place.
export const projectCreateDefaultInput = z.object({ name: projectName }).strict()
export type ProjectCreateDefaultInput = z.infer<typeof projectCreateDefaultInput>

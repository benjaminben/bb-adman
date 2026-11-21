// project.package (SPEC 3.9, 4.2; FR-008, R-09). Not undoable and changes no rev. It writes
// nothing to the open project, so all its work is the prepare step (SPEC 3.6).
import { defineCommand } from '@/main/commands/types'
import { packageProject } from '@/main/assets/package'
import { projectPackageInput } from '@/shared/schemas/commands/asset'

export function projectPackage() {
  return defineCommand({
    name: 'project.package',
    input: projectPackageInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) => packageProject(ctx.project, input.targetDir, input.skipMissing),
    run: (_ctx, _input, prepared) => ({ data: prepared }),
  })
}

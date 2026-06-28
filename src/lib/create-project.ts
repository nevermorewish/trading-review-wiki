import { createProject, writeFile, createDirectory } from "@/commands/fs"
import { getTemplate } from "@/lib/templates"
import { normalizePath } from "@/lib/path-utils"
import type { WikiProject } from "@/types/wiki"

/**
 * Scaffold a new review/wiki project under `parentDir/name` using the given
 * template: writes schema.md + purpose.md, creates the template's extra
 * directories, and writes any template-specific initial files.
 *
 * Shared by the create-project dialog and the default-review bootstrap so the
 * two stay in sync.
 */
export async function scaffoldProject(
  name: string,
  parentDir: string,
  templateId: string,
): Promise<WikiProject> {
  const project = await createProject(name, parentDir)
  const pp = normalizePath(project.path)

  const template = getTemplate(templateId)
  await writeFile(`${pp}/schema.md`, template.schema)
  await writeFile(`${pp}/purpose.md`, template.purpose)
  for (const dir of template.extraDirs) {
    await createDirectory(`${pp}/${dir}`)
  }
  // Write template-specific initial files
  if (template.files) {
    for (const [relativePath, content] of Object.entries(template.files)) {
      await writeFile(`${pp}/${relativePath}`, content)
    }
  }

  return project
}

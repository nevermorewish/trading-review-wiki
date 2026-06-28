import {
  getDefaultReviewPaths,
  openProject,
  copyDirectory,
} from "@/commands/fs"
import { scaffoldProject } from "@/lib/create-project"
import { normalizePath } from "@/lib/path-utils"
import type { WikiProject } from "@/types/wiki"

/**
 * Ensure the bundled default review library exists and return it as a project.
 *
 * On first launch we create `<exe_dir>/review/default` from the "trading"
 * template (schema.md / purpose.md / raw skeleton / .obsidian), then overlay
 * the wiki knowledge base bundled into the app so users get a ready-to-use
 * library out of the box. If the default library already exists we just open
 * it and never overwrite the user's data.
 */
export async function ensureDefaultReview(): Promise<WikiProject> {
  const { reviewDir, defaultDir, bundledWikiDir } = await getDefaultReviewPaths()

  // Already initialized — open as-is, don't clobber user changes.
  try {
    return await openProject(defaultDir)
  } catch {
    // Not a valid project yet; fall through to create it.
  }

  // Scaffold the trading-template skeleton under reviewDir/default.
  const project = await scaffoldProject("default", reviewDir, "trading")

  // Overlay the bundled wiki (overwrites the template's placeholder wiki files).
  await copyDirectory(bundledWikiDir, `${normalizePath(project.path)}/wiki`)

  return project
}

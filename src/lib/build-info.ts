export const UNKNOWN_VALUE = "-"

export const DESKTOP_VERSION = import.meta.env.VITE_DESKTOP_VERSION || UNKNOWN_VALUE
export const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || "unknown"
export const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || "unknown"

export function versionLabel(version: string | undefined | null): string {
  const value = version?.trim()
  if (!value || value === "unknown" || value === UNKNOWN_VALUE) return `v${UNKNOWN_VALUE}`
  return value.startsWith("v") || value.startsWith("V") ? value : `v${value}`
}

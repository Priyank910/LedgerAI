export function parseReleaseTag(tag: string): {
  major: number
  minor: number
  patch: number
  prerelease: string
  version: string
  versionCode: number
} | null

export function applyReleaseVersion(
  root: string,
  tag: string,
): {
  major: number
  minor: number
  patch: number
  prerelease: string
  version: string
  versionCode: number
}

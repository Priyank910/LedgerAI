export type ReleaseVersion = {
  major: number
  minor: number
  patch: number
  prerelease: string
  version: string
  versionCode: number
}

const TAG = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/

export function parseReleaseTag(tag: string): ReleaseVersion | null {
  const match = TAG.exec(tag.trim())
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3] ?? 0)
  const prerelease = match[4] ?? ''
  const version = prerelease ? `${major}.${minor}.${patch}-${prerelease}` : `${major}.${minor}.${patch}`
  return { major, minor, patch, prerelease, version, versionCode: major * 10000 + minor * 100 + patch }
}

/** Positive when `left` is newer than `right`. A plain release beats the same numbers with a prerelease. */
export function compareReleaseVersions(left: string, right: string): number {
  const a = parseReleaseTag(left)
  const b = parseReleaseTag(right)
  if (!a || !b) return 0
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (a.prerelease === b.prerelease) return 0
  if (!a.prerelease) return 1
  if (!b.prerelease) return -1
  return a.prerelease < b.prerelease ? -1 : 1
}

export const UPDATE_CHECK_MS = 4 * 60 * 60 * 1000

export function shouldOfferUpdate(input: {
  currentVersion: string
  latestVersion: string
  laterVersion: string | null
  laterAt: number | null
  now: number
}): boolean {
  if (compareReleaseVersions(input.latestVersion, input.currentVersion) <= 0) return false
  if (input.laterVersion === input.latestVersion && input.laterAt != null && input.now - input.laterAt < UPDATE_CHECK_MS) return false
  return true
}

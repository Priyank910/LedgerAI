import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TAG = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/

export function parseReleaseTag(tag) {
  const match = TAG.exec(String(tag).trim())
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3] ?? 0)
  const prerelease = match[4] ?? ''
  const version = prerelease ? `${major}.${minor}.${patch}-${prerelease}` : `${major}.${minor}.${patch}`
  return { major, minor, patch, prerelease, version, versionCode: major * 10000 + minor * 100 + patch }
}

export function applyReleaseVersion(root, tag) {
  const parsed = parseReleaseTag(tag)
  if (!parsed) {
    throw new Error(`Tag ${tag} must look like v0.1.1`)
  }
  const packagePath = join(root, 'package.json')
  const packageJson = readFileSync(packagePath, 'utf8')
  writeFileSync(packagePath, packageJson.replace(/"version":\s*"[^"]+"/, `"version": "${parsed.version}"`))

  const tauriPath = join(root, 'src-tauri', 'tauri.conf.json')
  const tauri = readFileSync(tauriPath, 'utf8')
  writeFileSync(tauriPath, tauri.replace(/"version":\s*"[^"]+"/, `"version": "${parsed.version}"`))

  const cargoPath = join(root, 'src-tauri', 'Cargo.toml')
  const cargo = readFileSync(cargoPath, 'utf8')
  writeFileSync(cargoPath, cargo.replace(/version = "[^"]+"/, `version = "${parsed.version}"`))

  const gradlePath = join(root, 'android', 'app', 'build.gradle')
  const gradle = readFileSync(gradlePath, 'utf8')
  writeFileSync(
    gradlePath,
    gradle
      .replace(/versionCode\s+\d+/, `versionCode ${parsed.versionCode}`)
      .replace(/versionName\s+"[^"]+"/, `versionName "${parsed.version}"`),
  )
  return parsed
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) {
  const tag = process.argv[2] || process.env.RELEASE_TAG || ''
  try {
    const parsed = applyReleaseVersion(process.cwd(), tag)
    console.log(`version ${parsed.version} (${parsed.versionCode})`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

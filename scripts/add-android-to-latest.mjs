import { readFileSync, writeFileSync } from 'node:fs'
import { parseReleaseTag } from './set-release-version.mjs'

const file = process.argv[2]
const tag = process.argv[3]
const parsed = parseReleaseTag(tag)
if (!file || !parsed) {
  console.error('Usage: node scripts/add-android-to-latest.mjs <latest.json> <v0.1.2>')
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(file, 'utf8'))
manifest.version = parsed.version
manifest.android = {
  versionCode: parsed.versionCode,
  url: `https://github.com/Priyank910/LedgerAI/releases/download/${tag.startsWith('v') ? tag : `v${tag}`}/app-release.apk`,
  releaseUrl: `https://github.com/Priyank910/LedgerAI/releases/tag/${tag.startsWith('v') ? tag : `v${tag}`}`,
}
writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`android ${parsed.version} (${parsed.versionCode})`)

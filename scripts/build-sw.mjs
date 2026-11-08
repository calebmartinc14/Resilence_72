import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = new URL('../dist/', import.meta.url)
const template = await readFile(new URL('./sw.template.js', import.meta.url), 'utf8')
const assets = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name !== 'sw.js')
  .map(entry => relative(fileURLToPath(output), join(entry.parentPath, entry.name)).split(sep).join('/'))
  .sort()

const hash = createHash('sha256').update(template)
for (const asset of assets) {
  hash.update(asset)
  hash.update(await readFile(new URL(asset, output)))
}

await writeFile(new URL('sw.js', output),
  'const VERSION = ' + JSON.stringify(hash.digest('hex').slice(0, 16)) + '\n' +
  'const ASSETS = ' + JSON.stringify(assets) + '\n' + template)

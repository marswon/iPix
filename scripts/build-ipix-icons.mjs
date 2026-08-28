import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(repoRoot, 'public', 'nomi-logo.svg')
const buildDir = path.join(repoRoot, 'build')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ipix-icons-'))
const iconset = path.join(tempRoot, 'iPix.iconset')
fs.mkdirSync(iconset)
fs.mkdirSync(buildDir, { recursive: true })

function render(size, target) {
  execFileSync('sips', ['-z', String(size), String(size), '-s', 'format', 'png', source, '--out', target], {
    stdio: 'ignore',
  })
}

try {
  render(512, path.join(buildDir, 'icon.png'))
  for (const [name, size] of [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_48x48.png', 48],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024],
  ]) render(size, path.join(iconset, name))
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(buildDir, 'icon.icns')])

  const icoSizes = [16, 32, 48, 256]
  const payloads = icoSizes.map((size) => fs.readFileSync(path.join(iconset, `icon_${size}x${size}.png`)))
  const header = Buffer.alloc(6 + 16 * payloads.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(payloads.length, 4)
  let offset = header.length
  payloads.forEach((payload, index) => {
    const entry = 6 + index * 16
    const size = icoSizes[index]
    header.writeUInt8(size === 256 ? 0 : size, entry)
    header.writeUInt8(size === 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(payload.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += payload.length
  })
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([header, ...payloads]))
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}

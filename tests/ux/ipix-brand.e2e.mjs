import fs from 'node:fs'
import path from 'node:path'
import { launchNomiApp, repoRoot } from './_launchApp.mjs'
import { expectText, expectVisible, screenshotSettled } from './_assert.mjs'

const shotsDir = path.join(repoRoot, 'tests/ux/shots/ipix-brand')
fs.mkdirSync(shotsDir, { recursive: true })
const session = await launchNomiApp({ name: 'ipix-brand' })
try {
  await session.win.evaluate(() => {
    for (const key of ['nomi:splash:v1', 'nomi:journey-tour:v1', 'nomi:canvas-gesture-hint:v1']) localStorage.setItem(key, 'seen')
  })
  await session.win.reload()
  const wordmark = session.win.locator('.nomi-wordmark').first()
  const mark = session.win.locator('.nomi-logo-mark').first()
  await expectVisible(wordmark, 'iPix wordmark should be visible')
  await expectText(wordmark, /^iPix$/, 'wordmark should use the approved iPix casing')
  await expectVisible(mark, 'iPix logo mark should be visible')
  const brand = await session.win.evaluate(() => {
    const logo = document.querySelector('.nomi-logo-mark')
    return {
      title: document.title,
      wordmark: document.querySelector('.nomi-wordmark')?.textContent,
      hasViewfinder: Boolean(logo?.querySelector('path')),
      hasDot: Boolean(logo?.querySelector('circle')),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })
  if (brand.title !== 'iPix') throw new Error(`expected iPix document title, got ${brand.title}`)
  if (!brand.hasViewfinder || !brand.hasDot) throw new Error('approved pixel-viewfinder logo geometry is missing')
  if (brand.overflow) throw new Error('iPix project library has horizontal overflow')
  await screenshotSettled(session.win, { path: path.join(shotsDir, '01-ipix-project-library.png') })
  console.log('IPIX BRAND E2E PASS')
} finally {
  await session.close()
}

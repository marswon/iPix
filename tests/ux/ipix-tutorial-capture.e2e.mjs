// Deterministic screenshots for the public iPix beginner tutorial. No provider request is sent.
import fs from 'node:fs'
import path from 'node:path'
import { launchNomiApp, repoRoot } from './_launchApp.mjs'
import { clickOrFail, expectVisible, screenshotSettled } from './_assert.mjs'

const shotsDir = path.join(repoRoot, 'tests/ux/shots/ipix-tutorial')
const apiKey = process.env.GETTOKEN_GROUP_API_KEY
if (!apiKey) throw new Error('GETTOKEN_GROUP_API_KEY is required for tutorial screenshots')
fs.mkdirSync(shotsDir, { recursive: true })
const session = await launchNomiApp({ name: 'ipix-tutorial-capture' })
try {
  await session.win.evaluate(async (key) => {
    localStorage.setItem('nomi-color-scheme', 'light')
    for (const key of ['nomi:splash:v1', 'nomi:journey-tour:v1', 'nomi:canvas-gesture-hint:v1']) localStorage.setItem(key, 'seen')
    await window.nomiDesktop.onboarding.adapterRegister({
      vendorName: 'GetToken',
      baseUrl: 'https://www.gettoken.net',
      apiKey: key,
      authType: 'bearer',
      providerKind: 'openai-compatible',
      models: [
        { modelKey: 'qwen-image-2.0-pro', labelZh: 'Qwen Image 2.0 Pro', kind: 'image' },
        { modelKey: 'seedance-2.0', labelZh: 'Seedance 2.0', kind: 'video' },
      ],
    })
  }, apiKey)
  await session.win.reload()
  await session.win.waitForTimeout(900)
  for (let index = 0; index < 4; index += 1) await session.win.keyboard.press('Escape').catch(() => undefined)

  await clickOrFail(session.win.locator('[data-testid="open-model-settings"]'), '打开模型服务')
  const connection = session.win.getByRole('button', { name: /GetToken.*2 个模型/ })
  await expectVisible(connection, 'GetToken 连接可见')
  if ((await connection.textContent())?.includes('连不上')) {
    throw new Error('GetToken must be usable before capturing the public tutorial')
  }
  await screenshotSettled(session.win, { path: path.join(shotsDir, '01-gettoken-connected.png') })
  console.log('IPIX TUTORIAL CAPTURE PASS')
} finally {
  await session.close()
}

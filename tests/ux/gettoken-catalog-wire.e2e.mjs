// GetToken catalog-owned wire upgrade journey. Uses a synthetic credential and never submits generation work.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchNomiApp, repoRoot } from './_launchApp.mjs'
import { screenshotSettled } from './_assert.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-gettoken-wire-'))
const userDataDir = path.join(root, 'user-data')
const settingsDir = path.join(root, 'settings')
const projectsDir = path.join(root, 'projects')
const shotsDir = path.join(repoRoot, 'tests/ux/shots/gettoken-wire')
for (const directory of [userDataDir, settingsDir, projectsDir, shotsDir]) fs.mkdirSync(directory, { recursive: true })

const now = '2026-08-28T00:00:00.000Z'
fs.writeFileSync(path.join(settingsDir, 'model-catalog.json'), JSON.stringify({
  version: 10,
  vendors: [{
    key: 'gettoken', name: 'GetToken', enabled: false, baseUrlHint: 'https://www.gettoken.net',
    authType: 'bearer', providerKind: 'openai-compatible', createdAt: now, updatedAt: now,
  }],
  models: [{
    vendorKey: 'gettoken', modelKey: 'doubao-seedance-2-0-260128', labelZh: 'Seedance 2.0',
    kind: 'video', enabled: false,
    meta: {
      archetypeId: 'volcengine-seedance-2', wireProfile: 'gettoken-seedance-2',
      adapter: { state: 'failed', runId: 'legacy-paid-check' },
    },
    createdAt: now, updatedAt: now,
  }],
  mappings: [],
  apiKeysByVendor: {
    gettoken: { vendorKey: 'gettoken', apiKey: 'synthetic-never-spend', enc: 'plain', enabled: true, createdAt: now, updatedAt: now },
  },
}, null, 2))

const failures = []
const launched = await launchNomiApp({
  name: 'gettoken-catalog-wire', userDataDir, settingsDir, projectsDir, settleMs: 1200,
})
const { app, win } = launched
try {
  await win.evaluate(() => {
    for (const key of ['nomi:splash:v1', 'nomi:journey-tour:v1', 'nomi:canvas-gesture-hint:v1']) {
      window.localStorage.setItem(key, 'seen')
    }
  })
  await win.reload()
  await win.waitForTimeout(1000)
  for (let index = 0; index < 5; index += 1) {
    await win.keyboard.press('Escape').catch(() => undefined)
    await win.waitForTimeout(150)
  }

  const enabledVideos = await win.evaluate(async () => {
    return window.nomiDesktop.modelCatalog.listModels({ vendorKey: 'gettoken', kind: 'video', enabled: true })
  })
  if (!enabledVideos.some((model) => model.modelKey === 'doubao-seedance-2-0-260128')) {
    failures.push('GetToken Seedance is absent from the enabled video catalog consumed by canvas model options')
  }

  const trigger = win.locator('[data-testid="open-model-settings"]').first()
  await trigger.click({ timeout: 5000 })
  await win.waitForSelector('[data-model-settings-page="home"]', { timeout: 5000 })
  const gettokenRow = win.locator('[data-model-home-connection="gettoken"]')
  if (await gettokenRow.count() !== 1) failures.push('GetToken is not shown as a connected model service')
  await gettokenRow.click({ timeout: 5000 })
  await win.waitForSelector('[data-model-settings-page="connection"]', { timeout: 5000 })
  await win.getByRole('button', { name: /Seedance 2\.0/ }).click({ timeout: 5000 })
  await win.waitForSelector('[data-model-settings-page="model"][data-model-settings-model="doubao-seedance-2-0-260128"]', { timeout: 5000 })

  const state = await win.locator('[data-model-adapter-state]').getAttribute('data-model-adapter-state')
  if (state !== 'readyVerified') failures.push(`GetToken Seedance detail state is ${state || 'missing'}, expected readyVerified`)
  if (await win.locator('[data-model-adapter-state] button').count()) {
    failures.push('Catalog-managed GetToken Seedance still exposes a generic adapter action')
  }
  await screenshotSettled(win, { path: path.join(shotsDir, 'gettoken-seedance-ready.png') })

  const stored = JSON.parse(fs.readFileSync(path.join(settingsDir, 'model-catalog.json'), 'utf8'))
  const storedModel = stored.models.find((model) => model.vendorKey === 'gettoken' && model.modelKey === 'doubao-seedance-2-0-260128')
  if (!storedModel?.enabled) failures.push('Upgrade did not persist enabled=true for GetToken Seedance')
  if (storedModel?.meta?.adapter) failures.push('Upgrade left stale generic adapter metadata on GetToken Seedance')
  if (storedModel?.meta?.catalogPresetRevision !== 4) failures.push('Upgrade did not persist GetToken preset revision 4')
  const gettokenMappings = stored.mappings.filter((mapping) => mapping.vendorKey === 'gettoken')
  if (gettokenMappings.length !== 2 || gettokenMappings.some((mapping) => !mapping.enabled)) {
    failures.push('Upgrade did not persist both enabled GetToken Seedance mappings')
  }
} finally {
  await launched.close()
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`)
  process.exit(1)
}
console.log('PASS: stale GetToken failure repaired, catalog wire ready, canvas video catalog enabled, generic adapter action absent')

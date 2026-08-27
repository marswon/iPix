// Live GetToken multi-group journey. Gated because it performs one real Qwen Image generation.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchNomiApp, repoRoot } from './_launchApp.mjs'
import { clickOrFail, expectText, expectVisible, screenshotSettled } from './_assert.mjs'

const apiKey = process.env.GETTOKEN_GROUP_API_KEY
if (!apiKey) throw new Error('GETTOKEN_GROUP_API_KEY is required for the live multi-group journey')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-gettoken-multigroup-'))
const userDataDir = path.join(root, 'user-data')
const settingsDir = path.join(root, 'settings')
const projectsDir = path.join(root, 'projects')
const shotsDir = path.join(repoRoot, 'tests/ux/shots/gettoken-multigroup')
for (const directory of [userDataDir, settingsDir, projectsDir, shotsDir]) fs.mkdirSync(directory, { recursive: true })

function assert(condition, label) {
  if (!condition) throw new Error(`GETTOKEN MULTIGROUP E2E FAIL: ${label}`)
  console.log(`  ✓ ${label}`)
}

let first = await launchNomiApp({ name: 'gettoken-multigroup-register', userDataDir, settingsDir, projectsDir })
try {
  const registered = await first.win.evaluate(async (key) => {
    window.nomiDesktop.modelCatalog.upsertVendorApiKey('gettoken', {
      apiKey: 'synthetic-seedance-group-credential',
      enabled: true,
    })
    const onboarding = window.nomiDesktop.onboarding
    const connection = await onboarding.adapterRegister({
      vendorName: 'GetToken 通用',
      baseUrl: 'https://www.gettoken.net',
      apiKey: key,
      authType: 'bearer',
      providerKind: 'openai-compatible',
      models: [],
    })
    if (!connection.ok || !connection.registration) return { connection }
    const models = await onboarding.adapterRegisterExisting({
      vendorKey: connection.registration.vendorKey,
      models: [
        { modelKey: 'qwen3.5-flash', labelZh: 'Qwen 3.5 Flash', kind: 'text' },
        { modelKey: 'qwen-image-2.0', labelZh: 'Qwen Image 2.0', kind: 'image' },
      ],
    })
    return { connection, models }
  }, apiKey)
  assert(
    registered.connection?.registration?.vendorKey === 'gettoken-2',
    'same-host second credential receives gettoken-2 identity',
  )
  assert(registered.models?.ok, 'models register through the explicit existing-connection identity')
} finally {
  await first.close()
}

const second = await launchNomiApp({ name: 'gettoken-multigroup-restart', userDataDir, settingsDir, projectsDir })
try {
  await second.win.evaluate(() => {
    for (const key of ['nomi:splash:v1', 'nomi:journey-tour:v1', 'nomi:canvas-gesture-hint:v1'])
      localStorage.setItem(key, 'seen')
  })
  await second.win.reload()
  await second.win.waitForTimeout(1000)
  for (let index = 0; index < 5; index += 1) await second.win.keyboard.press('Escape').catch(() => undefined)

  const catalog = await second.win.evaluate(() => {
    const bridge = window.nomiDesktop.modelCatalog
    return {
      vendors: bridge
        .listVendors()
        .filter((vendor) => vendor.key.startsWith('gettoken'))
        .map((vendor) => ({
          key: vendor.key,
          name: vendor.name,
          enabled: vendor.enabled,
          hasApiKey: vendor.hasApiKey,
        })),
      models: bridge
        .listModels({ vendorKey: 'gettoken-2', enabled: true })
        .map((model) => ({ modelKey: model.modelKey, kind: model.kind })),
      mappings: bridge
        .listMappings()
        .filter((mapping) => mapping.vendorKey === 'gettoken-2')
        .map((mapping) => ({
          modelKey: mapping.modelKey,
          taskKind: mapping.taskKind,
          enabled: mapping.enabled,
          path: mapping.create.path,
        })),
    }
  })
  assert(
    catalog.vendors.filter(
      (vendor) => ['gettoken', 'gettoken-2'].includes(vendor.key) && vendor.enabled && vendor.hasApiKey,
    ).length === 2,
    'both credential-bearing GetToken groups survive restart',
  )
  assert(
    catalog.models.some((model) => model.modelKey === 'qwen3.5-flash' && model.kind === 'text'),
    'general text model remains enabled',
  )
  assert(
    catalog.models.some((model) => model.modelKey === 'qwen-image-2.0' && model.kind === 'image'),
    'Qwen Image remains enabled',
  )
  assert(
    catalog.mappings.some(
      (mapping) =>
        mapping.modelKey === 'qwen-image-2.0' &&
        mapping.taskKind === 'text_to_image' &&
        mapping.enabled &&
        mapping.path === '/v1/images/generations',
    ),
    'Qwen Image production mapping remains enabled',
  )

  await clickOrFail(second.win.locator('[data-testid="open-model-settings"]'), '打开模型服务')
  const gettokenConnection = second.win.locator('[data-model-home-connection="gettoken-2"]')
  await expectVisible(gettokenConnection, '模型服务应显示第二个 GetToken 连接')
  await screenshotSettled(second.win, { path: path.join(shotsDir, '01-two-gettoken-connections.png') })
  await clickOrFail(second.win.locator('[data-settings-close]'), '关闭模型服务设置')
  await second.win.locator('[data-settings-overlay]').waitFor({ state: 'detached', timeout: 5000 })

  const projectCard = second.win.locator('[data-project-card]').first()
  if (await projectCard.count()) await clickOrFail(projectCard, '打开已有项目')
  else await clickOrFail(second.win.getByText('新建空白项目', { exact: false }), '新建空白项目')
  await second.win.waitForTimeout(2200)
  await clickOrFail(second.win.getByRole('button', { name: '生成', exact: false }), '打开生成画布')
  await clickOrFail(second.win.locator('button[aria-label="添加图片节点"]'), '添加图片节点')
  const composer = second.win.locator('.generation-canvas-v2-node__composer-card').first()
  await expectVisible(composer, '图片节点参数卡应可见')
  await clickOrFail(composer.locator('button[aria-label="模型"]'), '打开图片模型下拉')
  const dropdown = second.win.locator('[data-nomi-select-dropdown]:visible').first()
  await expectVisible(dropdown, '图片模型下拉应可见')
  await expectText(dropdown, /Qwen Image 2\.0/, '画布图片模型下拉应包含 GetToken Qwen Image')
  await screenshotSettled(second.win, { path: path.join(shotsDir, '02-canvas-qwen-image-option.png') })
  await second.win.keyboard.press('Escape')

  const generated = await second.win.evaluate(async () => {
    const { grantId } = await window.nomiDesktop.tasks.grantSpend({ nodeIds: [] })
    return window.nomiDesktop.tasks.run({
      vendor: 'gettoken-2',
      request: {
        kind: 'text_to_image',
        prompt: 'A clean editorial photograph of a green glass vase on a white table, soft daylight',
        extras: { modelKey: 'qwen-image-2.0', grantId, aspect_ratio: '1:1', resolution: '1K', n: 1, forceRerun: true },
      },
    })
  })
  assert(
    generated?.status === 'succeeded',
    `real Qwen Image task succeeds through Nomi runtime (${generated?.status || 'missing'})`,
  )
  assert(
    generated?.assets?.some((asset) => asset.type === 'image' && asset.url),
    'real Qwen Image task returns a localized image asset',
  )

  const text = await second.win.evaluate(() =>
    window.nomiDesktop.tasks.run({
      vendor: 'gettoken-2',
      request: {
        kind: 'chat',
        prompt: 'Reply with exactly: Nomi multi-group OK',
        extras: { modelKey: 'qwen3.5-flash' },
      },
    }),
  )
  assert(
    text?.status === 'succeeded',
    `real general text task succeeds through Nomi runtime (${text?.status || 'missing'})`,
  )
  console.log('GETTOKEN MULTIGROUP LIVE E2E PASS')
} finally {
  await second.close()
}

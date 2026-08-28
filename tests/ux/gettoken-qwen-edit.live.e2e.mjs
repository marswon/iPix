// Live GetToken Qwen Pro reference-image edit journey. Gated because it performs one paid generation.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchNomiApp } from './_launchApp.mjs'

const apiKey = process.env.GETTOKEN_GROUP_API_KEY
if (!apiKey) throw new Error('GETTOKEN_GROUP_API_KEY is required for the live Qwen edit journey')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ipix-gettoken-qwen-edit-'))
const userDataDir = path.join(root, 'user-data')
const settingsDir = path.join(root, 'settings')
const projectsDir = path.join(root, 'projects')
for (const directory of [userDataDir, settingsDir, projectsDir]) fs.mkdirSync(directory, { recursive: true })

function assert(condition, label) {
  if (!condition) throw new Error(`GETTOKEN QWEN EDIT E2E FAIL: ${label}`)
  console.log(`  ✓ ${label}`)
}

const session = await launchNomiApp({ name: 'gettoken-qwen-edit', userDataDir, settingsDir, projectsDir })
try {
  const result = await session.win.evaluate(async ({ key, referenceUrl }) => {
    const registration = await window.nomiDesktop.onboarding.adapterRegister({
      vendorName: 'GetToken Qwen',
      baseUrl: 'https://www.gettoken.net',
      apiKey: key,
      authType: 'bearer',
      providerKind: 'openai-compatible',
      models: [{ modelKey: 'qwen-image-2.0-pro', labelZh: 'Qwen Image 2.0 Pro', kind: 'image' }],
    })
    if (!registration.ok || !registration.registration) return { registration }
    const vendorKey = registration.registration.vendorKey
    const mapping = window.nomiDesktop.modelCatalog.listMappings().find((candidate) =>
      candidate.vendorKey === vendorKey && candidate.modelKey === 'qwen-image-2.0-pro' && candidate.taskKind === 'image_edit')
    const model = window.nomiDesktop.modelCatalog.listModels({ vendorKey }).find((candidate) =>
      candidate.modelKey === 'qwen-image-2.0-pro')
    const { grantId } = await window.nomiDesktop.tasks.grantSpend({ nodeIds: [] })
    const task = await window.nomiDesktop.tasks.run({
      vendor: vendorKey,
      request: {
        kind: 'image_edit',
        prompt: 'Keep the landscape composition and change the sky to a soft pink sunset.',
        extras: {
          modelKey: 'qwen-image-2.0-pro',
          referenceImages: [referenceUrl],
          grantId,
          size: '1:1',
          resolution: '1K',
          n: 1,
          forceRerun: true,
        },
      },
    })
    return {
      registration,
      mapping: mapping ? { path: mapping.create.path, body: mapping.create.body } : null,
      model: model ? { enabled: model.enabled, meta: model.meta } : null,
      task: { status: task.status, assets: task.assets?.map((asset) => ({ type: asset.type, url: asset.url })) },
    }
  }, {
    key: apiKey,
    referenceUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Fronalpstock_big.jpg/320px-Fronalpstock_big.jpg',
  })
  assert(result.registration?.ok, 'official GetToken Qwen Pro connection registers')
  assert(result.model?.enabled, 'Qwen Pro is enabled with the verified catalog contract')
  assert(result.model?.meta?.imageOptions?.supportsReferenceImages === true, 'reference-image capability is exposed')
  assert(result.mapping?.path === '/v1/images/generations', 'image edit uses the verified image endpoint')
  assert(result.mapping?.body?.image_urls === '{{request.params.image_urls}}', 'reference URLs reach the provider body')
  assert(result.task?.status === 'succeeded', `real reference-image edit succeeds (${result.task?.status || 'missing'})`)
  assert(result.task?.assets?.some((asset) => asset.type === 'image' && asset.url), 'edited image is localized as a runtime asset')
  console.log('GETTOKEN QWEN EDIT LIVE E2E PASS')
} finally {
  await session.close()
  fs.rmSync(root, { recursive: true, force: true })
}

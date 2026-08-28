// Live stale-connection repair journey. Gated because the final canvas-equivalent generation is paid.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchNomiApp } from './_launchApp.mjs'

const apiKey = process.env.GETTOKEN_GROUP_API_KEY
const encryptedApiKey = process.env.GETTOKEN_GROUP_ENCRYPTED_API_KEY
if (!apiKey || !encryptedApiKey) throw new Error('GetToken plaintext and safeStorage fixture credentials are required for the live Seedance repair journey')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ipix-gettoken-seedance-repair-'))
const userDataDir = path.join(root, 'user-data')
const settingsDir = path.join(root, 'settings')
const projectsDir = path.join(root, 'projects')
for (const directory of [userDataDir, settingsDir, projectsDir]) fs.mkdirSync(directory, { recursive: true })
const now = '2026-08-28T12:00:00.000Z'
const modelKey = 'doubao-seedance-2-0-260128'
const staleCreate = {
  method: 'POST', path: '/v1/video/generations',
  headers: { Authorization: 'Bearer {{user_api_key}}', 'Content-Type': 'application/json' },
  body: { model: '{{model.modelKey}}', prompt: '{{request.prompt}}', duration: '{{request.params.duration}}', size: '{{request.params.ratio}}' },
  response_mapping: { task_id: ['task_id', 'id', 'data.task_id'], status: ['status', 'data.status'] },
  provider_meta_mapping: { task_id: ['task_id', 'id', 'data.task_id'] },
}
const staleQuery = {
  method: 'GET', path: '/v1/video/generations/{{providerMeta.task_id}}',
  headers: { Authorization: 'Bearer {{user_api_key}}' },
  response_mapping: { task_id: ['task_id', 'id', 'data.task_id'], status: ['status', 'data.status'], video_url: ['data.url'] },
}
fs.writeFileSync(path.join(settingsDir, 'model-catalog.json'), JSON.stringify({
  version: 10,
  vendors: [{ key: 'gettoken-2', name: 'GetToken', enabled: true, baseUrlHint: 'https://www.gettoken.net', authType: 'bearer', providerKind: 'openai-compatible', meta: { credentialScopedConnection: true }, createdAt: now, updatedAt: now }],
  models: [{ vendorKey: 'gettoken-2', modelKey, labelZh: 'Seedance 2.0', kind: 'video', enabled: true, meta: { wireProfile: 'gettoken-seedance-2', archetypeId: 'volcengine-seedance-2', catalogManagedWire: true, catalogPresetRevision: 2 }, createdAt: now, updatedAt: now }],
  mappings: ['text_to_video', 'image_to_video'].map((taskKind) => ({ id: `stale-${taskKind}`, vendorKey: 'gettoken-2', modelKey, taskKind, name: taskKind, enabled: true, create: staleCreate, query: staleQuery, statusMapping: { queued: ['queued'], running: ['in_progress'], succeeded: ['success'], failed: ['failed'] }, createdAt: now, updatedAt: now })),
  apiKeysByVendor: { 'gettoken-2': { vendorKey: 'gettoken-2', apiKey: encryptedApiKey, enc: 'safeStorage', enabled: true, createdAt: now, updatedAt: now } },
}, null, 2))

function assert(condition, label) {
  if (!condition) throw new Error(`GETTOKEN SEEDANCE REPAIR E2E FAIL: ${label}`)
  console.log(`  ✓ ${label}`)
}

const prompt = 'A locked camera observes soft daylight moving across a plain white wall.'
const session = await launchNomiApp({ name: 'gettoken-seedance-repair', userDataDir, settingsDir, projectsDir })
let completed = false
try {
  const verifierStarted = await session.win.evaluate(async ({ key, model }) => window.nomiDesktop.onboarding.adapterStart({
    vendorName: 'GetToken verifier',
    baseUrl: 'https://www.gettoken.net',
    apiKey: key,
    authType: 'bearer',
    providerKind: 'openai-compatible',
    models: [{ modelKey: model, labelZh: 'Seedance 2.0', kind: 'video' }],
  }), { key: apiKey, model: modelKey })
  assert(verifierStarted?.ok && verifierStarted?.run?.id, `live adapter verifier starts (${verifierStarted?.error || 'ok'})`)
  let verifierRun = verifierStarted.run
  for (let attempt = 0; attempt < 100 && !['completed', 'partial', 'failed', 'timed_out'].includes(verifierRun.stage); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    const response = await session.win.evaluate(async ({ runId }) => window.nomiDesktop.onboarding.adapterGet({ runId }), { runId: verifierStarted.run.id })
    verifierRun = response?.run || verifierRun
  }
  const verifiedMode = verifierRun.models?.some((item) => item.modes?.some((mode) => mode.state === 'verified'))
  const exhaustedCleanly = verifierRun.stage === 'failed' && verifierRun.models?.every((item) =>
    item.modes?.every((mode) => mode.stage === 'poll' && String(mode.error || '').includes('timed out while polling')))
  assert((['completed', 'partial'].includes(verifierRun.stage) && verifiedMode) || exhaustedCleanly, `live verifier preserves task identity through completion or the polling budget (${verifierRun.stage})`)
  assert(!JSON.stringify(verifierRun).includes('/22'), 'live verifier never redirects polling to numeric row 22')
  assert(!JSON.stringify(verifierRun).includes('task_not_exist'), 'live verifier never receives task_not_exist')

  const catalog = await session.win.evaluate(({ vendor, key }) => ({
    model: window.nomiDesktop.modelCatalog.listModels({ vendorKey: vendor }).find((item) => item.modelKey === key),
    mappings: window.nomiDesktop.modelCatalog.listMappings().filter((item) => item.vendorKey === vendor && item.modelKey === key),
  }), { vendor: 'gettoken-2', key: modelKey })
  assert(catalog.model?.meta?.catalogPresetRevision === 3, 'startup upgrades the stale credential-scoped model to revision 3')
  assert(catalog.mappings.length === 2 && catalog.mappings.every((mapping) => mapping.enabled), 'both repaired video mappings stay enabled')
  assert(catalog.mappings.every((mapping) => JSON.stringify(mapping.query?.response_mapping).includes('data.result_url')), 'current result URL mapping replaces the stale query contract')

  const tested = await session.win.evaluate(async ({ vendor, key }) => window.nomiDesktop.onboarding.adapterAdaptExisting({
    vendorKey: vendor,
    models: [{ modelKey: key, labelZh: 'Seedance 2.0', kind: 'video' }],
  }), { vendor: 'gettoken-2', key: modelKey })
  assert(tested?.ok === false && tested?.code === 'CATALOG_WIRE_MANAGED', `model test uses the zero-cost catalog probe (${tested?.code || tested?.error})`)
  assert(!String(tested?.error || '').includes('task_not_exist'), 'model test never queries a fake numeric task id')

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    const health = await session.win.evaluate(({ vendor, key }) => ({
      vendor: window.nomiDesktop.modelCatalog.listVendors().find((item) => item.key === vendor),
      model: window.nomiDesktop.modelCatalog.listModels({ vendorKey: vendor }).find((item) => item.modelKey === key),
      mappings: window.nomiDesktop.modelCatalog.listMappings().filter((item) => item.vendorKey === vendor && item.modelKey === key).length,
    }), { vendor: 'gettoken-2', key: modelKey })
    assert(health.vendor?.enabled, `credential-scoped vendor remains enabled during startup settling (${attempt + 1}/15)`)
    assert(health.model?.enabled, `Seedance model remains enabled during startup settling (${attempt + 1}/15)`)
    assert(health.mappings === 2, `Seedance mappings remain present during startup settling (${attempt + 1}/15)`)
  }

  const { grantId } = await session.win.evaluate(async () => window.nomiDesktop.tasks.grantSpend({ nodeIds: [] }))
  const initial = await session.win.evaluate(async ({ grant, taskPrompt, key }) => window.nomiDesktop.tasks.run({
    vendor: 'gettoken-2',
    request: { kind: 'text_to_video', prompt: taskPrompt, extras: { modelKey: key, grantId: grant, duration: 5, ratio: '16:9', resolution: '720p', generate_audio: false, forceRerun: true } },
  }), { grant: grantId, taskPrompt: prompt, key: modelKey })
  assert(initial?.id?.startsWith('task_'), 'canvas-equivalent submit keeps provider task identity')

  let final = initial
  for (let attempt = 0; attempt < 40 && !['succeeded', 'failed'].includes(final.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10_000))
    const response = await session.win.evaluate(async ({ taskId, taskPrompt, key }) => window.nomiDesktop.tasks.result({ taskId, vendor: 'gettoken-2', taskKind: 'text_to_video', prompt: taskPrompt, modelKey: key }), { taskId: initial.id, taskPrompt: prompt, key: modelKey })
    final = response?.result || final
    console.log(`    poll ${attempt + 1}: ${final.status}`)
  }
  assert(final.status === 'succeeded', `canvas-equivalent runtime reaches success (${final.status})`)
  const video = final.assets?.find((asset) => asset.type === 'video' && asset.url)
  assert(video?.url, 'completed task exposes a non-empty video asset URL')
  const media = await fetch(video.url, { headers: { Range: 'bytes=0-1023' } })
  assert(media.ok || media.status === 206, `video asset is readable over HTTP (${media.status})`)
  assert((media.headers.get('content-type') || '').toLowerCase().startsWith('video/'), `video asset has a video content type (${media.headers.get('content-type') || 'missing'})`)
  const prefix = Buffer.from(await media.arrayBuffer()).subarray(0, 32).toString('latin1')
  assert(prefix.includes('ftyp'), 'video asset starts with an MP4-compatible ftyp box')
  completed = true
  console.log('GETTOKEN SEEDANCE REPAIR LIVE E2E PASS')
} finally {
  await session.close()
  if (completed) fs.rmSync(root, { recursive: true, force: true })
  else console.error(`GETTOKEN SEEDANCE REPAIR FIXTURE RETAINED: ${root}`)
}

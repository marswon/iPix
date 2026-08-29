// Live GetOne GPT Image 2 reference-image edit journey. Gated because it performs paid generation.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchNomiApp } from './_launchApp.mjs'

const apiKey = process.env.GETONE_API_KEY
const referenceDataUrl = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAAD/wAARCAAgACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAC/9oADAMBAAIRAxEAPwDxYkDqcUAg9Dmvuz9mnSvC/wAOP7K+L/jiya28O6hY3Vs+qXMiS2i3jXDIluLZY2k3FYs784614/8AEjU/iR8eLG6+K3/CNWlronhiM2dxPp6rDCgD+YC6PIXLfvByB0xX+klDi/2mPqYZU0qUGouo5JLnba5ErayurNXurq61Ry8uh86ZA6nFXIGBwRX0D8N9U+I/wFs7P4ov4btLnQ/FUaWkFxqCrNEy7vMLIiSB1bCHlh0r139pPS/DPxBfV/jB4Is3uPDlnZ2ltFqlvIkVo92s6xyQG2aNZNwWQnfnHAqMZxbyY6GGdNOlO8VUUk1zppcjXSV3a17uz00dsK1O8T//0PVP2Wdf0/xH4pT4c/E/UobjwRb2dzcRWGpSotil0HUo4DkDfl3I57mqN/I/7PPi6w8Kah4kt/G3gnVd17qWmaZKrWtwG3RiKUEspYbUbk9AK+UCAeCM0ABegxX+k1fg+E8ZVrup+6qK0qfKrcyv76lvGV3e6s7pO+iOXm0Pq/TGk/aG8XX/AIZtPEtt4L8F6OyXumaZqkqra26ArGYYgCqhsMx4J4Jq1+1L4gsPD/i6f4c/DPUobfwPLa21w1hp0qNYtdFmZ3IQkb8qpPPYV8jFQ33hmgADgDFOhwhCGMpV/afuqatGnyqyk7e+3vKV1e71u3rqxN6H/9k=`
if (!apiKey) throw new Error('GETONE_API_KEY is required for the live GetOne image edit journey')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ipix-getone-image-edit-'))
const userDataDir = path.join(root, 'user-data')
const settingsDir = path.join(root, 'settings')
const projectsDir = path.join(root, 'projects')
for (const directory of [userDataDir, settingsDir, projectsDir]) fs.mkdirSync(directory, { recursive: true })

function assert(condition, label) {
  if (!condition) throw new Error(`GETONE IMAGE EDIT E2E FAIL: ${label}`)
  console.log(`  ✓ ${label}`)
}

const session = await launchNomiApp({ name: 'getone-image-edit', userDataDir, settingsDir, projectsDir })
try {
  const started = await session.win.evaluate(async ({ key }) => window.nomiDesktop.onboarding.adapterStart({
    vendorName: 'GetOne',
    baseUrl: 'https://www.getone.ai',
    apiKey: key,
    authType: 'bearer',
    providerKind: 'openai-compatible',
    models: [{ modelKey: 'gpt-image-2', labelZh: 'GPT Image 2', kind: 'image' }],
  }), { key: apiKey })
  assert(started?.ok && started?.run?.id, `GetOne adapter verification starts (${started?.error || 'ok'})`)
  let run = started.run
  for (let attempt = 0; attempt < 100 && !['completed', 'partial', 'failed', 'timed_out'].includes(run.stage); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    const response = await session.win.evaluate(async ({ runId }) => window.nomiDesktop.onboarding.adapterGet({ runId }), { runId: started.run.id })
    run = response?.run || run
  }
  assert(['completed', 'partial'].includes(run.stage), `GetOne adapter reaches a usable terminal state (${run.stage})`)
  const modeSummary = run.models?.flatMap((item) => item.modes?.map((mode) => ({
    taskKind: mode.taskKind,
    state: mode.state,
    stage: mode.stage,
    httpStatus: mode.httpStatus,
    errorCategory: mode.errorCategory,
    error: String(mode.error || '').replace(/request[_ -]?id[^ )}"']+/gi, 'request_id:[redacted]').slice(0, 240),
  })) || []) || []
  console.log(`  mode summary: ${JSON.stringify(modeSummary)}`)
  assert(run.models?.some((item) => item.modelKey === 'gpt-image-2' && item.modes?.some((mode) =>
    mode.taskKind === 'image_edit' && mode.state === 'verified')), 'real adapter verification passes image_edit')

  const result = await session.win.evaluate(async ({ vendorKey, referenceUrl }) => {
    const mapping = window.nomiDesktop.modelCatalog.listMappings().find((candidate) =>
      candidate.vendorKey === vendorKey && candidate.modelKey === 'gpt-image-2' && candidate.taskKind === 'image_edit')
    const model = window.nomiDesktop.modelCatalog.listModels({ vendorKey }).find((candidate) =>
      candidate.modelKey === 'gpt-image-2')
    const { grantId } = await window.nomiDesktop.tasks.grantSpend({ nodeIds: [] })
    const task = await window.nomiDesktop.tasks.run({
      vendor: vendorKey,
      request: {
        kind: 'image_edit',
        prompt: 'Keep the landscape composition and add one small red hot-air balloon in the upper-right sky. Photorealistic.',
        extras: {
          modelKey: 'gpt-image-2',
          referenceImages: [referenceUrl],
          grantId,
          size: '1:1',
          resolution: '1K',
          quality: 'standard',
          n: 1,
          forceRerun: true,
        },
      },
    })
    return {
      mapping: mapping ? {
        path: mapping.create.path,
        imageField: mapping.create.multipart?.imageField,
        imageSource: mapping.create.multipart?.imageSource,
      } : null,
      model: model ? { enabled: model.enabled, meta: model.meta } : null,
      task: { status: task.status, assets: task.assets?.map((asset) => ({ type: asset.type, url: asset.url })) },
    }
  }, {
    vendorKey: run.vendorKey,
    referenceUrl: referenceDataUrl,
  })
  assert(result.model?.enabled, 'GPT Image 2 is enabled after real verification')
  assert(result.model?.meta?.imageOptions?.supportsReferenceImages === true, 'reference-image capability is exposed')
  assert(result.mapping?.path === '/v1/images/edits', 'image edit uses the standard edits endpoint')
  assert(result.mapping?.imageField === 'image[]', 'reference images use multipart image[] fields')
  assert(result.mapping?.imageSource === '{{request.params.reference_images}}', 'runtime reference images reach the multipart transport')
  assert(result.task?.status === 'succeeded', `real reference-image edit succeeds (${result.task?.status || 'missing'})`)
  assert(result.task?.assets?.some((asset) => asset.type === 'image' && asset.url), 'edited image is localized as a runtime asset')
  console.log('GETONE GPT-IMAGE-2 EDIT LIVE E2E PASS')
} finally {
  await session.close()
  fs.rmSync(root, { recursive: true, force: true })
}

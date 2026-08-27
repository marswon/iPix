import { describe, expect, it, vi } from 'vitest'
import type { ChipModel } from './ModelChipGroups'
import type { OnboardingVendorMeta } from './useOnboardingDrawerCatalog'
import { projectOnboardingConnections } from './onboardingDrawerConnections'

function project(enabled: boolean, ids = ['auto']) {
  const vendorMeta = new Map<string, OnboardingVendorMeta>([['antigravity-cli', {
    name: 'Antigravity CLI', hasApiKey: false, baseUrl: '', enabled, authType: 'none', customCallOnly: false,
  }]])
  const model: ChipModel = { vendorKey: 'antigravity-cli', modelKey: 'auto', labelZh: 'Auto', kind: 'text', enabled: true }
  const openPage = vi.fn()
  return { openPage, ...projectOnboardingConnections({
    models: ids.map((modelKey) => ({ ...model, modelKey })), vendorMeta, dreaminaStatus: null, openPage,
    localNames: { dreamina: 'Dreamina', codex: 'Codex', antigravity: 'Antigravity CLI' },
  }) }
}

describe('model settings connection projection', () => {
  it.each([false, true])('routes the local CLI entry to its dedicated card when enabled=%s', (enabled) => {
    const result = project(enabled)
    expect(result.otherVendorGroups).toEqual([])
    const [entry] = enabled ? result.homeConnections : result.availableHomeConnections
    expect(entry).toMatchObject({ vendorKey: 'antigravity-cli', kind: 'local', name: 'Antigravity CLI' })
    expect(enabled ? result.availableHomeConnections : result.homeConnections).toEqual([])
    expect(entry.models).toHaveLength(0)
    entry.onOpen()
    expect(result.openPage).toHaveBeenCalledWith({ type: 'connection', vendorKey: 'antigravity-cli' })
  })
  it('routes the preset GetToken service to key-only platform connection', () => {
    const openPage = vi.fn()
    const result = projectOnboardingConnections({
      models: [{ vendorKey: 'gettoken', modelKey: 'doubao-seedance-2-0-260128', labelZh: 'Seedance 2.0', kind: 'video', enabled: true }],
      vendorMeta: new Map([['gettoken', { name: 'GetToken', hasApiKey: false, baseUrl: 'https://www.gettoken.net', enabled: true, authType: 'bearer', customCallOnly: false }]]),
      dreaminaStatus: null, openPage,
      localNames: { dreamina: 'Dreamina', codex: 'Codex', antigravity: 'Antigravity CLI' },
    })
    expect(result.availableHomeConnections).toHaveLength(1)
    expect(result.availableHomeConnections[0]).toMatchObject({ vendorKey: 'gettoken', kind: 'api', name: 'GetToken' })
    result.availableHomeConnections[0].onOpen()
    expect(openPage).toHaveBeenCalledWith({ type: 'platformConnect', vendorKey: 'gettoken' })
  })

  it('counts families as models and keeps tools and automatic routing separate', () => {
    const [entry] = project(true, ['gemini-3.7-flash-high', 'gemini-3.7-flash-medium', 'gemini-3.7-flash-low', 'claude-sonnet-4-6', 'auto', 'generate_image']).homeConnections
    expect(entry.models).toHaveLength(2)
    expect(entry.auxiliaryCounts).toEqual({ tools: 1, routes: 1 })
    expect(entry.skipHealthProbe).toBe(true)
  })
})

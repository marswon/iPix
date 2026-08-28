import fs from 'node:fs'
import assert from 'node:assert/strict'
import yaml from 'js-yaml'
import { it } from 'vitest'

const workflow = yaml.load(fs.readFileSync(new URL('../.github/workflows/desktop-preview.yml', import.meta.url), 'utf8'))
const jobs = workflow.jobs

it('desktop prerelease binds all three packages to one resolved source commit', () => {
  assert.equal(jobs['mac-preview'].outputs.source_sha, '${{ steps.source.outputs.sha }}')
  assert.equal(jobs['mac-intel-preview'].outputs.source_sha, '${{ steps.source.outputs.sha }}')
  assert.equal(jobs['windows-preview'].outputs.source_sha, '${{ steps.source.outputs.sha }}')
  assert.deepEqual(jobs['publish-prerelease'].needs, ['mac-preview', 'mac-intel-preview', 'windows-preview'])
  assert.equal(jobs['publish-prerelease'].env.SOURCE_SHA, '${{ needs.mac-preview.outputs.source_sha }}')
  assert.equal(jobs['publish-prerelease'].env.INTEL_SOURCE_SHA, '${{ needs.mac-intel-preview.outputs.source_sha }}')
  assert.equal(jobs['publish-prerelease'].env.WINDOWS_SOURCE_SHA, '${{ needs.windows-preview.outputs.source_sha }}')
})

it('desktop prerelease remains draft until exact architecture assets are verified', () => {
  const publish = jobs['publish-prerelease'].steps.find((step) => step.name?.includes('Stage, verify'))?.run || ''
  assert.match(publish, /Expected exactly two DMGs and one EXE/)
  assert.match(publish, /iPix\.Preview-mac-arm64\.dmg/)
  assert.match(publish, /iPix\.Preview-mac-x64\.dmg/)
  assert.match(publish, /iPix\.Preview-win-x64\.exe/)
  assert.match(publish, /pre-existing unmanaged tag/)
  assert.match(publish, /Staged release target SHA mismatch/)
  assert.match(publish, /--prerelease --draft/)
  assert.match(publish, /Refusing to mutate an already published release/)
  assert.match(publish, /asset_count.*3/)
  assert.match(publish, /--draft=false --prerelease/)
})

it('both mac previews smoke the renamed packaged product natively', () => {
  const armSmoke = jobs['mac-preview'].steps.find((step) => step.name === 'Smoke packaged iPix MCP bridge')
  const intelSmoke = jobs['mac-intel-preview'].steps.find((step) => step.name === 'Smoke packaged iPix MCP bridge on Intel')
  assert.match(armSmoke?.run || '', /iPix Preview\.app/)
  assert.equal(jobs['mac-intel-preview']['runs-on'], 'macos-15-intel')
  assert.match(jobs['mac-intel-preview'].steps.find((step) => step.name?.includes('Package iPix Preview'))?.run || '', /--x64/)
  assert.match(intelSmoke?.run || '', /x86_64/)
  assert.match(intelSmoke?.run || '', /LSMinimumSystemVersion/)
  assert.match(intelSmoke?.run || '', /minimum.*12\.0/)
  assert.match(intelSmoke?.run || '', /packaged-mcp-smoke\.e2e\.mjs/)
})

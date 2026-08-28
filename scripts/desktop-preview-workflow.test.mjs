import fs from 'node:fs'
import assert from 'node:assert/strict'
import yaml from 'js-yaml'
import { it } from 'vitest'

const workflow = yaml.load(fs.readFileSync(new URL('../.github/workflows/desktop-preview.yml', import.meta.url), 'utf8'))
const jobs = workflow.jobs

it('desktop prerelease binds both packages to one resolved source commit', () => {
  assert.equal(jobs['mac-preview'].outputs.source_sha, '${{ steps.source.outputs.sha }}')
  assert.equal(jobs['windows-preview'].outputs.source_sha, '${{ steps.source.outputs.sha }}')
  assert.deepEqual(jobs['publish-prerelease'].needs, ['mac-preview', 'windows-preview'])
  assert.equal(jobs['publish-prerelease'].env.SOURCE_SHA, '${{ needs.mac-preview.outputs.source_sha }}')
  assert.equal(jobs['publish-prerelease'].env.WINDOWS_SOURCE_SHA, '${{ needs.windows-preview.outputs.source_sha }}')
})

it('desktop prerelease remains draft until both exact platform assets are verified', () => {
  const publish = jobs['publish-prerelease'].steps.find((step) => step.name?.includes('Stage, verify'))?.run || ''
  assert.match(publish, /Expected exactly one DMG and one EXE/)
  assert.match(publish, /--prerelease --draft/)
  assert.match(publish, /Refusing to mutate an already published release/)
  assert.match(publish, /asset_count.*2/)
  assert.match(publish, /--draft=false --prerelease/)
})

it('mac preview smoke follows the renamed packaged product', () => {
  const smoke = jobs['mac-preview'].steps.find((step) => step.name === 'Smoke packaged iPix MCP bridge')
  assert.match(smoke?.run || '', /iPix Preview\.app/)
})

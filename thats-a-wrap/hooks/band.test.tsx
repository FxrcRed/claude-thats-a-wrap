import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'thats-a-wrap',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100 },
} as const

test('the bar above the prompt tracks steps and rolls the credits', async ($, on) => {
  const played: string[] = []
  on('tool.register', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>rings</Text>
  })
  on('audio.play', (_, e) => {
    played.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    played.push(JSON.stringify(e))
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'running' })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'done' })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 1, status: 'skipped', note: 'nothing to commit' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /nothing to commit/ }))?.text).toBe('· nothing to commit')
  expect(await ui.find({ type: 'Text', text: /rings/ })).toBeUndefined()

  await $.tool.call({
    tool: 'mcp__thats-a-wrap__credits',
    commits: ['abc1234 Add X'],
    pushed: ['origin/main → abc1234'],
  })
  expect(played.join()).toContain('sent.wav')
  expect((await ui.find({ type: 'Text', text: /1 commit/ }))?.text).toBe('1 commit · origin/main → abc1234')
  await ui.unmount()
})

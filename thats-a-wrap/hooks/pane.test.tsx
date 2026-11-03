import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'thats-a-wrap',
  component: 'Pane',
  requestId: 'thats-a-wrap',
  props: {
    title: "🎬 That's a wrap",
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('progress marks steps and credits roll with the send sound', async ($, on) => {
  const opened: string[] = []
  const played: string[] = []
  on('tool.register', () => ({ value: undefined }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
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
  expect(opened).toEqual(['thats-a-wrap'])

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /nothing to commit/ }))?.text).toBe('nothing to commit')

  await $.tool.call({
    tool: 'mcp__thats-a-wrap__credits',
    commits: ['abc1234 Add X'],
    pushed: ['origin/main → abc1234'],
  })
  expect(played.join()).toContain('sent.wav')
  expect((await ui.find({ type: 'Text', text: /abc1234 Add X/ }))?.text).toBe('abc1234 Add X')
  await ui.unmount()
})

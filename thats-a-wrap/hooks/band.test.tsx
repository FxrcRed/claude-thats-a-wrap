import { expect, test } from 'claude-code/testing'

const BAND = (bodyColumns: number) =>
  ({
    plugin: 'thats-a-wrap',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns },
  }) as const

const setup = (on: any) => {
  const played: string[] = []
  // Each clock.after fires when its call resolves; tick() lets every pending one through.
  let pending: (() => void)[] = []
  on('tool.register', () => ({ value: undefined }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>rings</Text>
  })
  on('audio.play', (_: unknown, e: unknown) => {
    played.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('process.run', (_: unknown, e: unknown) => {
    played.push(JSON.stringify(e))
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('clock.after', () => new Promise(done => pending.push(() => done({ value: undefined }))))
  on('clock.every', () => ({ value: () => undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  const tick = async () => {
    const now = pending
    pending = []
    now.forEach(fire => fire())
    await new Promise(r => setTimeout(r, 20))
  }
  return { played, tick }
}

test('each state shows in turn, then the credits roll and the band goes back', async ($, on) => {
  const { played, tick } = setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(100), surface: 'desktop' })

  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'running' })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'done' })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 1, status: 'skipped', note: 'nothing to commit' })
  // Calls return at once, but the bar still shows the first state until its time is up.
  expect((await ui.find({ type: 'Text', text: /Inventory/ }))?.text).toBe('Inventory')
  expect(await ui.find({ type: 'Text', text: /nothing to commit/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /rings/ })).toBeUndefined()

  await tick()
  await tick()
  expect((await ui.find({ type: 'Text', text: /nothing to commit/ }))?.text).toBe('· nothing to commit')

  await $.tool.call({ tool: 'mcp__thats-a-wrap__credits', commits: ['abc1234 Add X'], pushed: ['origin/main → abc1234'] })
  await tick()
  expect(played.join()).toContain('sent.wav')
  expect((await ui.find({ type: 'Text', text: /That's a wrap!/ }))?.text).toBe("🎬 That's a wrap!")
  expect(await ui.find({ type: 'Text', text: /1 commit/ })).toBeUndefined()

  await tick()
  expect((await ui.find({ type: 'Text', text: /rings/ }))?.text).toBe('rings')
  await ui.unmount()
})

test('a narrow window keeps one line: dots only', async ($, on) => {
  const { tick } = setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'running', note: 'taking stock' })
  await tick()
  const ui = await $.ui.mount({ ...BAND(18), surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Inventory/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /taking stock/ })).toBeUndefined()
  await ui.unmount()
})

test('a run that skips everything still shows, then clears itself', async ($, on) => {
  const { tick } = setup(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(100), surface: 'desktop' })
  // No "step 0 running" first: the first report alone opens the bar.
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'done', note: 'clean tree' })
  expect((await ui.find({ type: 'Text', text: /clean tree/ }))?.text).toBe('· clean tree')
  for (let step = 1; step <= 5; step++) {
    await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step, status: 'skipped', note: 'nothing to do' })
  }
  for (let i = 0; i < 8; i++) await tick()
  expect((await ui.find({ type: 'Text', text: /rings/ }))?.text).toBe('rings')
  await ui.unmount()
})

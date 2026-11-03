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

// usage-rings as it sits for real: outside this plugin, drawing the band without passing it on.
const RINGS = {
  name: 'usage-rings',
  tier: 'prepend',
  register(on: any) {
    const ref = { plugin: 'usage-rings', key: 'limits' }
    on('session.start', async ($: any, e: any, next: any) => {
      await $.state.set(ref, [
        { kind: 'five_hour', percentUsed: 40 },
        { kind: 'context', percentUsed: 10 },
      ])
      return next(e)
    })
    // As its session.measure does: a new context reading, the rest kept from what it reads.
    on('prompt.submit', async ($: any, e: any, next: any) => {
      const { value, version } = await $.state.get(ref)
      const kept = value.filter((l: any) => l.kind !== 'context')
      await $.state.set(ref, [...kept, { kind: 'context', percentUsed: 12 }], { ifVersion: version })
      return next(e)
    })
    on('ui.render', { component: 'AbovePrompt' }, async ($: any, e: any, next: any) => {
      const { value = [] } = await $.state.get(ref)
      if (value.length === 0) return next(e)
      const { Text } = $.ui.resolve(e)
      return <Text>{`usage ${value.length}`}</Text>
    })
  },
} as const

test('a run takes the band from usage-rings outside it, which keeps its limits', { plugins: [RINGS] }, async ($, on) => {
  const { tick } = setup(on)
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND(100), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /usage/ }))?.text).toBe('usage 2')

  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 0, status: 'running' })
  await tick()
  expect((await ui.find({ type: 'Text', text: /Inventory/ }))?.text).toBe('Inventory')
  expect(await ui.find({ type: 'Text', text: /usage/ })).toBeUndefined()

  // Its write starts from the empty read it got; the limits it could not see stay.
  await $.prompt.submit({ text: 'go on' })
  await $.tool.call({ tool: 'mcp__thats-a-wrap__progress', step: 5, status: 'done' })
  for (let i = 0; i < 6; i++) await tick()
  expect((await ui.find({ type: 'Text', text: /usage/ }))?.text).toBe('usage 2')
  await ui.unmount()
})

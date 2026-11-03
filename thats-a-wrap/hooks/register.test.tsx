import { expect, test } from 'claude-code/testing'

const BAND = () =>
  ({
    plugin: 'thats-a-wrap',
    component: 'SessionMode',
    props: { modes: [] },
  }) as const

test('pressing the button submits Wrap up', async ($, on) => {
  const sent: string[] = []
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  await ui.press({ key: 'wrap-up' })
  expect(sent).toEqual(['Wrap up'])
  await ui.unmount()
})

test('the mode labels still draw', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>rings</Text>
  })

  const ui = await $.ui.mount({ ...BAND(), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /rings/ }))?.text).toBe('rings')
  expect(await ui.find({ type: 'Button' })).toBeDefined()
  await ui.unmount()
})

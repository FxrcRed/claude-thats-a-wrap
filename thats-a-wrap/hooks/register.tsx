import type { Register } from 'claude-code'

// Sends the trigger phrase of the wrap-up skill in this plugin.
const PROMPT = 'Wrap up'
const LABEL = "🎬 That's a wrap"

export const register: Register = on => {
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    // Keep the mode labels (and other plugins' part); the button sits after them.
    const below = await next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={1}>
        {below}
        {/* A hover needs a keyed Box around it. */}
        <Box key="wrap-up-box">
          <Button
            key="wrap-up"
            label={LABEL}
            plain
            dimColor
            hover={{ color: 'claude' }}
            onPress={() => void $.prompt.submit({ text: PROMPT })}
          />
        </Box>
      </Box>
    )
  })
}

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Credits, Run, Step, StepStatus } from '../types'

// Sends the trigger phrase of the wrap-up skill in this plugin.
const PROMPT = 'Wrap up'
const LABEL = "🎬 That's a wrap"

const STEPS = ['Inventory', 'Commit', 'Check', 'Docs & lessons', 'Push & deploy', 'Verify & clean up']
const SHORT = ['Inventory', 'Commit', 'Check', 'Docs', 'Push', 'Verify']
const STATUSES: StepStatus[] = ['running', 'done', 'skipped', 'waiting', 'failed']
const MARK: Record<StepStatus, string> = {
  pending: '○',
  running: '●',
  done: '✓',
  skipped: '–',
  waiting: '‖',
  failed: '✗',
}
const COLOR: Partial<Record<StepStatus, string>> = {
  running: 'claude',
  done: 'success',
  waiting: 'warning',
  failed: 'error',
}

const fresh = (): Run => ({
  steps: STEPS.map(() => ({ status: 'pending', note: '' })),
  credits: null,
  isShown: false,
})
// Change the tag when Run's fields change: it declines what an older version stored.
const run = atom({ plugin: 'thats-a-wrap', key: 'run' } as const, fresh(), { shape: 'run-2' })

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 20) : []

// $.audio.play has no player on Windows, so play the WAV through .NET's SoundPlayer there.
const sent = async ($: any) => {
  const root: string = $.plugin.root
  try {
    if (/^[A-Za-z]:[\\/]/.test(root)) {
      const wav = `${root}\\sounds\\sent.wav`.replace(/\//g, '\\').replace(/'/g, "''")
      await $.process.run([
        'powershell',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(New-Object Media.SoundPlayer '${wav}').PlaySync()`,
      ])
    } else {
      await $.audio.play({ asset: 'sounds/sent.wav' })
    }
  } catch {
    // No sound is fine; the credits still roll.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'progress',
      description:
        "Report a wrap-up step to the That's a wrap bar above the prompt. Call it as each step starts and ends. " +
        'step: 0 Inventory, 1 Commit, 2 Check, 3 Docs & lessons, 4 Push & deploy, 5 Verify & clean up. ' +
        'status: running, done, skipped, waiting (stopped for the user), failed. note: a few words, e.g. why it was skipped. ' +
        'Step 0 running starts a new run and shows the bar.',
      inputSchema: {
        type: 'object',
        properties: {
          step: { type: 'integer', minimum: 0, maximum: 5 },
          status: { type: 'string', enum: STATUSES },
          note: { type: 'string' },
        },
        required: ['step', 'status'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'credits',
      description:
        "Roll the credits when a wrap-up is finished: plays a soft send sound and shows a summary in the That's a wrap bar above the prompt. " +
        'Each list holds short lines: commits ("abc1234 Add X"), pushed ("origin/main → abc1234"), deployed (URLs), open (what is left).',
      inputSchema: {
        type: 'object',
        properties: {
          commits: { type: 'array', items: { type: 'string' } },
          pushed: { type: 'array', items: { type: 'string' } },
          deployed: { type: 'array', items: { type: 'string' } },
          open: { type: 'array', items: { type: 'string' } },
        },
      },
      isDeferred: false,
    })

    return next(e)
  })

  on('tool.call', { tool: 'mcp__thats-a-wrap__progress' }, async ($, e) => {
    const input = e as unknown as { step?: unknown; status?: unknown; note?: unknown }
    const step = Number(input.step)
    const status = input.status as StepStatus
    if (!Number.isInteger(step) || step < 0 || step >= STEPS.length || !STATUSES.includes(status)) {
      return { result: 'Ignored: step must be 0-5 and status one of ' + STATUSES.join(', ') + '.' }
    }
    const note = typeof input.note === 'string' ? input.note.slice(0, 120) : ''
    const isNewRun = step === 0 && status === 'running'
    await update($, run, r => {
      const base = isNewRun ? fresh() : r
      const steps: Step[] = base.steps.map((s, i) => (i === step ? { status, note } : s))
      return { ...base, steps, isShown: isNewRun ? true : base.isShown }
    })

    return { result: `${STEPS[step]}: ${status}` }
  }).catch(() => ({ result: 'The bar could not be updated; carry on with the wrap-up.' }))

  on('tool.call', { tool: 'mcp__thats-a-wrap__credits' }, async ($, e) => {
    const input = e as unknown as Record<string, unknown>
    const credits: Credits = {
      commits: strings(input.commits),
      pushed: strings(input.pushed),
      deployed: strings(input.deployed),
      open: strings(input.open),
    }
    await update($, run, r => ({ ...r, credits, isShown: true }))
    void sent($)
    $.ui.toast("🎬 That's a wrap!")

    return { result: 'Credits rolled.' }
  }).catch(() => ({ result: 'The credits could not be shown; report in chat instead.' }))

  // A user prompt after the credits clears the band; a run still waiting keeps it.
  on('prompt.submit', async ($, e, next) => {
    await update($, run, r => (r.credits !== null && r.isShown ? { ...r, isShown: false } : r))

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, run)
    if (!r.isShown || e.props.hasSurvey) {
      return next(e)
    }

    // While a run is shown it takes the band alone; other plugins' part comes back once it clears.
    const { Box, Text } = $.ui.resolve(e)
    const c = r.credits
    const last = [...r.steps].reverse().find(s => s.status !== 'pending' && s.note !== '')
    const summary = c === null ? [] : [
      c.commits.length > 0 ? `${c.commits.length} commit${c.commits.length > 1 ? 's' : ''}` : '',
      ...c.pushed.slice(0, 1),
      ...c.deployed.slice(0, 1),
      c.open.length > 0 ? `${c.open.length} still open` : '',
    ].filter(x => x !== '')

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text>🎬</Text>
          {r.steps.map((s, i) => (
            <Text
              color={COLOR[s.status]}
              bold={s.status === 'running' || s.status === 'waiting'}
              dimColor={s.status === 'pending' || s.status === 'skipped'}
            >
              {MARK[s.status]} {SHORT[i]}
            </Text>
          ))}
          {c === null && last !== undefined && (
            <Text dimColor wrap="truncate">
              · {last.note}
            </Text>
          )}
        </Box>
        {c !== null && (
          <Box flexDirection="row" gap={1}>
            <Text bold color="claude">
              That's a wrap!
            </Text>
            <Text dimColor wrap="truncate">
              {summary.join(' · ')}
            </Text>
          </Box>
        )}
      </Box>
    )
  })

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

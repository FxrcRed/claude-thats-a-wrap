import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Credits, Run, Step, StepStatus } from '../types'

// Sends the trigger phrase of the wrap-up skill in this plugin.
const PROMPT = 'Wrap up'
const LABEL = "🎬 That's a wrap"
const PANE = 'thats-a-wrap'
const TITLE = "🎬 That's a wrap"

const STEPS = ['Inventory', 'Commit', 'Check', 'Docs & lessons', 'Push & deploy', 'Verify & clean up']
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
})
// Change the tag when Run's fields change: it declines what an older version stored.
const run = atom({ plugin: 'thats-a-wrap', key: 'run' } as const, fresh(), { shape: 'run-1' })

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
        "Report a wrap-up step to the That's a wrap pane. Call it as each step starts and ends. " +
        'step: 0 Inventory, 1 Commit, 2 Check, 3 Docs & lessons, 4 Push & deploy, 5 Verify & clean up. ' +
        'status: running, done, skipped, waiting (stopped for the user), failed. note: a few words, e.g. why it was skipped. ' +
        'Step 0 running starts a new run and opens the pane.',
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
        "Roll the credits when a wrap-up is finished: plays a soft send sound and shows what was done in the That's a wrap pane. " +
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
      return { ...base, steps }
    })
    if (isNewRun) await $.ui.open({ id: PANE, title: TITLE })

    return { result: `${STEPS[step]}: ${status}` }
  }).catch(() => ({ result: 'The pane could not be updated; carry on with the wrap-up.' }))

  on('tool.call', { tool: 'mcp__thats-a-wrap__credits' }, async ($, e) => {
    const input = e as unknown as Record<string, unknown>
    const credits: Credits = {
      commits: strings(input.commits),
      pushed: strings(input.pushed),
      deployed: strings(input.deployed),
      open: strings(input.open),
    }
    await update($, run, r => ({ ...r, credits }))
    await $.ui.open({ id: PANE, title: TITLE })
    void sent($)
    $.ui.toast("🎬 That's a wrap!")

    return { result: 'Credits rolled.' }
  }).catch(() => ({ result: 'The credits could not be shown; report in chat instead.' }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, run)
    const c = r.credits
    const section = (title: string, lines: string[]) =>
      lines.length === 0 ? null : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{title.toUpperCase()}</Text>
          {lines.map(line => (
            <Text>{line}</Text>
          ))}
        </Box>
      )

    return (
      <Box flexDirection="column">
        <Text dimColor>SCENE · WRAP-UP</Text>
        {r.steps.map((s, i) => (
          <Box flexDirection="row" gap={1}>
            <Text color={COLOR[s.status]} dimColor={s.status === 'pending' || s.status === 'skipped'}>
              {MARK[s.status]}
            </Text>
            <Text bold={s.status === 'running'} dimColor={s.status === 'pending' || s.status === 'skipped'}>
              {STEPS[i]}
            </Text>
            {s.note !== '' && <Text dimColor>{s.note}</Text>}
          </Box>
        ))}
        {c !== null && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="claude">
              🎬 That's a wrap!
            </Text>
            {section('Commits', c.commits)}
            {section('Pushed', c.pushed)}
            {section('Deployed', c.deployed)}
            {section('Still open', c.open)}
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

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Credits, Run, Step, StepStatus } from '../types'

// Sends the trigger phrase of the wrap-up skill in this plugin.
const PROMPT = 'Wrap up'
const LABEL = "🎬 That's a wrap"

const STEPS = ['Inventory', 'Commit', 'Check', 'Docs & lessons', 'Push & deploy', 'Verify & clean up']
const STATUSES: StepStatus[] = ['running', 'done', 'skipped', 'waiting', 'failed']
// One dot per step: hollow until reached, then filled.
const DOT: Record<StepStatus, string> = {
  pending: '○',
  running: '●',
  done: '●',
  skipped: '●',
  waiting: '●',
  failed: '●',
}
// How long the closing 🎬 line stays before the band goes back to other plugins.
const CLOSE_MS = 2000
// Every state the bar shows stays at least this long, so quick steps still register.
const MIN_MS = 700
// A running step's dot blinks at this rate; a waiting one is steady.
const BLINK_MS = 500
// The ring colours of usage-rings, so the two plugins read as one family.
const GREEN = '#34c759'
const ORANGE = '#ff9500'
const ORANGE_FADED = '#ffcf8a'
// A skipped step: a light grey dot, not the near-black dimColor gives a filled glyph.
const GREY = '#c7c7cc'
const COLOR: Partial<Record<StepStatus, string>> = {
  running: ORANGE,
  done: GREEN,
  waiting: ORANGE,
  skipped: GREY,
  failed: '#ff3b30',
}

const fresh = (): Run => ({
  steps: STEPS.map(() => ({ status: 'pending', note: '' })),
  credits: null,
  isShown: false,
})
// Change the tag when Run's fields change: it declines what an older version stored.
const run = atom({ plugin: 'thats-a-wrap', key: 'run' } as const, fresh(), { shape: 'run-2' })
const blink = atom({ plugin: 'thats-a-wrap', key: 'blink' } as const, true)
// usage-rings loads first and draws the band without passing it on; while a run is shown,
// its limits read as none, so it hands the band down to the bar.
const RINGS = { plugin: 'usage-rings', key: 'limits' } as const

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

// Updates wait their turn so each shown state lasts MIN_MS; the tool calls return at once.
const queue: { apply: (r: Run) => Run; then?: () => void }[] = []
let isPumping = false

async function pump($: any) {
  const item = queue.shift()
  if (item === undefined) {
    isPumping = false
    return
  }
  isPumping = true
  await update($, run, item.apply)
  item.then?.()
  $.clock.after(MIN_MS, () => void pump($))
}

async function hideUnlessCredits($: any) {
  if (queue.length > 0) return
  await update($, run, r => (r.credits === null && r.isShown ? { ...r, isShown: false } : r))
}

function show($: any, apply: (r: Run) => Run, then?: () => void) {
  queue.push({ apply, then })
  if (!isPumping) void pump($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(BLINK_MS, async () => {
      const r = await read($, run)
      if (r.isShown && r.credits === null && r.steps.some(s => s.status === 'running')) {
        await update($, blink, b => !b)
      }
    })
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
        "Roll the credits when a wrap-up is finished: plays a soft send sound and shows 🎬 That's a wrap! in the bar above the prompt for two seconds. " +
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
    const isEnd = step === STEPS.length - 1 && status !== 'running' && status !== 'waiting'
    show(
      $,
      r => {
        // Step 0 running, or any report while no run is on screen, starts a fresh run.
        const isNewRun = (step === 0 && status === 'running') || !r.isShown || r.credits !== null
        const base = isNewRun ? fresh() : r
        const steps: Step[] = base.steps.map((s, i) => (i === step ? { status, note } : s))
        return { ...base, steps, isShown: true }
      },
      // A run that ends without credits (nothing to ship) clears itself too.
      isEnd ? () => $.clock.after(CLOSE_MS, () => void hideUnlessCredits($)) : undefined,
    )

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
    show(
      $,
      r => ({ ...r, credits, isShown: true }),
      () => {
        void sent($)
        $.ui.toast("🎬 That's a wrap!")
        $.clock.after(CLOSE_MS, () => {
          void update($, run, r => (r.credits !== null ? { ...r, isShown: false } : r))
        })
      },
    )

    return { result: 'Credits rolled.' }
  }).catch(() => ({ result: 'The credits could not be shown; report in chat instead.' }))

  // A user prompt after the credits clears the band; a run still waiting keeps it.
  on('prompt.submit', async ($, e, next) => {
    await update($, run, r => (r.credits !== null && r.isShown ? { ...r, isShown: false } : r))

    return next(e)
  })

  on('state.get', RINGS, async ($, e, next) => {
    const got = await next(e)
    if (got.deny !== undefined || !(await read($, run)).isShown) return got
    return { value: { ...got.value, value: [] } }
  })

  // A write usage-rings makes meanwhile was worked out from that empty read: keep what it hid.
  on('state.set', RINGS, async ($, e, next) => {
    const { value, previous } = e
    if (!Array.isArray(value) || !Array.isArray(previous) || !(await read($, run)).isShown) return next(e)
    const kinds = new Set(value.map(l => l?.kind))
    return next({ ...e, value: [...value, ...previous.filter(l => !kinds.has(l?.kind))] })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, run)
    if (!r.isShown || e.props.hasSurvey) {
      return next(e)
    }

    // While a run is shown it takes the band alone; other plugins' part comes back once it clears.
    // Always one line: what does not fit is dropped from the right, then cut.
    const { Box, Text } = $.ui.resolve(e)
    const cols = e.props.bodyColumns ?? 80
    if (r.credits !== null) {
      return (
        <Text bold wrap="truncate">
          🎬 That's a wrap!
        </Text>
      )
    }

    const isLit = await read($, blink)
    const live = r.steps.findIndex(s => s.status === 'running' || s.status === 'waiting' || s.status === 'failed')
    const now = live >= 0 ? live : r.steps.map(s => s.status !== 'pending').lastIndexOf(true)
    const note = now >= 0 ? r.steps[now].note : ''

    return (
      <Box flexDirection="row" gap={1}>
        <Box flexDirection="row" flexShrink={0}>
          {r.steps.map(s => {
            const isDim = s.status === 'pending'
            const color = s.status === 'running' && !isLit ? ORANGE_FADED : COLOR[s.status]
            return (
              <Text color={isDim ? undefined : color} dimColor={isDim}>
                {DOT[s.status]}
              </Text>
            )
          })}
        </Box>
        {now >= 0 && cols >= 22 && (
          <Text bold wrap="truncate">
            {STEPS[now]}
          </Text>
        )}
        {note !== '' && cols >= 40 && (
          <Text dimColor wrap="truncate">
            · {note}
          </Text>
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

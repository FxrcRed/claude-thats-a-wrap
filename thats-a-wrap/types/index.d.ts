export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'waiting' | 'failed'
export type Step = { status: StepStatus; note: string }
export type Credits = {
  commits: string[]
  pushed: string[]
  deployed: string[]
  open: string[]
}
export type Run = { steps: Step[]; credits: Credits | null; isShown: boolean }

declare module 'claude-code' {
  interface PluginState {
    'thats-a-wrap': { run: Shaped<Run> }
  }
}

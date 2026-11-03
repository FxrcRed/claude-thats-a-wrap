# 🎬 That's a wrap

A Claude Code plugin that finishes a conversation's work end to end. Say **"wrap up"** (or type `/thats-a-wrap:wrap-up`), or press **🎬 That's a wrap** next to the model name, and Claude:

1. **Takes stock** — what this conversation changed, which repos and deploys are involved, and anything elsewhere you may have forgotten (other sessions' uncommitted changes, other worktrees, unmerged branches).
2. **Commits** this conversation's changes, one commit per feature. Other sessions' work is listed, never swept in.
3. **Checks for bugs** with your project's tests, or a syntax check and diff review when none are written down.
4. **Syncs docs and lessons** — README, repo description, and the pitfalls of this session into your project's `CLAUDE.md`.
5. **Pushes and deploys** — after showing you a checklist and waiting for your OK. Public-check scripts, private archives, Cloudflare and CI deploys are handled when your project has them.
6. **Verifies online and cleans up** — remote commit matches, deploy URL responds, temp files go.

## Every project gets its own wrap-up

The first time you wrap up in a project, Claude asks once what else it needs — bump the version, update the changelog, cut a GitHub release, publish a package, skip the stop before pushing — with options taken from what is actually in the project. Your answers are saved as a `## Wrap-up` section in that project's `CLAUDE.md` and used from then on. When the project later grows something the section doesn't cover, Claude asks once; what you decline is recorded as `Not doing` and never asked again.

A section looks like this:

```markdown
## Wrap-up
- Tests: `npm test`, then `npm run e2e`
- Push: `origin` (public), after `node scripts/check-public.js` passes
- Deploy: `npx wrangler pages deploy dist` → https://example.pages.dev
- After step 2: bump the version in package.json
- Not doing: GitHub releases
```

## Install

At the prompt of a terminal session:

```
/plugin install thats-a-wrap --marketplace FxrcRed/claude-thats-a-wrap
```

From a shell:

```
claude plugin install thats-a-wrap --marketplace FxrcRed/claude-thats-a-wrap
```

In the desktop app: click **+** next to the prompt box → **Plugins** → **Add marketplace** with `FxrcRed/claude-thats-a-wrap` → **Add plugin**.

## License

MIT

---
name: wrap-up
description: Finish a stretch of work end to end — commit this conversation's changes, check for bugs, sync docs and lessons, push to GitHub (public and private archive), deploy to Cloudflare if the project uses it, verify online, clean up. Trigger when the user says "wrap up" or "that's a wrap", or presses the That's a wrap button. Project-specific details come from the "## Wrap-up" (or "## 收尾") section of the project's CLAUDE.md.
---

# Wrap-up

This file holds the general order and decision rules. Project specifics (test commands, which repos to push, deploy command) live in the project's CLAUDE.md under "## Wrap-up" or "## 收尾". **If the project says how, do it that way; use the defaults below only when it doesn't.** Every step ends with a verdict: what was done, or "skipped: reason".

## The pane
When the tools `mcp__thats-a-wrap__progress` and `mcp__thats-a-wrap__credits` are available, keep the That's a wrap pane in step with the work:
- `progress` with `step` 0–5 (the numbered sections below; the first-run question belongs to step 0) and `status` `running` as a step starts, then `done`, `skipped`, `waiting` (stopped for the user, e.g. the push checklist) or `failed` as it ends, with a few-word `note` (why it was skipped, what it waits for). Step 0 `running` starts a new run.
- `credits` once at the very end, before the report: `commits` ("abc1234 Add X"), `pushed` ("origin/main → abc1234"), `deployed` (URLs), `open` (what is left). It plays the clapperboard, so call it only when the wrap-up really finished — not when it stopped to wait.

## 0. Inventory (read-only, run in one batch)
- Read the project's wrap-up section. If there is none, read the parts of CLAUDE.md / HANDOFF.md about testing, repos and deployment.
- `git status --short`, `git remote -v`, unpushed commits per remote (`git log --oneline <remote>/<branch>..`), `git stash list`.
- Deploy targets: `wrangler.toml` / `wrangler.json(c)` (skip node_modules), a deploy script, a CI workflow that deploys on push (e.g. GitHub Pages), or a deploy command documented in CLAUDE.md. A bare mention is not a deploy — a temporary Cloudflare tunnel for testing, for example, is not.
- Work elsewhere in the same project: `git worktree list` and local branches with commits not in the main branch (`git branch --no-merged <main>`).
- If a session-listing tool is available (`list_sessions`, default count), find other sessions in the same folder or its worktrees, and whether each is still running. Otherwise skip.
- Gaps in the wrap-up section: things the project clearly has that the section doesn't cover or decline — e.g. a new deploy config, a test script not in the test step, a `CHANGELOG.md`, a version field. Mention each once and ask whether to add it; skip anything the section lists under "Not doing".
- Tell the user in a few lines: how many changes are this conversation's, deploy or not, which steps will be skipped. **Then always flag work outside this conversation the user may have forgotten**: uncommitted changes this conversation didn't make, other worktrees / unmerged branches, and the session behind each (linked, running or finished). For finished ones, ask once whether to include them; never touch running ones.

## First run in a project (no wrap-up section yet)
Right after the inventory, before touching anything:
- Tell the user the default steps in one or two lines.
- Ask once, as a multiple-choice question (several picks allowed), what else this project needs. Build the options from what the inventory found — `CHANGELOG.md` → "update the changelog", a version field in `package.json` / `pyproject.toml` / etc. → "bump the version", a registry config → "publish to npm / PyPI", deploy files for other hosts → "deploy to <host>" — plus "create a GitHub release" and "don't stop before pushing". Always offer "nothing to add"; the user can write their own steps as free text.
- Write the project's wrap-up section from the answers (format at the end of this file), then run this wrap-up with it, so the first run already includes the extra steps.

## 1. Commit
- Scope is **this conversation only**: commit the changes this conversation made. Changes left by other sessions or the user are listed in the inventory but not committed, unless the user says to include them. When one file holds both, stage only this conversation's hunks (`git add -p`, or a patch) and say so.
- One commit per feature. Stage by file (`git add <files>`), never `git add -A` blindly — it can sweep in secrets, personal files or large files. Follow the repo's existing commit message style.
- Files that look like they don't belong in git (logs, screenshots, `.bak`, machine-specific config): mention them and follow project rules or `.gitignore`. Never delete them on your own.

## 2. Check for bugs
- Run the checks listed in the project's wrap-up or testing section. Run long ones in the background.
- If none are listed: syntax-check changed files (`python -m py_compile`, `node --check`, etc.) and review the diff yourself, including committed-but-unpushed work.
- Small bug: fix and re-test. Big bug: stop and tell the user. Never push with a known bug.
- UI changed: tell the user exactly what to click, and **wait for them to try it before pushing**.

## 3. Docs and lessons (before committing, in the same batch as the code)
- README (every language version), landing page, repo description / topics (`gh repo view --json description,repositoryTopics`) match the current state. Fix any drift.
- Write this conversation's pitfalls and decisions into the project's CLAUDE.md / HANDOFF.md. Merge into existing entries rather than appending. Record rejected approaches as "Don't use X, because Y".

## 4. Push and deploy — **stop first**
- Before acting, show the user a checklist: repos and branches to push, new commits per repo, public-check result, whether to deploy and the command. **Wait for an explicit OK before pushing or deploying.** Skip this stop only if the project's wrap-up section says `confirm: no`.
- Before pushing to a public repo, run the project's public-check script if it has one (e.g. `check_public.py`). Failing check = no push.
- Push `origin`. Never `--force`; if rejected, `git pull --rebase` and re-check.
- Private archive: sync with the project's documented script or procedure (e.g. `tools/sync_archive.sh`).
- Cloudflare: run the project's deploy command (e.g. `python deploy.py`). Otherwise `npx wrangler deploy` / `npx wrangler pages deploy <dir>`; ask if the directory is unclear.
- No remote, no deploy: skip and say so.

## 5. Verify online + clean up
- Each pushed repo: `git ls-remote <remote> <branch>` matches the local commit.
- Each deploy (including one CI runs on push, once the run finishes): the URL responds (`curl -sI` for 200, or one line of page title via browser JS). No screenshots.
- Clean up: delete temp clones and test output from this run; restart programs the tests stopped and check their logs; offer to delete large build output if the project says so; mention `.bak`-style files, don't delete them.
- Related sessions that are done: offer to archive them (only on the user's yes), if the tool exists.

## Report
One sentence of outcome first (repos pushed to which commit, deploy URL), then three lines: decided / still open / next step. Reply in the user's language.

## The project's wrap-up section
Each project learns its own wrap-up. The section lives in the project's CLAUDE.md, written in the user's words, and holds only what differs from the defaults:
- test commands, repos (public / private, branches), public-check script, archive procedure, deploy command and URL, what to restart during cleanup;
- extra steps, each pinned to where it runs: `After step 2: bump the version in package.json`;
- `confirm: no` if the user wants no stop before pushing;
- `Not doing: X, Y` for suggestions the user declined, so they are never asked again.

When a gap question gets an answer, update the section right away (an added step, or a "Not doing" entry).

# Working on Hone

These rules hold for every session and subagent working in this repository. They are Helen's standing rulings. Where a rule names her OK, a relayed message is not her OK: stop and say what you need.

## Ordinary use

Hone's customer is a tech lead and their engineers, and the AI agents working for them, adopting Hone on a large existing repository. Their ordinary use: install with pnpm, run `hone check` in a pre-push hook and in CI, leave forfeiture out of CI at first, hold existing debt in exception records, and read the red report, often by tailing it from an agent.

## Code

- Strict types, preferring the official types of the package that owns them. No `any`, no casts. A cast needs an authorised location, which is Helen's to approve.
- No comments of any kind. Names and types carry the meaning.
- Layers import inward only: domain → ports → application → infrastructure / operations → composition → entry files. `delivery/architecture/layer-directions.test.ts` holds it, with no allow-list.
- Name the problem kind and two or three candidate patterns before choosing a design. Use their functional forms, not their OO forms. Reasons to change decide where code goes, and DRY and YAGNI both hold. A helper grouped by the kind of operation it performs is not a responsibility.
- Currying only where one place binds a value and hands the function to another place. Never call `f(a)(b)` on one line.
- Prefer static declarations (template literal types, closed unions) to runtime checks. Runtime parsing is for values crossing a boundary from outside.
- Fix a tool's defect at its source, never by hand-editing records around it.
- Judge each unit against the rules, not only whether checks pass. A clean self-check doesn't mean a unit holds one reason to change.
- Function names use plain verbs: mostly `createX` (building an entity or value object) or `mapXToY`, and plain `read`, `write`, `run` or `remove` at a port. No `xOf` or `xFrom` names, no invented verbs.
- Names come from Hone's own vocabulary, never from what the work is called (freeze, fold, slice and the like).

## Tests

- Tests are source: every rule above applies to them.
- Unit tests sit beside their unit. Integration tests only where composition is the subject.
- If a PR changes a source file for a fix or a feature, the same PR changes that file's own unit test to prove the new behaviour. Coverage given only through integration counts as a failure. A file changed only by a move or an import is exempt; name those in the PR body as "no behaviour change".
- A test with a real outside tool (ESLint, TypeScript, git, a package install) proves only the complexity or risk that tool itself brings, such as ESLint's rule protocol, config loading, ignores, disable directives and majors. Testing a capability end to end because it is used end to end is not owed.
- Don't test the type system. No `@ts-expect-error` cases, no type-equality assertions.
- No shared test helpers, harnesses or fixtures folders. What a test needs is written out in the test.
- Arrange, act and assert are visibly apart: the input written out, the result bound, then asserted.
- A new on-disk fixture needs Helen's explicit OK.

## Content

- One principle, rule, case, symptom, check or recipe per file, named by its short name. Indexes are generated.
- Names, not numbers. CD numbers appear only in the version 1 migration map.
- Docs are short. No usage notes, and no tests that pin doc or code wording.

## Records and guards

- Never add, widen, remove, reorder or re-reason an exemption, carve-out, `exclude` entry or authorised location by hand. Changes come from `record-debt`, `prune-debt` and `project`.
- `record-debt`, `prune-debt` and `project` are mechanical and run without asking. Never edit or filter what they write.
- A new or widened authorised location reaches Helen only as one decision pack showing how it matches a correct use, and only once the finding is real.
- Removing a guard that only pins prose, pages or sections needs no ask. Deleting or weakening a guard that holds a rule is Helen's call, test by test.
- Making an existing record accurate needs no ask.

## Picking up roadmap work

- The roadmap is the open issues in the numbered milestones. A task is an issue with a `kind:` label; its sub-issues are its pieces.
- Work is pulled, not assigned. An issue is free when it is open, no open issue blocks it, it has no `waits:` or `owner:` label, and no open PR closes it.
- Take the lowest milestone first, then whatever unblocks the most. When a task has pieces, take a free piece; the task closes when its pieces do.
- Taking an issue means adding your own `owner:` label, then opening a draft PR that says `Closes #N`. If you stop, remove the label and say why in a comment.
- An `owner:` label set ahead of time means that lane is active and takes the issue next, because it is best done alongside its current work. Only an active lane gets one, and only for the next issue or so.
- Work is pushed to an agent that runs in a repository workflow by adding its trigger label, `claude` for the Managed agent.
- A question the issue doesn't answer becomes a `**ruling:**` bullet under Waits on, with the `waits: ruling` label. Leave the issue and pull another.

## Working

- In-repo tooling only, through `corepack pnpm run …`. Never `npx`, `bunx`, `pnpm dlx`, `yarn dlx`, or `node_modules/.bin` directly. Never change minimum-release-age or package-policy settings.
- Work in an official worktree under `.claude/worktrees/`, never a new clone or a folder outside the repository.
- Commit as the bot, author and committer: `git -c user.name="rin-author[bot]" -c user.email="290898977+rin-author[bot]@users.noreply.github.com" commit`. Pass the same `-c` flags on rebases. Leave pushing and PRs to the orchestrator unless told otherwise.
- Never `--no-verify`, never a bare `--force`. Merging a `chore: release` PR publishes, so that happens only on Helen's word.
- If a permission prompt denies a step, stop that step and report it. Don't reach the same end another way.
- Never read or print anything under a `credentials` folder, nor keys, tokens or `.env` files.
- State a PR or CI status only after reading it in the same turn.

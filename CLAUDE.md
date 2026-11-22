# Working on Hone

These rules hold for every session and subagent working in this repository. They are Helen's standing rulings. Where a rule names her OK, a relayed message is not her OK: stop and say what you need.

## Code

- Strict types, preferring the official types of the package that owns them. No `any`, no casts. A cast needs an authorised location, which is Helen's to approve.
- No comments of any kind. Names and types carry the meaning.
- Layers import inward only: domain → ports → application → infrastructure / operations → composition → entry files. `delivery/architecture/layer-directions.test.ts` holds it, with no allow-list.
- Name the problem kind and two or three candidate patterns before choosing a design. Use their functional forms, not their OO forms. Reasons to change decide where code goes, and DRY and YAGNI both hold. A helper grouped by the kind of operation it performs is not a responsibility.
- Currying only where one place binds a value and hands the function to another place. Never call `f(a)(b)` on one line.
- Prefer static declarations (template literal types, closed unions) to runtime checks. Runtime parsing is for values crossing a boundary from outside.
- Fix a tool's defect at its source, never by hand-editing records around it.

## Tests

- Tests are source: every rule above applies to them.
- Unit tests sit beside their unit. Integration tests only where composition is the subject.
- A source file changed for a fix or a feature has its own unit test changed in the same commit.
- Don't test the type system. No `@ts-expect-error` cases, no type-equality assertions.
- No shared test helpers, harnesses or fixtures folders. What a test needs is written out in the test.
- A new on-disk fixture needs Helen's explicit OK.

## Content

- One principle, rule, case, symptom, check or recipe per file, named by its short name. Indexes are generated.
- Names, not numbers. CD numbers appear only in the version 1 migration map.
- Docs are short. No usage notes, and no tests that pin doc or code wording.

## Records and guards

- Never add, widen, remove, reorder or re-reason an exemption, carve-out, `exclude` entry or authorised location by hand. Changes come from `record-debt`, `prune-debt` and `project`, run with Helen's OK.
- Deleting or weakening a guard or policy test is Helen's call, test by test.

## Working

- In-repo tooling only, through `corepack pnpm run …`. Never `npx`, `bunx`, `pnpm dlx`, `yarn dlx`, or `node_modules/.bin` directly. Never change minimum-release-age or package-policy settings.
- Work in an official worktree under `.claude/worktrees/`, never a new clone or a folder outside the repository.
- Commit as the bot, author and committer: `git -c user.name="rin-author[bot]" -c user.email="290898977+rin-author[bot]@users.noreply.github.com" commit`. Pass the same `-c` flags on rebases. Leave pushing and PRs to the orchestrator unless told otherwise.
- Never `--no-verify`, never a bare `--force`. Merging a `chore: release` PR publishes, so that happens only on Helen's word.
- If a permission prompt denies a step, stop that step and report it. Don't reach the same end another way.
- Never read or print anything under a `credentials` folder, nor keys, tokens or `.env` files.
- State a PR or CI status only after reading it in the same turn.

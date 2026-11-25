# Migrating from the standalone copy route

This page moves a repository from the older standalone route, which copied rule files into a harness folder and wired selected linter rules by hand, to Hone. Follow the steps in order. Every command is run from the repository root. Stop at any "stop and ask" line and hand the question to the human; do not guess past it.

A repository already on Hone, or on discipline Hone before the rename, whose exceptions predate causal why-chains needs only [section 8](#8-moving-to-causal-why-chains). One that wants its records kept in a file for each rule and kind needs only [section 16](#16-moving-to-the-split-layout).

## 1. Detect the old install

Look for each of these and write down what you find:

| What | Where | Example |
| --- | --- | --- |
| Copied rule files | `.claude/`, `.codex/` or `.cursor/` under `knowledge/aidlc-shared/code-discipline/` | `.cursor/knowledge/aidlc-shared/code-discipline/cd-001-no-any.md` |
| Copied guides | the same folder | `standalone-adoption.md`, `standalone-cd-inventory.md`, `standalone-linter-options.md` |
| Copied tools tree | `.claude/tools/`, `.codex/tools/` or `.cursor/tools/` | `.cursor/tools/rin-harness-constitution-audit.ts` |
| Tool config | repository root | `harness.config.json` |
| Settings in the tool's own code | the copied tools tree, or rin's walker | a list of confined packages, or of files it skips (step 2a) |
| Debt records | repository root | `.constitution-carve-outs/cd-<id>.json` |
| Structural records | repository root | `.constitution-authorised-locations/cd-<id>.json` |
| Hand-written linter rules | `biome.json`, `eslint.config.*`, `.oxlintrc.json` | `noExplicitAny`, `@typescript-eslint/no-explicit-any`, `typescript/no-explicit-any` |
| Compiler flags | every `tsconfig*.json` | the seven strict flags behind [Strictness weakened](rules/typescript/symptoms.md#strictness-weakened) |
| Scripts and hooks | `package.json` scripts, CI workflow, pre-push hook | `bun .cursor/tools/rin-harness-constitution-audit.ts`, `rin-harness-carve-out-decay.ts`, `rin-harness-hermetic-git-guard.ts` |
| Agent instructions | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, an adoption record | "read the selected discipline files before editing" |

The chosen disciplines are the `cd-NNN-*.md` files that were copied (the old quick start copied three: `any`, compiler strictness and debt decay), plus any old rule a record file names.

An old rule that a record file names but whose rule file was not copied is expected: select it in step 2 like the others. Stop and ask the human only if [Every numbered discipline](rules/numbers.md#every-numbered-discipline) has no row for it.

Old code often holds `any` ([Untyped value](rules/typescript/symptoms.md#untyped-value)) the old route never checked. Hone flags it in step 3; it is new debt, so fix it or record it only after the human approves (step 3), and any further `any` still fails.

## 2. Install Hone and select the clauses

Do [ADOPTING.md](ADOPTING.md) steps 1, 2 and 4 (and 4a for any `eslint` clause). A repository that used only Biome has no `eslint.config.*`. If it selects any clause through `eslint`, create `eslint.config.mjs` as step 4a shows before the first check, or the check stops with `runner-failed eslint team-config-unloadable`. If it lists every ESLint clause as `"not-run"` or `"not-adopted"`, it needs no ESLint config and no ESLint installed. Leave the old files in place until step 6.

Map each chosen discipline to its clauses with this table. A discipline is adopted whole: select every mechanical clause it lists, or the check reports the rest as `uncovered`. Where the rule binds but a clause's mechanism cannot work in this repository, such as an ESLint-only clause with no ESLint installed, list that clause as `"not-run"`; where the rule does not apply at all, list it as `"not-adopted"`. [ADOPTING.md](ADOPTING.md#4-write-honeconfigjson) step 4 sets out the clause values and the three declared states.

Find each old rule's number in [Every numbered discipline](rules/numbers.md#every-numbered-discipline), the one page that maps old numbers to names, and select every mechanical clause its row lists, each with a mechanism its check page lists. Four kinds of row need more:

- The compiler strictness discipline ([Strictness weakened](rules/typescript/symptoms.md#strictness-weakened)): select all seven of its clauses through `audit`, then move the flags out of `tsconfig.json` (step 4).
- The debt decay discipline (touching a carved-out file revokes its carve-out): nothing to select. [Forfeiture](rules/records.md#debt) applies to every file carve-out once the check runs with `--base-revision`.
- A row whose clauses say "see" another discipline: select that discipline's clauses.
- An old rule with no row: it is not in Hone; keep its current handling.

Clauses whose mechanism is `review` are judgement clauses: do not put them in `disciplines.json`; list them in the agent instructions instead (step 6).

Stop and ask the human if a chosen old rule has no row on that page, or if selecting a whole discipline adds clauses the old route never checked and the first run shows findings for them: they decide whether to fix those findings, carve them out (step 3, where `hone record-debt` can write the records), or not adopt that discipline yet.

### 2a. Carry over the old route's settings

Do this before step 3, and before you delete any record Hone lists as `stale`. The old tool kept settings in `harness.config.json` and in its own code, and Hone reads neither. A setting left behind stops a boundary being checked without any finding to show it: the old records for it exempt nothing, Hone lists them as `stale`, and deleting them drops the boundary.

| Old route | Where to look | In Hone |
| --- | --- | --- |
| Packages confined to wrapping files | a list in the tool's code or its config. Rin's walker holds it as `BANNED_THIRD_PARTY_IMPORTS`: search its tools folder for that name, since an installed copy keeps it in `constitution-audit/audit-constitution.runtime.js`, and its `audit-constitution.ts` only re-exports that file | `confinedPackages` for `CD-19#import-boundaries` under `clauseSettings` in `disciplines.json`. Hone confines no package by default, so until you list them `outside-import-past-a-boundary#import-or-require` flags only `node:` imports. `outside-import-past-a-boundary#import-or-require` is the check's name, given for reading: today's tool neither accepts nor prints a check's name, so write and expect the clause address; check names become typeable in 2.0. A package covers its subpaths, as its check page, `rules/typescript/symptoms/outside-import-past-a-boundary/import-or-require.md`, says under Flags, where the old walker matched each listed name exactly, so Hone can flag a subpath import the old list did not name. |
| Scope | `constitution.include` and `constitution.exclude` in `harness.config.json` | `exclude` in `disciplines.json`, as [ADOPTING.md](ADOPTING.md#4-write-honeconfigjson) step 4 says. Hone has no include list and no globs: list each folder or file outside the old scope as an exact path. |
| Rules relaxed by folder | `scriptGlobs`, `uiGlobs` or similar in `harness.config.json` | nothing. Hone has one selection for the whole repository. What those folders fail under the full rules is existing debt: fix it or record it in step 3. There is no old record to import it from, so once the human approves recording it, `hone record-debt` writes the records (step 3). Do not exclude the folders to hide it. |
| Files the tool skipped in its own code | a list such as `SELF_AUDIT_EXCLUDED_FILENAMES` | an `exclude` entry or an exception record for each file. Stop and ask the human which, and why. |

A `stale` record on `CD-19#import-boundaries` (`outside-import-past-a-boundary#import-or-require`) right after the move usually means the confined list was not carried over. Fix `confinedPackages` and run the check again before deleting anything.

## 3. Convert the old records into exceptions

Do step 2a first. Then run the check once with no exceptions file, to see what Hone finds:

```bash
npm run --silent hone:check
```

Findings of the strict-flag checks ([Strictness weakened](rules/typescript/symptoms.md#strictness-weakened)) on `tsconfig.json` are fixed in step 4, not recorded. Then write `discipline-exceptions.json` from the old records, using the format in [README.md](README.md#hone-records):

An old record file is a JSON array of entries, each listing one or more files:

```json
[
  {
    "files": ["src/legacy.ts", "src/legacy-report.ts"],
    "reason": "Inherited for...of totals loop from the 2025 pricing import",
    "decision": "Initial adoption inventory accepted by pricing owner Sam on 2026-09-02; retire on touch"
  }
]
```

- Each file in a `.constitution-carve-outs/cd-<id>.json` entry that Hone now flags becomes one `file-carve-out`: `clause` is the clause the finding names (for example `CD-15#loops` (`loop-keyword#loop-statement`)), `file` is the exact path. Two flagged files in one entry become two records with the same `source`.
- Each file in a `.constitution-authorised-locations/cd-<id>.json` entry that Hone now flags becomes one `authorised-location`.
- A listed file Hone does not flag gets no record: a record that exempts nothing is reported `stale` and fails the run. Before you drop one, check step 2a: a file Hone does not flag only because a setting was left behind still needs its record.
- A finding in a file no old record lists is new debt: fix it, or record it only after the human approves.

Each converted record is imported: give it `provenance` naming the old record instead of a `whyChain`, and keep the old `reason`. This one holds debt on the clause of `loop-keyword#loop-statement`:

```json
{
  "kind": "file-carve-out",
  "clause": "CD-15#loops",
  "file": "src/legacy.ts",
  "reason": "Inherited for...of totals loop from the 2025 pricing import",
  "provenance": {
    "kind": "inherited-debt",
    "source": ".constitution-carve-outs/cd-15.json#0",
    "decision": "Initial adoption inventory accepted by pricing owner Sam on 2026-09-02; retire on touch"
  }
}
```

`source` is the old file and the entry's position in its array, counting from `0`, so both files in the example above use `.constitution-carve-outs/cd-15.json#0`. An authorised location uses `{ "kind": "existing-authorisation", "source": ".constitution-authorised-locations/cd-<id>.json#<index>" }`. Hone accepts an imported record only while the `--base-revision` holds it unchanged or its `source` entry lists the record's file at that revision, so keep the old record files committed until step 6, and run every check in this migration with `--base-revision HEAD`. An imported record you later change needs a full `whyChain` that follows the [why-chain contract](docs/why-chain-contract.md), or, for a `file-carve-out`, no `provenance` at all: Hone refuses it as `import-unverified` otherwise. A `file-carve-out` is debt, so a record you write for new debt needs only its clause and file, with no `whyChain` and no `provenance`; a `reason` is an optional note. An `authorised-location` you write needs a `whyChain`; a repository whose `disciplines.json` sets `"fileExceptionWhyChains": "optional"` may give one only its `reason`.

An imported `file-carve-out` needs a `decision`: copy the old entry's. If the old entry has none, stop and ask the human who accepted the debt. An imported `authorised-location` needs no `decision`: copy the old entry's if it has one, otherwise give `kind` and `source` only. Never write a placeholder or a root cause that only says the check was failing: Hone refuses those as `invalidRecords`.

Once the old records are converted, what is left is debt no old record covers: findings in a folder whose relaxed rule set was not carried over (step 2a), clauses the old route never checked, and inline disables or `@ts-expect-error` directives the old tool accepted ([section 14](#14-moving-to-recorded-inline-exceptions)). When the human approves recording it, run, with one `--leave` for each file the human decided is a permanent exception:

```bash
npm run --silent hone:record-debt -- --base-revision origin/main --leave <path>
```

where the root `package.json` has `"hone:record-debt": "hone record-debt --repo ."`. With pnpm the options follow the script name directly.

Give it the branch's base, `origin/main`, not `HEAD` as this migration's other checks do: after step 6 the pre-push hook and CI assess decay against that base, so a record for a file this branch edits passes a check against `HEAD` and is forfeited there. Finish each file the migration edits, as [ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a point 3 says, and confirm with `npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main`, which assesses decay in that run whatever `assessment.forfeiture` says. Before you run it, put every pre-push hook, CI job and other machine that runs the check on this release or later: the records it writes give no `reason`, and a Hone from before file carve-outs could leave out `reason` stops with `load failure: file-malformed` on them. It adds a `file-carve-out` naming only its clause and file for each clause and file that no converted record holds, and leaves the converted records as they are. A converted record still holds its pair, so the command reports it `already-recorded` only if the check does not accept it; fix that record rather than adding another. [ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a says how to read its output and review the result.

## 4. Replace the hand-written linter rules

The ESLint projection from step 2 now carries every `eslint` clause. Remove only the rules the old route added for the disciplines; keep every other rule the repository uses:

- `biome.json`: remove `suspicious.noExplicitAny` and `suspicious.noImplicitAnyLet`. If nothing else in the file was added for the trial, remove the file, the `@biomejs/biome` dev dependency the old quick start installed and the `package.json` script that ran `biome lint` (step 6 replaces it); otherwise keep it for its other rules.
- `eslint.config.*`: remove `@typescript-eslint/no-explicit-any` (and any other rule the old route added for a CD), and spread the projection last as [ADOPTING.md](ADOPTING.md#4a-set-up-eslint-for-eslint-checks) shows.
- `.oxlintrc.json`: remove `typescript/no-explicit-any`; remove the file if it held nothing else.
- Compiler strictness ([Strictness weakened](rules/typescript/symptoms.md#strictness-weakened)): Hone flags any of the seven strict flags written in a file named `tsconfig.json`, even when it is `true`, because the flags must be inherited, never set per project. Move them from every `tsconfig.json` into one shared base file with another name, for example `tsconfig.base.json`, and make each `tsconfig.json` extend it (`"extends": "./tsconfig.base.json"`). Keep every other compiler option where it is. Then run the repository's own typecheck, which must still pass.

Then re-run `hone:project` and the check. With any `file-carve-out` recorded, pass `--base-revision`: without it Hone cannot tell whether a carved file was touched, reports `forfeiture-unmeasured` and fails. Locally, `HEAD` measures what is already committed:

```bash
npm run --silent hone:project
npm run --silent hone:check -- --base-revision HEAD
```

With pnpm, options go straight after the script name:

```bash
pnpm run --silent hone:project
pnpm run --silent hone:check --base-revision HEAD
```

Stop and ask the human if a rule you are about to remove was there before the trial, or if you cannot tell which rules the trial added (the adoption record or `git log -p -- biome.json` usually says).

## 5. Prove the migration

Prove one failure per mechanism, then the correction. Create these two files, stage them (only tracked files are checked), and run the check with `--base-revision HEAD`:

```ts
// src/discipline-probe-loop.ts
export const probeTotal = (prices: readonly number[]): number => {
  let sum = 0;
  for (const price of prices) {
    sum += price;
  }
  return sum;
};
```

```ts
// src/discipline-probe-any.ts
export const probeValue: any = 1;
```

```bash
git add src/discipline-probe-loop.ts src/discipline-probe-any.ts
npm run --silent hone:check -- --base-revision HEAD
```

With pnpm, run the check as `pnpm run --silent hone:check --base-revision HEAD`.

It must print a `CD-15#loops audit` finding (`loop-keyword#loop-statement`) and a `CD-1#explicit-any eslint` finding (`untyped-value#explicit-any`), then `verdict: fail`, and exit `1`. Use a selected clause in place of either if the repository did not adopt it. Then remove both files (`git rm -f src/discipline-probe-loop.ts src/discipline-probe-any.ts`) and run the check again: it must print `verdict: pass` and exit `0`.

To see debt decay, change one line in a carved file, stage it and run the check: the record moves to `forfeited` and the run fails. Restore the file afterwards (`git restore --staged --worktree <file>`). Records `hone record-debt` wrote decay the same way as converted ones.

Stop here, do not remove anything, and ask the human if the check does not pass.

## 6. Remove the old route and repoint everything

Only after step 5 passes:

1. Delete the copied rule files and guides from step 1's harness folder (`.cursor/knowledge/aidlc-shared/code-discipline/` or its `.claude`/`.codex` equivalent).
2. Delete the copied tools tree and `harness.config.json`, unless anything else in the repository uses them. A repository that also runs the rin AIDLC plugin keeps `harness.config.json`, and in this same change sets `"constitution": { "engine": "hone", "baseRevision": "origin/main" }` in it. Otherwise rin's stage gate, sensors and review lenses keep running the old walker over the old records, and they refuse what this check passes. A rin plugin from before the rename refuses `"hone"` and takes `"discipline-core"`. Set `baseRevision` whenever a file carve-out or an imported entry exists.
3. Delete the old record files, `.constitution-carve-outs/cd-<id>.json` and `.constitution-authorised-locations/cd-<id>.json`: their content now lives in `discipline-exceptions.json`. To keep a file for each rule and kind, as those folders did, move to the split layout in a later change, as section 16 says. Leave any other file in those folders, and the folder that holds it: another tool, such as a hook, may read it.
4. In `package.json` scripts, CI and the pre-push hook, replace the old tool commands with the Hone check, as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows. Every run needs `--base-revision` while a file carve-out exists, unless it leaves forfeiture to another run as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows, and a run with imported records needs it in any case: in local scripts and the pre-push hook use the branch's base (`origin/main`, or `HEAD` to measure only uncommitted changes); in CI use the pull request's base commit. A run that leaves forfeiture to another run ends `verdict: pass (partial assessment)` or `verdict: fail (partial assessment)`, so a hook or gate that matches `verdict: pass` or `verdict: fail` at the end of the line reads neither; see the warning in [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5.
5. Rewrite the agent instructions to point at `node_modules/@hailstails/hone/rules/` and the judgement rules, as ADOPTING step 5 and step 9 say, and remove any instruction to read the old copied files.
6. Run the check and the repository's own validation command again, then commit everything in one change.

Stop and ask the human if anything outside the old trial uses the copied tools or `harness.config.json`.

## 7. Known differences

| | Old route | Hone |
| --- | --- | --- |
| What is installed | rule text only; checks were the repository's own linters, plus an optional copied tools tree | one package that runs every selected check |
| Selection | whole CD files, read by an agent; a check ran only if wired by hand | clauses in `disciplines.json`; every mechanical clause of an adopted discipline must be selected |
| First-adoption debt | inherited debt could be recorded without a why-chain | imported with `provenance` and no `whyChain`, accepted only while unchanged since `--base-revision`; a `file-carve-out` is debt and needs only its clause and file; a new or edited `authorised-location` or `clause-wide-carve-out` needs a causal five-step `whyChain` ([contract](docs/why-chain-contract.md)) |
| `any` ([Untyped value](rules/typescript/symptoms.md#untyped-value)) | no exemptions | exempted like every other discipline, so existing `any` debt can be recorded |
| Strict compiler flags | merged into the shared `compilerOptions`, wherever they were | set only in a base file not named `tsconfig.json`; any of the seven in a `tsconfig.json` is a finding |
| Running with debt | the decay check needed a base ref | every run with a file carve-out needs `--base-revision`, unless it sets forfeiture `elsewhere`; every run with imported or legacy-chain records needs it either way |
| Debt decay ([forfeiture](rules/records.md#debt)) | optional `rin-harness-carve-out-decay.ts` run | built into every check run with `--base-revision` |
| Stale and unrecorded exceptions | not checked | fail the run, including linter ignores, `eslint-disable` comments and `@ts-expect-error`, `@ts-ignore` and `@ts-nocheck` directives with no record; an inline disable or directive is held by a file record on its clause and file, never by a clause-wide carve-out, and a lint-script option that weakens the run cannot be recorded at all |
| Path matching | old tools matched records by path suffix | exact repository paths |
| Linter | Biome, ESLint or oxlint for explicit `any` only | ESLint through the generated projection; Biome and oxlint are not Hone mechanisms |
| Exhaustive switch ([Default on a closed union](rules/typescript/symptoms.md#default-on-a-closed-union)) | typed ESLint `switch-exhaustiveness-check` suggested | the audit's `switch-defaults` clause only; type-aware linting is not supported |
| Judgement rules | read by an agent on request | each rule item names its review lenses, methods in `methods/lenses/`; ADOPTING step 9 is the procedure |

## 8. Moving to causal why-chains

An install from before the [why-chain contract](docs/why-chain-contract.md) holds chains with `whys`, `rootCause` and `owner` only. Hone still accepts such a chain while `--base-revision` holds its entry unchanged, but the first run without a base revision reports `legacy-chain-unmeasured` and fails. Do these steps in order:

1. **Give every check a base revision, before you refresh Hone.** Add `--base-revision` to the check command in `package.json` scripts, CI and the pre-push hook: `origin/main` locally, the pull request's base commit in CI. On a push to the main branch, the base is the commit before the push. Make sure CI fetches enough history to reach the base: `actions/checkout` defaults to one commit, so set `fetch-depth: 0` or fetch the base explicitly. A rin consumer whose `constitution.engine` is `"hone"`, or `"discipline-core"` before the rename, sets `constitution.baseRevision` in `harness.config.json`. Rin's stage gate and `disciplines` sensor pass it on.
2. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) section 10 says, and run the check. Every chain that is unchanged since the base passes. If the run lists `legacy-chain-unmeasured`, step 1 is missing somewhere. Any `why-chain-refused` entry is a legacy chain that is new or edited since the base.
3. **Rewrite each chain when you next touch its entry.** An edited entry with a legacy chain is refused until the chain follows the contract. Write the chain from the symptom down: ask why the exception exists, then ask why that answer is true, four more times. Add the `rootCheck` you ran today and the `readback`.
4. **Queue a rewrite of the rest.** Nothing ends the grace period: a legacy chain whose entry is never touched stays accepted. To make every chain causal, rewrite the remaining ones as tracked work. Rewriting a chain is an edit, so each rewritten chain must pass the contract in that change.

## 9. Moving from a copied source tree to the package

Hone is no longer installed by copying its source into the repository: this version ships no install files for that route. A copy of the source in `tools/discipline-core/` moves to the package, which reads the same `disciplines.json` and `discipline-exceptions.json` and runs on the repository's own toolchain.

The copy is an older release, so the package checks more than it did. Read these first, and do what applies before the first run on the package:

- [Section 8](#8-moving-to-causal-why-chains), if any exception's `whyChain` has no `rootCheck` and no `readback`: give every check a base revision first.
- [Section 10](#10-moving-from-the-discipline-core-names-to-hone) step 4: rule ids written by hand, such as in an `eslint-disable` comment, change from `discipline/...` to `hone/...`.
- [Section 14](#14-moving-to-recorded-inline-exceptions): each `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck` and `eslint-disable` is listed under `unrecorded` until it is removed or a file record holds it.
- [Section 15](#15-adopting-the-non-null-assertions-clause), if any clause of the cast discipline ([Claimed type](rules/typescript/symptoms.md#claimed-type)) is selected: it has a new clause to list.
- [Step 2a](#2a-carry-over-the-old-routes-settings), if the repository also ran rin's walker or another tool with settings of its own.

To move:

1. **Make sure the toolchain resolves from the repository root**, in the ranges [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 lists: TypeScript 4.8.4 up to 6.x, ESLint 9.39.5 or later on 9, or 10.15.0 or later on 10, and typescript-eslint 8.73.0 or later on 8. Keep the versions the repository already uses.
2. **Install the package** as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says, including the two `hone:` scripts.
3. **Repoint every command.** In scripts, CI and the pre-push hook, replace `node tools/discipline-core/core/check/check-command.ts --repo .` with `npm run --silent hone:check`, and `project-command.ts` with `npm run --silent hone:project`. Pass options after `--` with npm, as in `npm run --silent hone:check -- --base-revision origin/main`, and straight after the script name with pnpm, as in `pnpm run --silent hone:check --base-revision origin/main`. A hook or gate that reads the verdict line needs the warning in [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5. Point agent instructions at `node_modules/@hailstails/hone/rules/`.
4. **Repoint your own pieces and tests.** Nothing outside the package's public entries can be imported now:
   - A piece that imported types or `folderScope` from the copy, such as from `walker-piece.ts` or `source-scope.ts`, imports them from `@hailstails/hone/walker`.
   - A piece that read JSON with comments through the copy's `jsonc-parse.ts` calls TypeScript's own parser on the syntax API that `prepare` hands it: `syntaxApi.parseConfigFileTextToJson(file, text)` returns the parsed value as `config`, and sets `error` when it cannot parse the text. Do not import `jsonc-parser`: it is Hone's own dependency, not one the repository declares, so a strict package manager such as pnpm does not resolve it from a piece, and a piece imports only what [docs/extending.md](docs/extending.md) lists.
   - For a file it cannot parse, a piece returns `{ outcome: "failed", error: { kind: "file-unparseable", file, detail } }`. The check then stops with `load failure: runner-failed audit file-unparseable <file> <detail>` and exit `2`.
   - Case tests use `checkConformanceOf` from `@hailstails/hone/testing`, naming the `ruleSet`, as [docs/extending.md](docs/extending.md) shows.
   - A test that called the copy's check or governance functions directly, such as `runCheck` or `applyGovernance`, has no entry to call: run the `hone check` command against a repository the test sets up, and assert on its report and exit code.
5. **Remove the copy.** Delete `tools/discipline-core/`, its line in `.gitignore`, and its entry in `disciplines.json`'s `exclude`.
6. **Re-project** if any clause is `eslint`: run `npm run --silent hone:project`. The projection now imports each piece by package name instead of by a path into `tools/discipline-core/`, so it changes once; commit it.
7. **Run the check.** Compare it with the last run on the copy. A `readFirst` line now names its rule page under `node_modules/@hailstails/hone/rules/`, not in the copy. Any other new line comes from what the package checks that the copy did not, which the sections listed above describe. A `toolchain-unavailable` load failure names a package to install at the repository root.

## 10. Moving from the discipline-core names to Hone

Before `0.1.0-pre.1` the tool was called discipline core, with provisional names. Its npm package was then named `honed` until `0.1.0-pre.2` renamed it `@hailstails/hone`, as section 11 describes; a repository still on discipline core moves straight to the current names below. Only the names changed: the checks, the reports, the flags and the exit codes are the same, and `disciplines.json`, `discipline-exceptions.json`, `disciplines.eslint.mjs` and every `CD-*` clause address keep their names. To move:

| Old name | New name |
| --- | --- |
| npm package `discipline-core` | npm package `@hailstails/hone` (not the unscoped `hone`, an unrelated npm package) |
| tarball `discipline-core-<version>.tgz` | tarball `hailstails-hone-<version>.tgz` |
| command `discipline-core-check --repo .` | `hone check --repo .` |
| command `discipline-core-project --repo .` | `hone project --repo .` |
| scripts `discipline:check`, `discipline:project` | scripts `hone:check`, `hone:project` |
| source entries `core/check/check-command.ts`, `core/check/project-command.ts` | `core/check/tool-command.ts check`, `core/check/tool-command.ts project` |
| ESLint rule ids `discipline/<rule>` ([Authored class or this](rules/typescript/symptoms.md#authored-class-or-this)) | `hone/<rule>` |
| ESLint rule ids `discipline-cd<N>/<rule>` | `hone-cd<N>/<rule>` |
| reserved ESLint namespace `discipline-core` (projection block names, `discipline-core/inline-config`) | `hone-core` (`hone-core/piece/...`, `hone-core/inline-config`) |
| rule pages under `node_modules/discipline-core/rules/` | `node_modules/@hailstails/hone/rules/` |

1. **Swap the package.** Run `npm uninstall discipline-core`, then install `@hailstails/hone` as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says. Replace the vendored tarball file if the repository keeps one.
2. **Rename the scripts and repoint their callers.** In `package.json`, replace the two scripts with `"hone:check": "hone check --repo ."` and `"hone:project": "hone project --repo ."`, then change every caller of the old scripts or commands: CI, the pre-push hook and the validation script. Flags are unchanged: with npm they go after `--`, with pnpm straight after the script name.
3. **Re-project** if any clause is `eslint`: run `npm run --silent hone:project`. The projection's imports, block names and rule ids change once; commit it.
4. **Rename old rule ids written by hand.** Any `eslint-disable` comment, team config rule entry or suppression that names `discipline/...` or `discipline-cd<N>/...` now names a rule that no longer exists. The check does not list it: it names no selected rule, so it drops out of `unrecorded` instead of appearing there. What appears is the finding it no longer suppresses, in the repository's own ESLint run. Search the repository for `discipline/` and `discipline-cd` and rename each to `hone/...` or `hone-cd<N>/...`, so the check governs it again.
5. **Repoint agent instructions** from `node_modules/discipline-core/rules/` to `node_modules/@hailstails/hone/rules/`.
6. **Run the check.** It must give the same report as the last run under the old names.

A repository whose own tooling calls the commands, such as the rin harness, changes those calls on its own side. The engine name in `harness.config.json` belongs to that tooling: a current rin plugin names it `"hone"` and still accepts `"discipline-core"`, as [step 6](#6-remove-the-old-route-and-repoint-everything) says.

## 11. Moving from `honed` to `@hailstails/hone`

Version `0.1.0-pre.1` was published as the GitHub release tarball `honed-0.1.0-pre.1.tgz`, under the npm package name `honed`. npm refuses that name as too similar to existing packages, so from `0.1.0-pre.2` the package is the scoped `@hailstails/hone`, and `honed` will never be on the registry. The package name and what derives from it changed, and so did Hone's reserved ESLint namespace, from `honed` to `hone-core`, so that no name is left from the old package. The command is still `hone`, the scripts `hone:check` and `hone:project`, and the disciplines' ESLint rule ids `hone/...` and `hone-cd<N>/...`, as are `disciplines.json`, `discipline-exceptions.json` and every `CD-*` clause address.

| `honed` 0.1.0-pre.1 | `@hailstails/hone` |
| --- | --- |
| npm package `honed` | npm package `@hailstails/hone` |
| tarball `honed-<version>.tgz` | tarball `hailstails-hone-<version>.tgz` |
| projection imports `honed/mechanisms/eslint/...` | `@hailstails/hone/mechanisms/eslint/...` |
| projection block names `honed/piece/...` and the other `honed/...` blocks | `hone-core/piece/...` and `hone-core/...` |
| governance rule `honed/inline-config` | `hone-core/inline-config` |
| rule pages under `node_modules/honed/rules/` | `node_modules/@hailstails/hone/rules/` |

1. **Swap the package.** Run `npm uninstall honed`, then install `@hailstails/hone` as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 says: from npm at an exact version, or the tarball attached to the latest [GitHub release](https://github.com/HailsTails/hone/releases). Remove the vendored `honed-0.1.0-pre.1.tgz` if the repository keeps one, or replace it with the new tarball. `typescript` is now a required peer, where `honed` declared it optional: if the repository root does not already declare it, npm 7 and later install the newest supported release on their own, so add it to `devDependencies` at the version the repository uses.
2. **Re-project straight away** if any clause is `eslint`, before the check, the linter or anything else runs: `npm run --silent hone:project`, then commit `disciplines.eslint.mjs`. Until then the committed projection still imports `honed/...`, which is no longer installed, so the repository's own ESLint cannot load its configuration and the check stops with `load failure: runner-failed eslint team-config-unloadable eslint.config.mjs, the ESLint config for <file>, failed to load: Cannot find package 'honed' imported from ...disciplines.eslint.mjs ...` and exit 2. `hone project` does not load the old projection, so it runs and repairs it. Its import specifiers change from `honed/...` to `@hailstails/hone/...`, and its block names from `honed/...` to `hone-core/...`, in that same re-projection. The disciplines' rule ids `hone/...` and `hone-cd<N>/...` stay, so an `eslint-disable` comment, team config entry or suppression needs renaming only if it names `honed/inline-config`, which is now `hone-core/inline-config`.
3. **Keep the scripts.** `"hone:check": "hone check --repo ."` and `"hone:project": "hone project --repo ."` work unchanged, because the command is still `hone`.
4. **Repoint agent instructions** from `node_modules/honed/rules/` to `node_modules/@hailstails/hone/rules/`.
5. **Run the check.** It must give the same report as the last run under `honed`.

## 12. Moving off `waivedClauses`

Earlier releases let a repository record a `clause-wide-carve-out` and set `"assessment": { "waivedClauses": "not-run" }` in `disciplines.json`, or pass `--waived-clauses not-run`, so the carved-out clause was not run. That setting and that flag are gone. A clause now states this itself, in `clauses`. With either one still in place, `disciplines.json` is `file-malformed`, naming `waivedClauses` and the clause states to use, or the flag is `arguments-invalid`.

For each clause the setting skipped:

1. **Say what is true of it.** Set the clause to `"not-run"` when the rule binds but its check is not a true measure of the rule here, or cannot work here, such as the ESLint-only `CD-6#naming-convention` (`name-off-its-casing#naming-convention`) with no ESLint installed: the report lists it under `notRun`, and the rule is owed through review. Set it to `"not-adopted"` when the rule does not apply to this codebase. If neither is true, and the clause is debt the codebase cannot pay right now, keep its mechanism and its carve-out, and let the check run; see [ADOPTING.md](ADOPTING.md#4-write-honeconfigjson) step 4.
2. **Delete its carve-out** from `discipline-exceptions.json` when the clause is now `"not-run"` or `"not-adopted"`: an entry on such a clause is invalid, as `clause-not-run` or `clause-not-adopted`, and fails the run.
3. **Remove the setting and the flag.** Delete `waivedClauses` from `assessment` in `disciplines.json`, and `--waived-clauses` from scripts, CI and the pre-push hook.
4. **Re-project** if any clause was `eslint`: run `npm run --silent hone:project`. The projection no longer carries the clause's rule or its `"off"` block; commit it.
5. **Run the check.** The `assessment` section's `waived-clauses` line is gone, and the verdict line is no longer marked `(partial assessment)` unless forfeiture is assessed elsewhere.

## 13. Moving to package projection slices

Earlier releases wrote one `disciplines.eslint.mjs` at the repository root, and every package config spread it. A package linted from its own folder resolves `files` against that folder, so the root projection's carve-outs never matched there. Hone now writes a slice per config root; see [README.md](README.md#package-slices).

1. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) section 10 says, and run the check. Under the nearest-to-file lookup, each folder with a tracked `eslint.config.*` is a config root, and the check fails with `eslint missing <package>/disciplines.eslint.mjs` for each until its slice is written.
2. **Project and commit.** Run `npm run --silent hone:project` and commit every `disciplines.eslint.mjs` it writes, the root one and each package's.
3. **Spread each package's own slice.** In each package config, import `./disciplines.eslint.mjs` from that package's folder and spread it last, in place of the root projection. A package still spreading the root projection is reported `eslint not-applied <package>/disciplines.eslint.mjs` once a recorded file there is under check.
4. **List generated configs.** A package whose `eslint.config.*` a tool generates and git ignores gets no slice until its folder is listed under `eslintConfigRoots` in `disciplines.json`. Each listed folder must be one git tracks files under, outside every `exclude` path, or the check stops with `config-root-untracked`.
5. **Repositories that move to the repository-root lookup after adopting slices.** A repository that was on the repository-root lookup from the start never had package slices, and can skip this step. One ESLint 9 run applies the root config to every file, so no package folder is a config root. `hone project` removes each package slice it wrote whose bytes it would still write, and reports any other as `left-in-place`. If anyone lints from a package folder, a package config that imports its slice then fails with `Cannot find module`: list that package under `eslintConfigRoots` to keep its slice, or stop importing it there.
6. **Folders holding their own `disciplines.json`** get no slice: their ESLint configuration is not managed from this repository, as nested Hone configurations are not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)). When such a folder's own config leaves a carve-out recorded there out of effect, the `mechanism-not-run eslint not-included` line adds it. Governing the folder from this repository works today: remove its `disciplines.json`, keep its records here, and `hone project` writes its slice.

## 14. Moving to recorded inline exceptions

Earlier releases reported an `eslint-disable` comment naming a selected rule as an `inline-disable` no record could cover, and did not report TypeScript directives at all. Inline exceptions are now debt on the clause they escape, in their file, held by the file records you already write.

1. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) section 10 says, and run the check. Each `@ts-expect-error`, `@ts-ignore` and `@ts-nocheck` in a `.ts` or `.tsx` file is listed under `unrecorded` as `CD-2#cast-expressions audit inline-disable <file>:<line> <comment>` (`claimed-type#unlisted-cast-site`), test files included, and each `eslint-disable` as before.
2. **Remove what you can.** A directive or disable that hides nothing is cheaper to delete than to record.
3. **Record the rest per clause and file.** Add a `file-carve-out` for debt, or an `authorised-location` where the clause truly does not apply to that file, on the clause the line names and that file. `hone record-debt` writes the debt records ([ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a). One record holds every inline exception of that clause in the file. A `clause-wide-carve-out` does not hold them, and a tracked reference on the comment (`untracked-escape#directive-pointers`) does not stand in for the record. Editing a carved file forfeits the carve-out, and each inline exception it held is listed again.
4. **Name the rule in a bare disable.** An `eslint-disable` naming no rule escapes every selected ESLint clause and needs a record for each. Its lines end `names no rule and escapes every selected clause: naming the rule is the cheap fix`.
5. **Fix lint-script options.** A `command-line-option` line that ends `weakens the script's whole run, so no record can cover it: remove it from the script` names an option to remove. One that ends `is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as "<invocation>"` names a script such as `tsc && eslint -c eslint.config.mjs .`: move the quoted command to a script of its own, then run the check again. One that ends `comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` quotes the first token Hone does not read, such as `env` or a runner flag like `-y`: rewrite the command so only package runners and `NAME=value` settings, including `cross-env NAME=value`, come before `eslint`. `-c` naming the config ESLint already finds, and `--ignore-pattern` that ignores no checked file, are not reported once `eslint` runs plainly.
6. **Stale records may clear.** A record that holds a native exception it can cover now counts as used. An `authorised-location` or `file-carve-out` that held only a `config-override`, and was listed `stale` while dropping it left the override unrecorded, is no longer stale.
7. **Standalone runners** written outside Hone return `{ hits, nativeExceptions }` from `run`, where `nativeExceptions` holds only `inline-disable` entries with `reach`, in place of a bare list of hits. A runner still returning the list fails with `runner-invalid-output` naming that shape.

<a id="15-adopting-the-non-null-assertions-clause"></a>

## 15. Adopting `CD-2#non-null-assertions`

The cast discipline gained a clause, `CD-2#non-null-assertions` (`claimed-type#non-null-assertions`), checked through `eslint` only. It flags non-null assertions, `x!`, and definite assignment assertions, `let x!: T` and `field!: T`; see `rules/typescript/symptoms/claimed-type/non-null-assertions.md`. A repository that selects any of its clauses has adopted that discipline, so after refreshing Hone its check fails with this line under `uncovered` until `disciplines.json` lists the new clause:

```text
CD-2#non-null-assertions
```

Choose one state for it, as [ADOPTING.md](ADOPTING.md#4-write-honeconfigjson) step 4 sets out:

1. **The repository runs the ESLint mechanism.** Add `"CD-2#non-null-assertions": "eslint"` (`claimed-type#non-null-assertions`) to `clauses`, then run `npm run --silent hone:project` and commit `disciplines.eslint.mjs`, and each package slice it writes. Run the check. Each existing `!` is a finding; fix it, or hold it as debt with a `file-carve-out` per file, or a `clause-wide-carve-out` with an owner, after the human approves, and re-run `hone:project` so the projection carries the records. An `eslint-disable` naming no rule now escapes this clause too, and is listed under `unrecorded` for it until a file record on this clause holds it, as section 14 says; naming the rule it means is the cheap fix.
2. **The repository has no ESLint, or the rule binds but its check is not a true measure here.** Add `"CD-2#non-null-assertions": "not-run"` (`claimed-type#non-null-assertions`). The report lists it under `notRun`, and review owes the rule. Nothing is projected and ESLint is not loaded for it.
3. **The rule does not apply to this codebase.** A tech lead says so in the open, and the clause is listed as `"not-adopted"`. The report lists it under `notAdopted`.

Neither `"not-run"` nor `"not-adopted"` takes an exception record. Stop and ask the human before choosing `"not-adopted"`, or before recording carve-outs for existing `!` sites.

## 16. Moving to the split layout

`discipline-exceptions.json` holds every record in one file. The split layout keeps the same records in the `discipline-exceptions` folder, one file for each record kind and discipline, as `.constitution-carve-outs/cd-<id>.json` and `.constitution-authorised-locations/cd-<id>.json` did. Moving is optional, and a repository that does nothing keeps the single file.

1. **Start a branch from the base your hook and CI pass to the check**, such as `origin/main`, with no other change to the records in it. Fetch the base first, so it is current.
2. **Split the records:**

   ```bash
   npm run --silent hone:split-records
   ```

   with `"hone:split-records": "hone split-records --repo ."` in the root `package.json`.

   It prints `<path> written` for each file and `discipline-exceptions.json removed`. Within each file the records keep the order they had. It refuses a record whose clause names no discipline, naming its index: fix the clause or remove the record, then run it again. It also refuses a `discipline-exceptions.json` holding keys other than `version` and `exceptions`, such as `$schema` or `notes`, naming them, since no split file keeps them: remove them, or keep what they say elsewhere, then run it again.
3. **Re-project and check against the same base.** With any `eslint` clause, run `npm run --silent hone:project`; it prints `unchanged`, since the projection does not depend on where a record is kept. Then run `npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main` (with pnpm, `pnpm run --silent hone:check --forfeiture this-run --base-revision origin/main`). The base still holds `discipline-exceptions.json`, and Hone reads the base in whichever layout it holds, so imported and legacy-chain records are still verified against it. `--forfeiture this-run` makes this run assess decay whatever `assessment.forfeiture` says. The report is the one the check printed before the split, except that a section listing records, such as `stale`, lists them in the order of the new files.
4. **Commit the removal and the new files in one change.** A tree that holds both `discipline-exceptions.json` and the folder fails every run with `records-in-both-layouts`. Point any code owners or review rules at the new files, such as `discipline-exceptions/file-carve-outs/cd-19.json`.

From then on, `hone record-debt` adds each record to its discipline's file, and a record a person writes goes in the file of its kind and discipline: one in any other file fails the load as `file-malformed`, naming the file it belongs in.

## 17. Pruning paid ESLint debt

Earlier releases never listed an `eslint` file record as `stale`. The off-switch `hone project` writes for a record counted as a `config-override` that the record held, so a record kept its rule off after its file stopped breaking the clause, and a new violation there went unreported. A forfeited `eslint` record's off-switch was also listed under `unrecorded` as a `config-override`. The check no longer counts the projection's own off-switches as native exceptions, and the new `hone prune-debt` removes the records of files that no longer exist.

1. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) section 10 says, and run the check against the branch's base. If none of your `eslint` debt is paid, nothing changes.
2. **If some is, the run fails.** Each paid record is listed under `stale` as `<clause> eslint file-carve-out <file>`.
3. **Delete each of those records by hand** when its file still exists, or let `hone prune-debt` remove it once you have also done [section 19](#19-pruning-paid-debt-on-files-that-still-exist), then run `npm run --silent hone:project`, which prints `disciplines.eslint.mjs written`. A stale `authorised-location` or `clause-wide-carve-out` is left for a person in the same way.
4. **Run `hone prune-debt` for records whose file is gone.** When a stale or forfeited record names a file that no longer exists, or, after section 19, one whose clause was measured clean on its file, the report ends with one `readFirst` line naming the command to run, such as:

   ```text
   prune-debt: 3 file carve-outs under stale or forfeited still record debt that is paid; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js prune-debt --repo /work/shop --base-revision origin/main to remove what is paid, then run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit the exception records with every disciplines.eslint.mjs it writes
   ```

   With `"hone:prune-debt": "hone prune-debt --repo ."` in the root `package.json`, from the repository root that is:

   ```bash
   npm run --silent hone:prune-debt -- --base-revision origin/main
   npm run --silent hone:project
   ```

   `hone prune-debt` prints `<clause> removed <file>` for each record it removed. Commit the exception records and `disciplines.eslint.mjs`, and each package slice `hone project` writes. The check passes.
5. **Look for a team override that surfaces.** An off-switch your own config places after the projection, for a rule and file a removed record held, was hidden behind the record. It is now listed under `unrecorded` as a `config-override`; [ADOPTING.md](ADOPTING.md#6-read-the-report) step 6 says what to do with it.

## 18. Rules by name

Rules, principles, cases, recipes and symptoms are now referred to by name, not by number. [rules/README.md](rules/README.md) explains how the named pages read.

Nothing must be migrated. Selections, exception records and findings still use the numbered clause addresses, such as `CD-14#class-syntax` (`authored-class-or-this#class-keyword`), and load and print as before. [Every CD](rules/numbers.md) gives each number's verdict and the named items it became; each check's mechanics are on its own page under its symptom.

[Every CD](rules/numbers.md) maps each number to its new names.

## 19. Pruning paid debt on files that still exist

`hone prune-debt` used to remove a `file-carve-out` only when its file no longer existed. Each mechanism now reports which clause it measured on which file, and the command also removes a stale or forfeited `file-carve-out` whose clause its mechanism measured on its file, when no finding or native exception still holds it. A finding an `authorised-location` in force exempts no longer holds it, since that finding is answered; a finding only debt exempts, and any native exception on the pair, recorded or not, still do. A file the mechanism skipped, a file outside the checked set and a run that did not happen are not measured, so their records stay.

1. **Refresh Hone** as [ADOPTING.md](ADOPTING.md#10-update-and-remove) section 10 says, and run the check. A record whose debt is paid on a file that still exists now brings the `prune-debt` line to the end of `readFirst`.
2. **Run the command it names,** then `npm run --silent hone:project` when any clause is `eslint`, and commit what they change.
3. **Runners written outside Hone** may return `measured`, a list of `{ clause, file }` pairs, beside what they return now; [the mechanism guide](docs/adding-a-discipline-or-mechanism.md) says what a pair means. A runner that returns none has measured nothing, and its records on files that still exist stay for a person, as before.
4. **Audit pieces written outside Hone** must answer `skipped` from `prepareFile` for a file they do not judge. Any other answer now says the piece's clauses were measured on that file, so `prune-debt` may remove a record on it; [the audit piece guide](docs/extending.md) says so.

## 20. Moving from version 1 to version 2

Version 2 keeps its settings in `hone.config.json`, its records in the `hone-records` folder and its native configuration in `hone.<engine>.mjs`, where version 1 kept them in `disciplines.json`, the exception records and `disciplines.<mechanism>.mjs`. `hone upgrade` moves a repository from one to the other in one run, and refuses, changing nothing, when version 2's check does not pass on the result. Version 2 is a major release, so its findings may differ from version 1's: the upgrade records the differences as debt.

1. **Version 1 findings need not be fixed before you install version 2.** The upgrade records version 2's findings as debt. Fix anything else the check fails on first: a load failure, an invalid record, an uncovered clause, an ESLint config that leaves the projection out, or a config override. **Install version 2 on a branch, with a clean working tree,** the way [ADOPTING.md](ADOPTING.md#10-update-and-remove) section 10 installs a release, changing the pin of `@hailstails/hone` in every workspace package that declares it, not only the root. Add `"hone:upgrade": "hone upgrade --repo ."` to the root `package.json` scripts, as `hone:check` and `hone:project` are, and **commit the install**, which changes the pins, the scripts and the lock, so the working tree is clean before the upgrade. Run neither `hone:project` nor the check before the upgrade: on a version 1 repository version 2's commands stop with `upgrade-needed`. The upgrade runs version 1's `project` itself before it measures, so a stale or missing projection is regenerated, and a refusal after that puts it back. The working tree is the only rollback: a refusal after files were written puts them back, and names any it could not put back, so you can restore them from version control.
2. **Run it:**

   ```bash
   npm run --silent hone:upgrade
   ```

   It writes the version 2 files, removes the records it carried that answer nothing, runs `record-debt`, `prune-debt` and `project`, then runs version 2's check. A version 1 `reportOutput` of `failures-only` is written as `actionable`, its version 2 name, and `--report-output failures-only` is refused on a version 2 repository. Only when version 2's check passes does it remove the version 1 files. If it fails, the upgrade puts everything back and prints the failing lines. Each refusal states whether anything was changed, and lists any file it could not put back.
3. **Format, then commit** what the upgrade wrote and removed, as its own commit after the install: the version 2 files together with the removal of the version 1 files. Run your formatter on every file the upgrade wrote or rewrote before committing, except `hone.eslint.mjs` and `hone.eslint.d.mts`. Add those two to the formatter's ignore list: the check compares each with what `hone project` writes and reports under `projection-problems` when it is missing or out of date. Then `git add .` and your commit.

   After the upgrade, `hone split-records` does not run on version 2 files, and the records stay in `hone-records`. Before it, version 1's `hone authorise` stops and sends you here.
4. **Run the check with a base revision in at least one run, in CI at least,** for example `npm run --silent hone:check -- --base-revision origin/main`, where the script passes everything after `--` to `hone check`. The report a version 1 reader knew reads a little differently: `exempted` is now `answered`, and `carried` is a section of its own, listing the records the upgrade carried over. The records carried over follow the `forfeiture` setting, as debt does. With the default, `this-run`, every run needs `--base-revision` while a carried record or any debt exists: without one the run prints `forfeiture-unmeasured no-base-revision` when debt exists, first, and `import-unmeasured no-base-revision` when carried records exist, and fails, a bare local check or a hook that passes no base included. With `"forfeiture": "elsewhere"` a run that is given no base leaves the carried records to the run that has one, prints `carried standing elsewhere` with how many, and passes as a partial assessment when nothing else fails. A run with debt also prints `forfeiture elsewhere: <n> debt records not checked for forfeiture in this run` under `assessment`, which is the same setting at work on debt. A run that is given a base judges the carried records against it, but still does not check debt for forfeiture: it still prints that `forfeiture elsewhere` line and still ends `verdict: pass (partial assessment)`, or `verdict: fail (partial assessment)` when something else fails. Some run must assess forfeiture, and the run that does is the one with `"forfeiture": "this-run"`, the default, or `--forfeiture this-run`, given a base. A base that is given and cannot be read still prints `import-unmeasured base-git-failed` and fails under either setting. If no run is ever given a base, carried records are never judged, so keep one run that has it. A second `hone upgrade` prints `already on version 2; nothing to upgrade` and exits `0`.

### What the upgrade prints

It exits `0` on success, listing each file it wrote, rewrote or removed: commit them all. It exits `1` on a refusal, and each refusal line says what to do: do it, then run the upgrade again. A refusal says whether anything was changed, and lists any file it could not put back. A line that asks you to report a fault at the issues page is the tool's fault, not your repository's: send the output. It exits `3` when version 2 is in place but some version 1 files could not be removed: delete the files it lists by hand, then commit.

### Your records, and what the check judges

A file carve-out that version 1 held with a `provenance`, as `hone record-debt` writes, or with a `whyChain`, and every authorised location move to `hone-records` word for word, under a `carried` key. These are the carried records. A location is filed at the check or checks that the findings it answers sit at, so one for a clause bound to the audit mechanism lands under the symptom those findings belong to, such as `hone-records/authorised-locations/claimed-type.json`, not under its clause. A `CD-19` location becomes one record for each package in its `confinedPackages`, plus one for `node:` modules, as version 1 confined them, and the upgrade removes the ones that answer nothing. A file carve-out with neither moves as a debt record with the `reason` as its `note`, and so does one that held up an inline disable or a TypeScript directive and exempted no finding, once for each check the suppression reaches.

The check lists the carried records under `carried`, one line each, `<records file> records[<index>] <standing>`, followed by `lacks` and the keys it lacks when the record lacks any. A carried authorised location lacks `case`, `owes` and `whyChain`, which version 1 did not hold, and its line says so. With a base revision, it judges each one: it is `established` when the base revision held that record unchanged, whether as a version 1 entry or as a version 2 record, so a base from before the upgrade works. A carried record changed since the base is refused as `carried-changed-since-base`, so leave carried records as they are. Without a base revision the standing is `unjudged`: under `"forfeiture": "this-run"`, the default, the run fails with `import-unmeasured no-base-revision`, so every run needs `--base-revision`, local runs and hooks included; under `"forfeiture": "elsewhere"` it prints `carried standing elsewhere` and leaves them to the run that has a base. Version 2 names each finding by its check, such as `authored-class-or-this#class-keyword`, where version 1 named it by its clause, such as `CD-14#class-syntax`.

### Update what names the old files

Anything of yours that names a file version 1 kept needs the version 2 name: scripts, CI path filters, pre-push and other hooks, `CODEOWNERS`, and editor or lint-staged settings. The upgrade rewrites only your ESLint config's import. Tests that assert the version 1 layout, such as one that requires `discipline-exceptions/` files to exist or runs the check over a `disciplines.json`, fail after the upgrade, as do prompts, knowledge pages and remedy text of yours that name `disciplines.json`, `discipline-exceptions` or `disciplines.eslint.mjs`, and links to the guide at a version 1 tag.

| Version 1 | Version 2 |
| --- | --- |
| `disciplines.json` | `hone.config.json` |
| `discipline-exceptions.json`, `discipline-exceptions/` | `hone-records/` |
| `disciplines.eslint.mjs` | `hone.eslint.mjs`, and beside it `hone.eslint.d.mts`, which version 1 had no file for |

Files inside the package moved as well, so a script that runs one by its path, such as `node_modules/@hailstails/hone/core/check/tool-command.js`, no longer finds it. Call `hone`, or your own `hone:check` script, instead.

### ESLint slices and declared roots

A repository with package slices, one `disciplines.eslint.mjs` in each package folder that has its own ESLint config, gets one `hone.eslint.mjs` in each of the same folders. Every config that imported a version 1 projection now imports the one in its own folder, and a config that imported several has each import renamed. `eslintConfigRoots` and `eslintConfigLookup` move into `hone.config.json` as they are.

Before it measures, the upgrade runs version 1's own `project` once. A slice that no config root owns any more is removed by it. A refusal after that lists it under `version 1's own project removed these files, and the upgrade does not put them back; restore them from version control:`, since the upgrade did not write it.

A script whose text holds the projection's import, even inside a string, is taken for an ESLint config: its import is rewritten, and the upgrade refuses when the script names the projection anywhere else. Change such a script first.

Each refusal an ESLint repository meets names the config or projection and what to do, as every other refusal does.

### A team rule set

A team rule set still in version 1's layout, `rules/<ID>/discipline.json` beside `mechanisms/`, is converted by the same run. Before it, do these by hand, in a commit of their own:

1. **Name and define what version 2 needs.** Names and definitions are your team's judgement, so the upgrade asks for them rather than writing its own: write `version-two-names.json` at the rule set's root. `clauses` gives each mechanical clause a check of its own, not one of Hone's, and a title, such as `"ACME-1#console-calls": { "check": "direct-console#console-calls", "title": "Console calls" }`. `symptoms`, `cases`, `principles` and `rules` define each symptom those checks see, and what each symptom points at, with the same facts as their items in [docs/extending.md](docs/extending.md); a symptom's `seen` is taken from its clauses' summaries. Every symptom, case, principle and rule also needs a `title`, which its item holds as its heading, and a rule needs its `principle` and `standing`. The `acme` rule set's [names file](https://github.com/HailsTails/hone/blob/main/delivery/install-proof/consumer-proof/team/tools/disciplines/acme/version-two-names.json) is a whole example. Anything missing refuses the upgrade, and the refusal lists every entry to add.
2. **Update the pieces to version 2's piece API,** which [docs/extending.md](docs/extending.md) describes: a walker piece's `prepare({ bindings })` reads `bindings` where it read clauses, each hit names its `check`, the `binding.address`, where it named a clause, it imports from `@hailstails/hone/walker`, and its tests use `@hailstails/hone/testing`. The upgrade runs the pieces in version 2's check, so they must run under version 2 first. A test that builds the `repository` it hands to `prepare` must give it `testFiles`. Tests that use `@hailstails/hone/testing` read the version 2 layout, so they fail from installing version 2 until the upgrade has run.
3. **Let your own checks admit the new folders.** A team check that judges paths or Markdown sees the items and pieces the upgrade writes, so update what it allows first. Otherwise its findings there are recorded as debt, which a run that assesses forfeiture against a base from before the upgrade lists as `forfeited`: then update the check, and run `hone prune-debt` with that base and `--forfeiture this-run`.

The upgrade writes the definitions, symptoms and checks under the rule set's `rules/` folder and each clause's cases as its check's examples, moves each piece's folder to `engines/<engine>/<symptom>/<check>/`, and removes the version 1 files and the names file. It leaves the clauses' names in `rules/version-one-names.json`, which the check reads to judge the carried records: update it when you rename or remove a check it names, and delete it once your main branch is on version 2. Deleting it earlier gets that rule set's carried records refused. An authorised location on a moved piece becomes debt, for you to re-authorise at its new path. A folder that several clauses share is split: each clause's module and its test go to that clause's check, and the other files go once to the check of the clause first by name. Each moved file's relative imports, `require` calls and test-double module paths are rewritten for where it now sits. The upgrade refuses a folder whose one module serves several clauses, and an import or module path written as an expression rather than a string; give each clause a module of its own, or write the path as a string, first. The rule set takes Hone's record kinds, and its records land under `hone-records/<rule set>/`. An upgrade that stopped part way leaves version 1 discipline files beside version 2 items, and a second `hone upgrade` refuses that rule set until they are removed or it is restored.

After the upgrade, rewrite each generated `seen` in your own words, and fix what points into the rule set's folder from outside it, which the upgrade leaves alone: `tsconfig` includes, imports and READMEs.

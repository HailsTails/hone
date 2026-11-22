# Hone

[![npm version on the latest dist-tag](https://img.shields.io/npm/v/%40hailstails%2Fhone/latest)](https://www.npmjs.com/package/@hailstails/hone)
[![CI on main](https://github.com/HailsTails/hone/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HailsTails/hone/actions/workflows/ci.yml?query=branch%3Amain)
[![Unpacked size on the latest dist-tag](https://img.shields.io/npm/unpacked-size/%40hailstails%2Fhone/latest)](https://www.npmjs.com/package/@hailstails/hone)
[![Supported Node versions on the latest dist-tag](https://img.shields.io/node/v/%40hailstails%2Fhone/latest)](https://www.npmjs.com/package/@hailstails/hone)
[![Licence](https://img.shields.io/npm/l/%40hailstails%2Fhone)](LICENSE)

Hone checks a repository against the disciplines it has chosen to adopt. It is a tool, not a framework: it reads what the repository selected, hands each selected clause to the mechanism that checks it, applies the repository's recorded exceptions, and prints one verdict. Its core enforces nothing and names no discipline and no mechanism. A discipline (for example the one that flags an [authored class](rules/typescript/symptoms.md#authored-class-or-this)) is data under `rules/`, and a mechanism is a runner under `mechanisms/`; the core reaches both only through files and one module contract.

**Install the npm package `@hailstails/hone`.** The unscoped name `hone` on npm belongs to an unrelated package: never run `npm install hone`. `@hailstails/hone` installs one command, `hone`:

```bash
npm view @hailstails/hone dist-tags
npm install --save-dev --save-exact @hailstails/hone@<version>
```

With pnpm the second command is `pnpm add -D --save-exact @hailstails/hone@<version>`. Stable releases are published to npm under the dist-tag `latest` and pre-releases under `next`; the badge above shows the version `latest` installs. Pin the exact version rather than installing by tag: a major release can remove or rename a clause address, config key or flag, and an install by tag can record a range. The alternative is the tarball attached to each [GitHub release](https://github.com/HailsTails/hone/releases), installed with `npm install --save-dev <path-to-tarball>`. A repository on the package's old name, `honed`, moves with [MIGRATING.md](MIGRATING.md#11-moving-from-honed-to-hailstailshone). [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps, and the alternative of building the tarball from a pinned commit.

Two engines ship: `walker`, a standalone TypeScript syntax walker that version 1 called `audit`, and `eslint`, which runs the check as an ESLint rule inside the team's own ESLint setup. Rules are referred to by name; a number is only a clause address. [rules/numbers.md](rules/numbers.md#every-numbered-discipline) lists every shared discipline with its clauses, and [rules/README.md](rules/README.md) explains how the named pages read: the walker checks 20 disciplines, and ESLint pieces check eleven symptoms: [Untyped value](rules/typescript/symptoms.md#untyped-value), [Claimed type](rules/typescript/symptoms.md#claimed-type), [Name off its casing](rules/typescript/symptoms.md#name-off-its-casing), [Thrown non-error](rules/typescript/symptoms.md#thrown-non-error), [Authored class or this](rules/typescript/symptoms.md#authored-class-or-this), [Test switched off](rules/typescript/symptoms.md#test-switched-off), [Positional parameters](rules/typescript/symptoms.md#positional-parameters), [Tangled function](rules/typescript/symptoms.md#tangled-function), [Long function](rules/typescript/symptoms.md#long-function), [Work inside a condition](rules/typescript/symptoms.md#work-inside-a-condition) and [Rebinding](rules/typescript/symptoms.md#rebinding). The rest are judgement rules, applied in review with the review methods in [methods/](methods/README.md).

To adopt Hone in another repository, follow [ADOPTING.md](ADOPTING.md) step by step. A repository already using the older standalone route, or a copy of Hone's source, follows [MIGRATING.md](MIGRATING.md) instead.

A team adds its own disciplines as a rule set in its own repository, with ESLint and audit pieces, following [docs/extending.md](docs/extending.md). Adding a discipline or a mechanism to Hone itself, and the full list of ESLint native channels, are covered in [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

## Commands

The package ships one command, `hone`, with six subcommands for a version 2 repository, and a seventh, `hone split-records`, which belongs to version 1 and prints `load failure: not-ready-yet` on a version 2 repository. `check` and `project` run through a `package.json` script as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) shows; `record-debt` runs once, when a repository adopts Hone; `prune-debt` runs when the check names it, to remove the records of debt that is paid; `authorise` writes one authorised location; `upgrade` runs once, to move a version 1 repository to version 2, as [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 shows:

```text
hone check --repo <dir> [--base-revision <revision>] [--report-output <full|actionable|counts|verdict-only>] [--forfeiture <this-run|elsewhere>]
hone project --repo <dir>
hone record-debt --repo <dir> --base-revision <revision> [--leave <path>]...
hone prune-debt --repo <dir> [--base-revision <revision>] [--forfeiture <this-run|elsewhere>]
hone authorise --repo <dir> --answers <address> --file <path> --case <case> --owes <principle> --why <question>... --because <answer>... --evidence <evidence>... --root-cause <text> --root-evidence <text> --readback <text> --owner <owner>
hone upgrade --repo <dir>
hone --help
hone --version
```

`--repo` is the folder that holds `hone.config.json`, usually the repository root; for `hone upgrade` it is the folder that holds `disciplines.json`. `hone --help` lists the commands, `hone check --help`, `hone project --help`, `hone record-debt --help`, `hone prune-debt --help`, `hone authorise --help` and `hone upgrade --help` list each one's options and exit codes, and `hone --version` prints the installed version. `hone --help` always prints this version's help. A command's `--help` prints the 1.x help only when it is given a `--repo` folder that holds `disciplines.json`, and `hone split-records --help` always prints it. A command typed wrongly is a load failure `arguments-invalid` that says what was wrong, a `--repo` folder with neither `hone.config.json` nor `disciplines.json` is the load failure `config-absent`, saying it holds no `hone.config.json`, from every command, and an error Hone did not expect is the load failure `unexpected-error`; each exits `2`. Everything Hone prints goes to standard output, so exit `1` always comes with `verdict: fail`. From a source checkout the same command is `node core/check/tool-command.ts check --repo <dir>`.

[docs/output-contract.md](docs/output-contract.md) lists every line `hone` prints, exactly as it prints it, with the exit codes and which parts are stable for hooks, CI and agents to rely on. A test renders every kind of line and checks it against that page, both ways.

`hone check` loads the repository's `hone.config.json`, the symptom catalogue and the records in `hone-records`; works out which files changed since `--base-revision`; runs each engine its listed checks name once over the repository's tracked files, the ESLint engine over its `.ts`, `.tsx`, `.mts` and `.cts` files; answers each finding by the records; and prints a plain-text report ending in `verdict: pass` or `verdict: fail`, followed by ` (partial assessment)` when the run left part of the assessment to another run. It exits `0` when the verdict is `pass`, `1` when it is `fail`, and `2` on a load failure, which prints one line, `load failure: <kind> <fields>`. `hone project`, `hone record-debt`, `hone prune-debt` and `hone authorise` exit `0` or `2`.

The report lists the excluded paths, the checks not adopted, the checks adopted with their engine not run, the edition each check with more than one edition ran, findings, answered findings, uncovered checks, stale and forfeited records, unrecorded native exceptions, misnamed inline disables, paid debt, refused records, what the run could not measure, projection problems, any part of the assessment left to another run, the notes on the settings and on records, the records carried from version 1 and, last, one note for each symptom the findings name, each with its count. The verdict is `pass` only when no failing section has an entry: the findings, uncovered checks, stale and forfeited records, unrecorded native exceptions, misnamed inline disables, refused records, unmeasured checks and projection problems. Paid debt, answered findings, carried records, notes, the assessment and the symptom notes never fail a run; [the output contract](docs/output-contract.md#the-version-2-report) gives every section's role.

An `unrecorded` line is `<check> <engine> <kind> <detail>`. Two kinds end with a note:

| Kind | Line |
| --- | --- |
| `inline-disable` naming no rule | `<check> eslint inline-disable <file>:<line> <comment> names no rule and escapes every selected check: naming the rule is the cheap fix` |
| `command-line-option` that weakens the run | `<check> eslint command-line-option <package.json> <script> <option> weakens the script's whole run, so no record can cover it: remove it from the script` |
| `command-line-option` Hone cannot judge, because another command comes before `eslint` in its script | `<check> eslint command-line-option <package.json> <script> <option>: <command> is not the first command of its script, so Hone cannot tell what the option does to the files under check; give <command> a script of its own, such as <invocation>` |
| `command-line-option` Hone cannot judge, because something before `eslint` in its own command is not a package runner or a `NAME=value` setting | `<check> eslint command-line-option <package.json> <script> <option>: <wrapper> comes before <command> and is neither a package runner nor a NAME=value setting, so Hone cannot tell what the option does to the files under check; put only package runners and NAME=value settings before <command>` |
| `command-line-option` Hone cannot judge, because a quote in a script naming `eslint` has no partner; the whole script stands in for the option | `<check> eslint command-line-option <package.json> <script> <script text>: a quote in the script has no partner, so Hone cannot read what the script passes to <command> or tell what that does to the files under check; pair every quote in the script` |

`<command>` is the `eslint` call as the script writes it, `<invocation>` is its whole command with its settings and options, from the same script, and `<wrapper>` is the first token before it that Hone does not read, such as `env` or a runner flag like `-y` or `-C`. `cross-env` followed only by `NAME=value` settings counts as a setting. Once only package runners and settings come first, Hone judges the option: `-c` naming the config ESLint already finds, and `--ignore-pattern` that ignores no checked file, are then not reported.

The `symptoms` section comes last, just before the verdict, so a reader who looks only at the end of a failing report lands on it. It has one note for each symptom a finding names, in the order the findings first name them, each printed once however many findings name it: what the symptom may indicate, where the breach usually sits, the recipes that answer it, the situations that are correct uses of it and where to record each, and the page that explains it. A finding that names its check also says what that check may indicate and, where the check has one, what to write instead and the page that says so. A finding of a clause the symptom catalogue gives no check, such as one in a team's rule set, prints its clause address and its mechanism and no note. A run with no findings prints no `symptoms` section. When the check finds debt that is paid, the `paid` section names the exact `hone prune-debt` command for this repository, as [Pruning paid debt](#pruning-paid-debt) shows.

`--report-output` sets how much of the report is printed for one run, overriding `reportOutput` in `hone.config.json`; with neither, the output is `full`. `full` prints every non-empty section, `actionable` leaves out the informational sections and keeps the failing, next-step and guidance sections, `counts` prints each section's heading line only, with `informational`, `next-step` or `guidance` after the sections that never fail the run, and `verdict-only` prints the verdict line alone; [the output contract](docs/output-contract.md#the-version-2-report) shows each.

The output changes only what is printed: the verdict and exit code always come from the whole report. An unknown `--report-output` value is a load failure `arguments-invalid`; an unknown `reportOutput` value is a load failure in `hone.config.json`, even when `--report-output` is given. Load failures print the same in every output.

Without `--base-revision`, Hone cannot tell which files were touched, so debt cannot be forfeited; if any debt exists the report lists `forfeiture-unmeasured` and the run fails. For the same reason it cannot compare a record carried from version 1 against the base; if one exists the report lists `import-unmeasured` and the run fails, unless forfeiture is left elsewhere, below. Each line says what Hone needs:

```text
forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch's base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere
import-unmeasured no-base-revision: no --base-revision was given, so carried records cannot be checked against it; pass --base-revision with the branch's base, such as origin/main
```

A `--base-revision` that git cannot use gives the same kinds as `base-git-failed`, naming the revision in double quotes, escaped as in JSON, with git's own message:

```text
forfeiture-unmeasured base-git-failed "origin/main": git could not list the files changed since that revision and said "<git's message>"; Hone needs that revision and the history back to where this branch left it, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere
import-unmeasured base-git-failed "origin/main": git could not read hone-records at that revision and said "<git's message>"; Hone needs hone-records as it was at that revision
```

`--forfeiture elsewhere` makes a run leave debt forfeiture to another run, such as a pre-push hook given a base revision, overriding `forfeiture` in `hone.config.json`; `--forfeiture this-run`, the default, assesses it in this run. A run with forfeiture elsewhere asks git for no change set for debt, forfeits no debt and never reports `forfeiture-unmeasured`, with or without `--base-revision`. It adds an `assessment` section to its report, printed whenever the run assesses less than the default, and marks its verdict line in every output:

```text
assessment (1)
forfeiture elsewhere: 37 debt records not checked for forfeiture in this run
verdict: pass (partial assessment)
```

The `assessment` section is informational and the marker does not change the exit code. Records carried from version 1 follow the same setting, as [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) says: with forfeiture elsewhere, a run given no base leaves them to the run that has one and prints `carried standing elsewhere` with how many; a run given a base judges them against it; and if no run is ever given a base they are never judged. A base that is given but cannot be read prints `import-unmeasured base-git-failed` and fails under either setting.

`hone project` writes the native configuration each engine that runs a listed check through one needs, and prints `<path> <effect>` per file: `written` or `unchanged`. For the ESLint engine the files are `hone.eslint.mjs` and, beside it, `hone.eslint.d.mts`, which types the projection. The walker is standalone and writes nothing, so with only the walker listed the command prints nothing and exits `0`.

### Recording inherited debt

`hone record-debt` gives a repository that adopts Hone with existing code a debt record for each finding it cannot fix on day one. [ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a is the procedure. The command runs the check with the `--base-revision` it is given, then writes one debt record under `hone-records/debt/<symptom>.json` for each symptom, check and file that has a finding, and for each inline disable or TypeScript directive under `unrecorded`, since debt on its check and file is what holds one. Each is the record a person would write, so nothing downstream treats it differently: it names only its symptom, or its symptom and check as `<symptom>#<check>`, and its file. Debt needs no why-chain and no case, so the command needs no setting in `hone.config.json` and never sets one. Add a `note` by hand afterwards if you want to leave a note for future developers on what the debt signals.

Give it the base that the run assessing forfeiture is given, such as `origin/main` for a branch: a record for a file changed since that base is forfeited by that run, so the command writes none for such a file and says so, and a check against a later revision, such as `HEAD`, would not show it.

It never writes anything that needs an owner's reason: no authorised location, no boundary record, no deviation, no dependency record and no setting. It prints one line per finding and per native exception under `unrecorded`, `recorded` for each record it added, and writes nothing for:

- a symptom and file that already hold debt (`already-recorded`), which the check explains by saying why it does not answer;
- a file under a `--leave` path (`left`). `--leave` takes an exact file or folder, as `exclude` does, and may be given once for each path. It names the deliberate, permanent exceptions, which a person records as an authorised location with its own reason;
- a file this change created or changed, when the run assesses forfeiture (`touched`), since a finding there is the change's own breach: fix it there, or for an inline disable or directive, fix what the comment hides and remove the comment. With `forfeiture` set to `elsewhere` the check forfeits nothing, so the command writes debt on such a file like any other;
- a finding the catalogue gives no symptom or check to record against, such as one of a team rule set's clauses (`unrecordable`);
- a native exception no debt record can hold (`unrecordable`). A `config-override` is never recorded, since debt holds what is owed and an override on a clean file owes nothing: a file under it that breaks the check gets its debt from the finding, because Hone's own run does not read the override, so remove the override or narrow it. An `ignore` and a `suppression-entry` hide nothing from Hone's run, which has already recorded what it finds in the file, so remove them; a generated or vendored file under an `ignore` can instead be listed in `exclude`, which Hone's run then honours too, so no `ignore` line is printed for it. An inline rule configuration changes what the rule checks: remove the comment. A lint-script option gets the advice for why Hone could not judge it, the same as its `unrecorded` line.

When it recorded anything, a last line, `run <project command> to put the recorded debt into effect`, names the command that writes the projection those records need. [ADOPTING.md](ADOPTING.md#6-read-the-report) step 6 says what to do with each `unrecorded` line.

It adds each record to its symptom's file, writing the file when there is none yet, and leaves every record already there as written. It stages and commits nothing: the diff of `hone-records` is the review, and nothing takes effect until a person commits it. It never removes or rewrites a record, so running it again writes nothing the second time. A record whose debt is paid is removed by `hone prune-debt`, below. Run `hone project` after it when any listed check runs on `eslint`, so the projection carries the new records.

The command does not refuse to run again later, and has no flag for it. Forfeiture is what stops it turning new findings into debt: debt is forfeited once its file changes since `--base-revision`, so a record written for a file someone has just changed fails the next check that assesses forfeiture, and a file that is new or changed since the base gets no record at all. That holds only where forfeiture is assessed. In an arrangement that leaves it elsewhere, such as `"forfeiture": "elsewhere"` with the pre-push hook that assesses it bypassed, such a record is not caught until a run that does assess it.

### Pruning paid debt

Debt is a record that a finding is owed, and once the debt is paid the record should go. `hone prune-debt` removes the debt a run lists under `paid`, `stale` or `forfeited`: debt that another record answers in place of, debt on a file that is gone, a file the settings exclude, or a file whose check its engine measured there with nothing found, and debt on a file this change touched, whether or not that file still breaks its check. The `stale` line and the `prune-debt` line say which of the three it was. Only the engine knows what it measured. A file it was handed and skipped, a file outside the checked set and an engine that did not run are not measured, so their debt is unjudged: it is not listed as stale and the command leaves it.

Every other record stays for a person, such as a `stale` authorised location whose finding is gone: it carries a person's judgement, so delete it by hand.

The command runs the check with the `--base-revision` and `--forfeiture` it is given, so give it what the check was given. A check that finds debt that is paid names the command exactly in the `paid` section:

```text
paid (1)
claimed-type debt src/a.ts answered by authorised-location; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js prune-debt --repo /work/shop --base-revision origin/main to remove the paid debt
```

It prints `<symptom> removed <file>: <why>` for each record it removed, where `<why>` is `paid`, `stale` (followed by `, its file is no longer in the repository` or `, its file is excluded by the settings` when that is why) or `forfeited`, and nothing when it removed none. Like `hone record-debt`, it writes `hone-records`, keeps every other record's text as written, stages and commits nothing, and does not write the projection: run `hone project` after it when any check runs on `eslint`, so the projection drops the records' off-switches. When it removes the last record from a file, it deletes the file. It has no dry run, as no other Hone command has: the `prune-debt` lines name what it removes, and the diff of `hone-records` is the review.

For an `eslint` check, the off-switch the projection writes for a record is Hone's own. The check does not list it as a `config-override`, so it never counts as a native exception the record holds. A `config-override` on a check and file no record holds is reported under `unrecorded`, and `hone record-debt` never records it: remove the override or narrow it. Once a record is removed, a team off-switch placed after the projection is listed under `unrecorded` as a `config-override`, and one placed before it never takes effect, since the projection turns the rule on after it, so ESLint and the check both flag the file. A team block placed after the projection that sets a recorded file's rule to `"warn"` or `"error"` leaves the projection out of effect, and the check says `not-included`.

## Adopting the ESLint mechanism

With any check listed for `eslint`, run `hone project`. It writes `hone.eslint.mjs` at the repository root: one block enabling the listed checks' rules at `"error"` on `**/*.{ts,tsx,mts,cts}`, then one block for each group of files whose records answer the same checks, turning the rules of those checks `"off"` there. Beside it, it writes `hone.eslint.d.mts`, which types the projection's default export as ESLint's `Linter.Config[]`. Commit both, and spread the default export of the projection last in the repository's flat config:

```js
import hone from "./hone.eslint.mjs";

export default [
  // the team's own blocks
  ...hone,
];
```

This is the only supported way to adopt the checks. On every run, Hone reads the team's resolved configuration for each checked file and fails the run if the projection is missing, not in effect, or differs from what `hone project` would write now, with the line that says what to do:

```text
engine-not-run eslint missing: hone.eslint.mjs is not written; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit every file it writes
engine-not-run eslint not-included: the eslint configuration leaves the projection out of effect for a file under check; spread the default export of hone.eslint.mjs, or of a package's own hone.eslint.mjs in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), or, where a tool such as sku generates the configuration, last in the configuration the tool takes
eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit every file it writes
```

The command on these lines runs the entry file of the Hone that ran the check with `node`, with the repository the check measured, both as absolute paths with forward slashes, so it runs as printed from any directory; the lines above show an install at `/work/shop`. Re-run `hone project` after changing the checks or the records.

### Package slices

A package that runs ESLint from its own folder resolves the `files` of its config against that folder, so spreading the root projection there loses every record written with a root-relative path. `hone project` therefore writes one projection per config root, and beside each a `hone.eslint.d.mts` that types its default export as ESLint's `Linter.Config[]`, so a TypeScript config can import the projection and spread it. Commit both files in every folder. The repository root gets `hone.eslint.mjs` as above. Under the nearest-to-file lookup, each package folder with a tracked `eslint.config.*` is a config root; under the repository-root lookup a package's own config is never loaded, so it gets no slice. Each folder `hone.config.json` lists under `eslintConfigRoots` is a config root under either lookup. Each package config root gets its own `hone.eslint.mjs` beside it: the same checks, imported by a path relative to that folder, and only the records for files under it, with paths relative to it; every slice also carries the block that turns the listed checks' rules on. Each package config spreads its own slice:

```js
import hone from "./hone.eslint.mjs";

export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...hone];
```

A package with no `eslint.config.*` of its own is linted by the nearest config above it, so its records stay in that config's slice. A file is governed by the deepest config root that contains it. A folder holding its own `hone.config.json` is a nested Hone configuration, which is not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)): when the ESLint engine would check a file under it, `check` and `project` stop before anything is checked or written, while a run that lists only walker checks does not stop, as `load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; folders holding hone.config.json: <folders>; move them out of this repository, and run each on its own with --repo`. A folder holding one and no file the run would check gets no slice, and nor does anything under it. Either fix works today: run the folder on its own with `--repo`, as the line says, or govern it from this repository by removing its `hone.config.json` and keeping its records here, after which `hone project` writes its slice.

A config root keeps its slice even where a config above it ignores its folder: a lint run from that folder loads its own config and never reads the ignores above it, so `hone project` writes the same slices from the same inputs every time. A repository with only a root config gets exactly the projection it had before.

The check reports each package slice under the engine, naming the slice, whether it is the projection or its `hone.eslint.d.mts` that is out of date or missing. A package whose config spreads the root projection or nothing instead of its slice has its records out of effect, so the check reports `engine-not-run eslint not-included` rather than trusting a finding it could not have measured. A package that spreads the root projection is reported only once a record answers a file in it, since until then both projections give that package the same rules; one that spreads nothing is reported at once. A folder listed under `eslintConfigRoots` with no `eslint.config.*` on disk is unconfigured: nothing there can load its slice, so Hone would otherwise say nothing about that package; generate its config before the check runs, as a tool such as sku does on any of its commands:

```text
eslint out-of-date packages/a/hone.eslint.mjs: that slice differs from what hone project writes now; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit every file it writes
eslint missing packages/a/hone.eslint.mjs: that slice is not written; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit every file it writes
eslint unconfigured packages/a/hone.eslint.mjs: packages/a has no eslint configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check
```

A debt record stays in the projection after it is forfeited, so the team's own ESLint run keeps ignoring that file; Hone's check is what fails it, as `forfeited`.

Hone's own ESLint run uses only the runner's configuration, with ignores, suppressions and inline configuration off, so nothing in the team's setup can change a finding. Every way the team's setup can weaken a selected rule (a native channel) is reported instead, and only an override that matches a record is accepted.
## hone.config.json

At the repository root. It lists the checks the repository runs and the engine that runs each one. The example lists the checks `authored-class-or-this#class-keyword` and `authored-class-or-this#static-members-only` on ESLint and a team's check on the walker.

```json
{
  "version": 2,
  "ruleSets": { "team": "tools/disciplines" },
  "checks": {
    "authored-class-or-this#class-keyword": "eslint",
    "authored-class-or-this#static-members-only": "eslint",
    "team/some-symptom#some-check": "walker"
  },
  "exclude": ["vendor", "generated"]
}
```

- `ruleSets` names the repository's own rule sets, each a folder relative to the repository root, or `"."` for the root. The name `hone` is reserved for the rule set shipped with the tool; `hone/authored-class-or-this#class-keyword` and `authored-class-or-this#class-keyword` are the same address. A rule-set name may not start with `hone-`, and no declared name may be another declared name plus `-<suffix>`.
- `checks` maps a check address to an engine id, to `"not-run"` or to `"not-adopted"`. An address is `[<ruleSet>/]<symptom>#<check>`; no prefix means the `hone` rule set. The engine must be one the check lists.
- Listing a check adopts it. Every check of a symptom that a listed check sees must be listed or marked too: one that is neither is reported as uncovered, and fails the run.
- `"not-run"` states that the check is adopted and binds the repository, but its engine is not run: the check is not a true measure of the rule's intent here, or cannot work here. The rule is enforced by review. `"not-adopted"` states that the check does not apply to the repository. Either way the check is never run and never projected, and its engine is not loaded unless another check uses it. The report lists it under `not-run`, as `<check> adopted, engine not run: enforced by review`, or under `not-adopted`; both are informational, and the run is still a whole assessment. No engine may be named `not-run` or `not-adopted`.
- `eslintConfigLookup`, optional, is `"nearest-to-file"` or `"repository-root"` and says which `eslint.config.*` the team's own ESLint run applies to a file; see [Runtime](#runtime). Leave it out to let Hone detect it.
- `eslintConfigRoots`, optional, lists repository folders that get their own projection slice under either lookup although they track no `eslint.config.*`, such as a package whose config a tool generates and ignores; see [Package slices](#package-slices). Globs are refused. Each entry must be a folder git tracks files under outside every `exclude` path, spelled exactly as git spells it; any other entry stops the run before anything is checked or written, as `load failure: config-root-untracked <folder>:` with what to fix.
- `forfeiture`, optional, is `"this-run"` (the default) or `"elsewhere"`, and says which run assesses whether debt is forfeited; `--forfeiture` overrides it for one run; see [Commands](#commands).
- `reportOutput`, optional, is `"full"` (the default), `"actionable"`, `"counts"` or `"verdict-only"`: the repository's default for how much of the report the check prints. `--report-output` overrides it for one run; see [Commands](#commands).
- `checkEditions`, optional, is `"pinned"` (the default) or `"latest"`. A check that has been tightened has more than one edition, listed on its CHECKS.md. `"pinned"` runs each check's default edition, which changes only in a major release; `"latest"` runs the newest edition the installed Hone has for every listed check, so a minor release can add findings. `"edition"` in a check's `checkSettings` holds that one check to the edition it names over either. The report lists the edition each such check ran under `editions`.
- `checkSettings`, optional, maps a listed check address to an object of that check's settings, for a check whose CHECKS.md lists settings. Each key must be one the check's piece declares, and its value must be the same JSON kind as the declared default and, where the piece lists choices, one of them; the value replaces the default. Anything else makes `hone.config.json` malformed, naming the check, the key and what is accepted; `confinedPackages` is refused there, as the setting is now `confinedOutsideDependencies`.
- `exclude`, optional, lists repository folders or exact files that no engine checks. A folder entry covers everything under it. Globs are refused: an entry containing `*` makes `hone.config.json` malformed. The report lists the active entries under `excluded`. Exclude Hone's own install when it is vendored inside the repository.
- `generated` and `layers`, optional, are declared for checks that will read them; no check reads either yet, and the report says so under `settings-notes`.

The keys version 1's `disciplines.json` used under other names are refused, each naming what replaces it: `clauses` is `checks`, `clauseSettings` is `checkSettings`, `assessment` is `forfeiture`, and `fileExceptionWhyChains` is gone, since every record shows its why-chain. [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 lists what moved.

## hone-records

A folder at the repository root; without it, no record answers any finding. It holds the records that answer findings, one file for each kind and symptom or recipe, each a document `{ "version": 2, "records": [...] }`:

```text
hone-records/
  debt/
    claimed-type.json
  authorised-locations/
    claimed-type.json
  deviations/
    adapter-per-outside-party.json
  boundary-records.json
  dependency-records.json
```

A file in the wrong folder or under a name that is not a catalogue name is still read, and its records are refused as `misplaced` or `not-a-records-name`, naming where each belongs. Each record answers the findings it reaches, and names what it reaches by the symptom's name, or by `<symptom>#<check>` to reach one check of it.

```json
{
  "version": 2,
  "records": [
    { "answers": "claimed-type#cast-expressions", "file": "src/legacy.ts", "note": "..." }
  ]
}
```

- **Debt** is in `hone-records/debt/<symptom>.json`: `answers`, `file` and an optional `note`, a note to future developers on what the debt signals, which nothing reads. It says a finding in one file is owed. It needs no case and no why-chain; forfeiture is what holds it: it is forfeited once its file is touched.
- **An authorised location** is in `hone-records/authorised-locations/<symptom>.json`: `answers`, `file`, `case` and `owes`, naming the case the file is and the principle it owes, and a `whyChain`. It says the symptom is correct in that file. [`hone authorise`](#commands) writes one from the arguments it is given.
- **A deviation** is in `hone-records/deviations/<recipe>.json`: `recipe`, `file`, `recipeReason`, `reasonFails`, `evidence` and `ruleHolds`. It says why a file does not follow a recipe the catalogue gives.
- **A boundary record** is in `hone-records/boundary-records.json`: `module`, `outsideParty` (a runtime facility such as `runtime:clock`, or an outside module's specifier), the `ports` the module declares and an optional `conformist`. It says the module is where an outside party is met.
- **A dependency record** is in `hone-records/dependency-records.json`: `dependency`, `nativeWay`, `whyNotEnough` and an optional `peerRisk`. It says why a package is used where the platform's own way exists.

An `authorised-location` follows the [why-chain contract](docs/why-chain-contract.md): exactly five `{ "why", "because", "evidence" }` steps chained cause to cause, then `rootCause`, `rootEvidence`, `readback` and `owner`. The contract lists what Hone refuses and what review still judges:

```json
"whyChain": {
  "whys": [
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." }
  ],
  "rootCause": "...",
  "rootEvidence": "...",
  "readback": "...",
  "owner": "..."
}
```

- A record that `hone upgrade` moved from version 1 keeps its old entry word for word under a `carried` key, in place of the keys version 1 did not hold. The check lists it under `carried`, with what it lacks, and judges it against `--base-revision`: it is `established` when the base held it unchanged and `unjudged` when the run could not compare it; a carried record changed since the base is refused as `carried-changed-since-base`. [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 describes them.
- A record the catalogue does not recognise, or whose form is wrong, is refused with its records file and index, and the run fails. A record that names a case or an `owes` the catalogue does not list is kept, with a note under `record-notes`.
- A record that answers no finding and holds no native exception is stale where the checks it reaches were measured at its place, or its place is gone or excluded; a record whose checks were not measured there is unjudged, not stale, and a dependency record, which no check reads yet, is never stale. Debt on a file this change touched is forfeited, and a record that duplicates another is refused. Each fails the run. Debt that another record answers in place of is paid, which does not.
- An inline exception, an `eslint-disable` comment naming a selected rule or no rule, or a `@ts-expect-error`, `@ts-ignore` or `@ts-nocheck` directive under `claimed-type#unlisted-cast-site`, is held only by a record on its check and file. A comment naming no rule escapes every selected ESLint check and needs one per check. Without a record it is listed under `unrecorded` and fails the run. A lint-script option that weakens the whole run, such as `--rule`, `--suppress-all` or `-c` naming another config, cannot be recorded.
- Files are exact repository paths, never globs.

## Installing

Hone installs as one npm package, `@hailstails/hone`, installed from npm at an exact version, `@hailstails/hone@<version>` with `--save-exact`, downloaded as the tarball `hailstails-hone-<version>.tgz` attached to a GitHub release, or built by `pnpm run pack-package` into `artefacts/hailstails-hone-<version>.tgz`, the file name `npm pack` gives the scoped package, and added to the repository root as a development dependency; [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps. The package is plain JavaScript holding only Hone's own code. It declares `zod`, `jsonc-parser` and `@eslint/plugin-kit` as `dependencies`, each as a caret range starting at the version `pnpm-lock.yaml` locks, so the package manager installs them from the registry, and the repository's own audit tools see them as it does any other dependency. Which release inside each range is installed is decided by the repository's own lockfile and overrides, so a patched release can be taken without waiting for a new Hone. It declares the toolchain as `peerDependencies`, `typescript` required and the ESLint packages optional, and exposes one command, `hone`, whose six subcommands are described under [Commands](#commands). It ships the rule data and pages, both mechanisms, the review methods and the why-chain contract, and no TypeScript source, only the declaration files of the public type entries below.

With the ESLint mechanism selected, a packaged install's projection imports one plugin, `@hailstails/hone/eslint-plugin`, registered under the namespace `hone`, so the repository's ESLint must resolve the package from the repository root. Hone compares the committed projection `hone.eslint.mjs` and its declaration `hone.eslint.d.mts` byte for byte with what `hone project` would write now.

## Public type entries

The package has three public entries for TypeScript. `@hailstails/hone/rule-set` holds types only, so importing it adds no code to a build; import it with `import type`. `@hailstails/hone/audit` adds three values to its types, and `@hailstails/hone/testing` is for a team's own tests.

| Entry | Status | What it is for |
| --- | --- | --- |
| `@hailstails/hone/rule-set` | Stable | The shapes of `discipline.json`, `piece.json` and an ESLint piece's `settings`, for a team writing its own rule set. Identifiers and paths are plain strings: Hone checks them when it reads the files. |
| `@hailstails/hone/audit` | Experimental | The types for writing an audit walker piece, `WalkerPiece` and what it needs, including `PieceFailure`, the failures a piece may return. Clause addresses and file paths reach a piece from Hone, already checked, and a piece passes them back unchanged. Its three values are `folderScope`, which tells a piece whether a file sits in a generated folder; `isEdition`, which narrows a text such as `"2"` to an `Edition`; and `editionReaches`, which tells a piece whether the edition that runs covers something introduced in a given edition. It may change in a minor release. |
| `@hailstails/hone/testing` | Experimental | Runs a team audit clause's `cases` through its piece with the installed audit runner (`clauseConformanceOf`), and hands a test the clause bound as `hone check` binds it (`clauseUnderTestOf`) and a checked file path (`repoPathOf`). Hone does not run these tests itself. It may change in a minor release. |

Each resolves with `moduleResolution` `"nodenext"` or `"bundler"`. `install-proof` type-checks a team piece and rule set against them, and checks that a wrongly typed field fails: on TypeScript 4.8.4 from an ES module with `"nodenext"` (4.8 has no `"bundler"`), and on 6.0.3 from an ES module with both and from a CommonJS file. A CommonJS file (`.cts`, or `.ts` in a package that is not `"type": "module"`) can import these types on TypeScript 5.8 or later with `module` `"nodenext"`. With `module` `"node16"`, and on TypeScript 5.3 to 5.7, the import needs `with { "resolution-mode": "import" }`, and older versions reject it. These CommonJS figures were checked once by hand, on 5.8.2, 5.3.3 and 6.0.3 with `"node16"`; `install-proof` checks only the 6.0.3 CommonJS case with `"nodenext"`. `@hailstails/hone/audit` names TypeScript's own syntax types, so it needs the `typescript` the repository already installs as a peer. No other path in the package is a public TypeScript entry.

## Runtime

- Windows, Linux, macOS or WSL. Hone keeps absolute paths in the platform's own form and repository paths in POSIX form, as git reports them. CI proves Windows and Linux; macOS is not proven in CI.
- The package: Node `^22.18.0 || >=24` (its `engines.node`). It is plain JavaScript, so Node never strips types from it, and from 22.18.0 Node strips types from a rule set's `.ts` piece modules, within the limits [ADOPTING.md](ADOPTING.md#1-check-the-prerequisites) lists.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- Hone's own packages, `zod`, `jsonc-parser` and `@eslint/plugin-kit`, declared in `dependencies` as caret ranges whose floor is the version `pnpm-lock.yaml` locks, which is the version Hone is tested on. A caret range keeps to one major version, and for a `0.x` package to one minor. The repository's package manager installs a release inside each range, and the packages it depends on, where Hone resolves it; the repository's lockfile, and any override it sets, decides which release. They are implementation details: nothing of theirs crosses into the repository's code or configuration. A repository that uses `zod` itself may share one copy with Hone when its version is inside Hone's range, as package managers do for compatible versions, and otherwise keeps its own copy beside Hone's.
- The repository's own toolchain, declared as `peerDependencies`: `typescript` `>=4.8.4 <7.0.0`, a required peer because every audit clause needs it, and for the ESLint mechanism the optional peers `eslint` `^9.39.5 || ^10.15.0`, `@typescript-eslint/parser` `^8.73.0` and `@typescript-eslint/eslint-plugin` `^8.73.0`. npm 7 and later install a missing required peer on their own, so declare `typescript` at the root at the version the repository uses. Hone supports the latest release of each supported major, ESLint 9.39.5 and 10.15.0 and typescript-eslint 8.73.0, and raises those floors deliberately as new releases land. TypeScript 4.8 is the oldest whose syntax API the audit uses (`getModifiers`). TypeScript stops below 7 because TypeScript 7's compiler API is a different one. Yarn Plug'n'Play is not supported.

Hone loads the toolchain by Node's own resolution, upward from the install directory, which is the same resolution the pieces' plugin modules get when the team's ESLint loads the projection. Hone's query of the team's configuration, its governance run and the pieces therefore all use one copy, the repository's. Keep the toolchain resolvable from the repository root: declare it in the root `package.json` (in a pnpm workspace, `pnpm add -Dw`). A package may install a different ESLint for its own lint script; Hone's verdict still comes from the root's, its governance behaviour is the same on either supported line, and the pieces that wrap native rules wrap the root's copies there too. Hone's tests run the governance path and every piece's shared cases on two ESLint lines, 9.39.5 and 10.15.0, with typescript-eslint 8.73.0, and the audit pieces' shared cases on TypeScript 4.8.4 and 6.0.3; the in-process consumer fixtures run on ESLint 10.15.0, and `install-proof` runs real consumers on each supported ESLint major.

A peer that is missing, cannot load, or is outside its range stops the engine before any piece loads, with one line such as `load failure: engine-failed eslint toolchain-unavailable eslint found not installed, supported ^9.39.5 || ^10.15.0: add a supported version to the devDependencies of the repository root`. The line names every peer of that mechanism that is unavailable, separated by `; `, and then asks for a supported version of each, so one install fixes them all. A `typescript` that is not installed at all is reported the same way, with the line saying that `typescript` is a required peer of `@hailstails/hone` and the install is incomplete, since a supported install always has it; one that is installed but out of range or unloadable gets the plain line. A peer that resolves from inside the installed package, such as an `eslint` left in `node_modules/@hailstails/hone/node_modules`, stops it as `toolchain-shadowed`, naming where it resolved and the folder to delete before reinstalling core. A source checkout of Hone is its own development install, so its development toolchain in its own `node_modules` is not a shadow.

A repository can hold one `eslint.config.*` at its root or one per package. Hone resolves the team's configuration the way the team's own ESLint run does. ESLint 10, and ESLint 9 started with `--flag v10_config_lookup_from_file` (or `unstable_config_lookup_from_file`), use the `eslint.config.*` nearest each checked file. Plain ESLint 9 uses only the one in the directory it runs from, so for a repository whose `eslint` resolves to 9.x at `node_modules/eslint` and whose lint scripts carry no such flag, Hone reads the root `eslint.config.*` for every file, and fails the run as `team-config-unloadable` if there is none. When Hone cannot read an installed `eslint` at the repository root it assumes the nearest-to-file lookup. Each config that applies to a file must spread its projection: the root config the root projection, each package config its own slice; see [Package slices](#package-slices). A config that fails to load stops the run as `team-config-unloadable`, naming the config, the checked file it applies to and ESLint's message, then the next step: fix that config. Only if its folder holds nothing Hone should check, add it to `exclude` in `hone.config.json` instead. A broken config in a folder that the repository's own ESLint never enters does not stop the run. Before failing, Hone asks the config that governs that folder, and each config above it up to the root, whether it really ignores both that folder and the file; a file that no `files` block matches is not taken for an ignored one. If one does, the file is treated like any other file the team's ESLint ignores and reported as an `ignore` native exception. Hone asks about a folder through a file inside it, so one gap remains: an ignore that matches every entry directly inside the folder but not the folder itself, such as `gen/*`, counts as ignoring `gen`, and Hone reports its files as ignored where the team's `eslint .` still loads the broken `gen/eslint.config.*` and fails. A file that no `eslint.config.*` applies to stops the run the same way, and the next step is to create one at the repository root that spreads the projection, as [ADOPTING.md](ADOPTING.md) step 4a shows. Detection cannot see how a task runner starts ESLint, so `hone.config.json` can state the lookup: `"eslintConfigLookup": "nearest-to-file"` or `"repository-root"`, which overrides detection. Both lookups are tested against monorepo fixtures with a config per package.

## Compatibility

Hone's version numbers follow semantic versioning under these rules:

- A new or tightened check ships off by default in a minor release and becomes a default only in a major release. A new check arrives as a new check of a symptom, which a repository adopts by listing it. A tightened check arrives as a new edition of the check, which runs only for a repository that sets `checkEditions` to `"latest"` or names the edition in the check's `checkSettings`; a major release makes it the default edition and may retire older ones.
- A change to the ESLint config that `hone project` generates, which an adopter must regenerate, is a minor release, with a clear message telling the adopter to regenerate: its changelog entry says to run `hone project` and commit the result, and until then the check reports the projection `out-of-date`.
- Renaming or removing a check address, a config key in `hone.config.json`, a records file or a key of a record, or a CLI flag, or changing what one means, is a major release. Adding one with a safe default is not.
- A change to what [the output contract](docs/output-contract.md) says a tool can parse is a major release: the command and option names, the exit codes and streams, the report's sections, outputs and verdict lines, the load failure kinds, and each line's leading fields up to its first value that may hold a space. What it marks not stable, such as the help text, the wording of `arguments-invalid` and `readFirst` lines and the repair text after a load failure's values, may change in a minor release, and a minor release may add a section, a kind of line or an option.
- A breaking change to a type in `@hailstails/hone/rule-set` is a major release. `@hailstails/hone/audit` is experimental: its types may change in a minor release until it is marked stable.
- A pre-release previews the release it is numbered towards and is published under the `next` dist-tag. A change no larger than the one a pre-release is numbered towards lands in that release's next pre-release; a larger one starts the line of the larger version it calls for. The changelog lists each change either way.

`hone.config.json` and the records in `hone-records` follow the same rules. A new key with a safe default, where nothing changes for an adopter who does not set it, is not breaking and can arrive in a minor release. A new required key with no safe default is breaking, and so is a change that makes a file that loads today stop loading or mean something else; both wait for a major release.

A check that accepts an engine keeps accepting it: an engine is never removed from the engines a check lists, so a `hone.config.json` that names it for the check keeps loading. A check can only gain engines. The standalone engine's id is `walker`; `audit` was version 1's name for it, and `hone.config.json` naming it is refused as `engine-not-allowed`.

Each release's changes are listed in [CHANGELOG.md](CHANGELOG.md), which the package ships: after an upgrade, read `node_modules/@hailstails/hone/CHANGELOG.md` for what changed between the version you had and the one you have now.

## Known limits

The ESLint engine registers one plugin under the namespace `hone`, so a check's rule id is `hone/` followed by the check's address, `hone/<symptom>#<check>`, such as `hone/authored-class-or-this#class-keyword`: the address `hone.config.json` and the records write, character for character. A rule id that splits the address with a slash names no check, and an inline disable that writes one is listed under `misnamed`. The namespace `hone-core` is reserved for Hone's own machinery, never a check's rule: it names the governance rule `hone-core/inline-config`, which reports inline configuration comments. The projection's own blocks are named `hone/checks` and `hone/answered/<reaches>`. No piece may use it.

Hone's tests cover each supported platform's ordinary paths and drives, and a committed ESLint projection checked out with either LF or CRLF line endings. The cases below are not covered by tests. Some may already work, but none is supported until a consumer needs it and a test is added:

- File and folder names outside ASCII.
- Windows device paths (`\\?\C:\...`).
- Repositories or installs on a network share (`\\server\share\...`).
- Paths rooted without a drive (`\repo`).
- Drive-relative paths (`D:file`).
- A working directory that is deleted or can't be read.
- File names containing a backslash.
- A lone carriage return as a line ending.
- `.d.mts` and `.d.cts` declaration files are not handled separately from other sources.
- Columns reported on lines holding non-ASCII text.
- Lint scripts are read with a simple shell tokenizer, so unusual quoting or a `cd` before `eslint` is not interpreted.
- A script whose quotes do not pair as `sh` reads them, such as `echo don't stop`, is passed over when nothing in it names `eslint`. One that names `eslint` is listed as an unreadable `command-line-option` on every selected ESLint clause, since Hone cannot tell what it passes to ESLint.
- Detection reads an ESLint 9 run started from inside a package, or given the lookup flag through the environment or a task runner, as a root-only run; set `eslintConfigLookup` in `hone.config.json` for those repositories.
- Team ESLint configs that imitate projection block names, register a second copy of the plugin, or use processors are not exercised.
- A byte-order mark at the start of `hone.config.json` or a file under `hone-records`; save them without one.

## Developing Hone

This repository is self-contained: it holds its own configuration and its own lock. `package.json` declares the packages the code imports and the development tools, `pnpm-lock.yaml` locks both, `tsconfig.json` typechecks the code under `strict`, `lint.biome.json` configures the linter, and `vitest.config.ts` runs its tests. `package.json` pins the pnpm version that locks and installs them, `pnpm-workspace.yaml` holds its settings, and pnpm resolves a dependency only to a release that is at least three days old when a dependency is added or updated; installing from the lock does not re-check it. Run `corepack enable` once so that Node provides that pnpm, install with `pnpm install --frozen-lockfile` in this directory, then run a script from it with `pnpm run <script>`:

| Script | Runs |
| --- | --- |
| `typecheck` | `tsc` with `tsconfig.json` |
| `lint` | Biome with `lint.biome.json` |
| `test` | Vitest with `vitest.config.ts` |
| `check` | all three in that order |
| `build-package` | `node scripts/build-package.ts`: compiles Hone's own code with esbuild into `dist/`, leaving each declared peer and dependency to be imported by name, and adds the published `package.json`, which declares the dependencies at the ranges `package.json` declares, and the shipped documents and data. It fails if a dependency is not declared as a caret range of one release, if that range's floor is not the version the lock's root importer holds, or if the lock does not hold it, if an output imports anything but a `node:` builtin, a declared peer or a declared dependency, if an output carries an installed package's code, if a command or runner is not emitted at its own path with its own code, or if a shipped page links to a file the package does not ship. The tool's name, package name, command name, shipped rule-set name, reserved ESLint namespace, description, GitHub repository and the unrelated npm name to warn against live in `core/values/tool-identity.ts`, which the build, the install proof, the release text, the command's usage line and the ESLint runner all read. The reserved namespace is its own field, independent of the package name |
| `pack-package` | `node scripts/pack-package.ts`: builds `dist/` and packs it with `npm pack` into `artefacts/hailstails-hone-<version>.tgz`, named by the `version` in `package.json` |
| `package-determinism` | `node scripts/check-package-determinism.ts`: builds and packs twice into separate temporary roots and fails naming any file that differs, or when the two packed tarballs differ |
| `self-check` | `node scripts/self-check.ts check --repo .`: runs Hone's own check on this repository with `disciplines.json` and the exception records in its `discipline-exceptions` folder; pass `--base-revision <rev>` after the script name. See [Core's check on itself](#hones-check-on-itself) |
| `install-proof` | `node scripts/install-proof.ts`: packs the package once into a temporary tarball, or, given `--tarball <path>` after the script name, copies that already packed tarball there instead, and installs it with pnpm into six CommonJS consumers in an OS temporary directory outside the working tree, each copied from its folder under `tests/test-fixtures/consumer-proof/`, which holds only what that consumer's action needs. Each consumer exists for one thing only an installed package shows. The audit consumer, on TypeScript 4.8.4, runs `check` through the installed bin and expects its finding. The ESLint 9.39.5 and 10.15.0 consumers run `project`, expect a projection importing the piece by package name, and expect its finding from `check`. The consumer without `eslint` expects `toolchain-unavailable`. These four run with type stripping off. The team consumer is the example [docs/extending.md](docs/extending.md) follows. On TypeScript 4.8.4 it type-checks a wrong team piece, rule set and ESLint piece settings with its own `tsc`, as described under Public type entries, and expects the three errors. On the development versions, TypeScript 6.0.3, ESLint 10.15.0 and typescript-eslint 8.73.0, it also type-checks its rule set under `nodenext` and `bundler` and a CommonJS file, then runs both commands with type stripping on: its `.ts` pieces load through the installed package and give one finding from each mechanism under the team's `acme/` prefix. Its root says `"type": "commonjs"`, the hard case, so its rule set carries its own `"type": "module"` `package.json`. Each consumer declares its toolchain at exact pins in its own `devDependencies`, as an adopter does: TypeScript 4.8.4 alone for the audit consumer, the consumer without `eslint` and the team consumer on 4.8.4; ESLint 9.39.5 with typescript-eslint 8.73.0 and TypeScript 4.8.4 for the ESLint 9 consumer; ESLint 10.15.0 with typescript-eslint 8.73.0 and the development TypeScript for the ESLint 10 consumer and the workspace; and the development versions for the team consumer. It declares the tarball beside them, pins the pnpm version this repository's `package.json` pins, and waits this repository's `minimumReleaseAge`. pnpm's store shares each toolchain package between consumers. The proof prints where pnpm put the installed package, checks that each of Hone's dependencies is installed beside it at a release inside its published range, and expects the report to name its pages through the consumer's `node_modules/@hailstails/hone` instead, and it runs `check` through the package script with its options after `--`, as an adopter's pre-push hook does. A pass once a violation is removed, rule-set naming, plugin namespaces, settings overrides and per-package ESLint configs are proven by unit and in-process tests instead. The temporary directory is removed afterwards |
| `pull-request-title` | `node scripts/pull-request-title-command.ts <title>`: passes a title shaped as a Conventional Commits subject, `type(scope)!: description`, and fails any other with the expected form. See [Versions and releases](#versions-and-releases) |
| `release-pull-request` | `node scripts/release-pull-request-command.ts [pre-release\|stable]`: writes the next release's section into `CHANGELOG.md` and its version into `package.json`, in the working tree only. See [Versions and releases](#versions-and-releases) |

### Hone's check on itself

`disciplines.json` selects every mechanical clause Hone ships, through the mechanism it names, confines the `eslint` package under `confinedPackages`, the setting of `outside-import-past-a-boundary#import-or-require` (clause `CD-19#import-boundaries`), and excludes `tests/test-fixtures/consumer-proof`: those folders are package-test content, the files of other repositories that `install-proof` copies out and checks with their own Hone run. `eslint.config.mjs` spreads the committed `disciplines.eslint.mjs` projection, which `node scripts/self-check.ts project --repo .` regenerates. Hone keeps its exception records in [the split layout](MIGRATING.md#16-moving-to-the-split-layout): `discipline-exceptions/authorised-locations/cd-19.json` holds eight `authorised-location` records for `CD-19#import-boundaries`, each the single file that binds a runtime or third-party surface; seven are imported, with `existing-authorisation` provenance, from the earlier records kept in `.constitution-authorised-locations/cd-19.json`, and the eighth, for `mechanisms/eslint/runner/native-rules.ts`, carries its own why-chain. Strictness lives in `tsconfig.base.json`, which `tsconfig.json` extends; `tsconfig.json` leaves the same consumer folders out, since their files compile against the installed package.

`self-check` prints Hone's full report on itself, then one `self-check:` line. It fails when the run cannot load, or when any of `uncovered`, `stale`, `forfeited`, `doublyHeld`, `invalidRecords`, `unmeasured` or `projectionProblems` holds an entry: that is, when the selection, the exception records or the projection are not sound. It does not fail on `findings` or `unrecorded`. Those are printed in full and counted in the `self-check:` line, but they do not gate a change yet: the test fixtures hold deliberate violations, and some of Hone's own code does not meet every selected clause. CI runs `self-check` on every change with the pull request's base, or the previous `main`, as the base revision.

Continuous integration runs on every pull request, drafts included, and on every push to `main`, from `pnpm-lock.yaml` alone, in two jobs, both required checks. They run side by side on the oldest claimed Node. Linux runs `check`, `self-check` and `package-determinism`, packs as the release does, and proves the tarball installs on a newer Node. Windows packs and proves its own tarball. A third job fails when the two tarballs differ. macOS is not proven in CI. A separate workflow, `pull-request-title.yml`, runs `pull-request-title` on each pull request's title whenever the pull request is opened, edited, reopened, marked ready or pushed to.

### Versions and releases

Pull requests are squash-merged, and the pull request's title becomes the commit's subject on `main`. The `pull-request-title` check requires that title to be a Conventional Commits subject: `type(scope)!: description`, where the scope is optional and lowercase, `!` marks a breaking change as [Compatibility](#compatibility) defines it, and the type is one of `feat`, `fix`, `perf`, `revert`, `docs`, `refactor`, `test`, `build`, `ci`, `chore` or `style`. Reverting behaviour that has been released is breaking, so its title is `revert!:`; `revert:` without `!` is for undoing a change that has not been released, and counts as a patch. A title that changes the ESLint projection says that adopters must run `hone project`, since the title becomes the changelog entry. `.github/dependabot.yml` leaves Dependabot's routine version updates off and gives its security pull requests a conventional title with the type `build` and a scope, such as `build(deps):`. It covers the GitHub Actions the workflows use and, through the `npm` ecosystem, which is how Dependabot names pnpm, the JavaScript dependencies in `pnpm-lock.yaml`. A security release published in the last three days can be held back by the minimum release age when pnpm resolves it.

To prepare a release, create a new branch at the tip of `main` and run `pnpm run release-pull-request` on it before anything is committed to it. It finds the highest release tag `v<version>` merged into `HEAD`, reads the full message of every commit after it, and works out the next version by semantic versioning alone. It sizes the release from every commit since the latest stable release tag, or, when no release is stable, since the earliest release tag, so a pre-release line is sized by all it holds and not only by what followed its last pre-release. It needs the commits since the tag it sizes from, which include those after the latest tag, to be the straight line of squash-merged commits that `main` holds, so it refuses, changing nothing and naming the commits, when any of them is a merge commit, since a merge brings in changes whose subjects it cannot size. It works out the version like this:

- A subject with `!`, or a message with a `BREAKING CHANGE:` or `BREAKING-CHANGE:` footer line, is a major change, `feat` a minor change, and every other subject a patch. The largest change decides the release.
- On a stable release, the change increments the version: a patch increments the patch number, a minor the minor number with the patch reset to 0, and a major the major number with both others reset to 0.
- On a pre-release, a change no larger than the one the pre-release is numbered towards moves to the next pre-release number; a larger one starts the larger version's first pre-release, numbered `-pre.1`.
- The release stays on the latest tag's channel, so after a stable release the next is stable unless asked otherwise. Pass `pre-release` to start a pre-release line from a stable one, numbered towards the version the change would give, and `stable` to finish a pre-release line as its stable version.

The first stable release is made the same way. The `0.1.0` pre-release line holds breaking changes, so on the branch for that release `pnpm run release-pull-request stable` finishes the line with major version 1, minor and patch 0, and every release after it follows the rules above.

It then writes a section for that version at the top of `CHANGELOG.md`, grouping the subjects under Breaking changes, Features, Fixes and Other changes, and sets `version` in `package.json`. It refuses, changing nothing, when no subject follows the latest tag, when a merge commit follows the latest tag or the tag it sizes from, when `package.json` is not at the tag's version, or when the changelog already has the new version. A subject that is not a Conventional Commits subject is named on standard error and counted as a patch under Other changes, or as a major under Breaking changes when its message has a breaking footer, so check its place before opening the pull request. If writing the second file fails, it restores the first. The script only edits those two files: it never commits, tags, pushes or publishes. Open the release pull request with the title `chore(release): <version>`. Merging it is the release: no tag is pushed by hand and nothing is run after the merge. `.github/CODEOWNERS` makes the owner, `@HailsTails`, the code owner of `package.json`, `CHANGELOG.md`, `.github/workflows/`, `.github/CODEOWNERS` itself, the `scripts/release-*` scripts, `scripts/published-manifest.ts`, which writes the published `package.json`, `core/values/tool-identity.ts`, which names the package and its repository, and `pnpm-workspace.yaml`, which holds the `minimumReleaseAge` the release job installs under, so a release pull request, or any change to how a release is made, needs her code-owner approval before it can merge. That also covers every change to `package.json`, dependency updates included, since the version a release is triggered by lives there.

`CHANGELOG.md` names versions, so it stays in the repository and out of the package; the shipped pages link to it on GitHub.

The release workflow, `release.yml`, starts on a push to `main` that changes `package.json`. Its first job runs `scripts/release-state-command.ts` with the pushed commit, `package.json` as pushed, `package.json` as it was before the push, and the `v*` tags `git ls-remote` lists on the repository. It prints the tag `v<version>` for the pushed version and one of three states. `version-unchanged`: the push leaves the version as it was. `already-released`: the tag already names the pushed commit, as when a finished release run is run again. `unreleased`: the push changes the version and no tag has its name. It refuses, failing the run and printing no state, when either `package.json` has no readable version, when the pushed version is not `major.minor.patch` with an optional `-<identifier>.<number>`, when it cannot read the listed tags, or when the version's tag already names a different commit. That last refusal is how a `v<version>` tag made by hand, or a version set back to one released earlier, shows up instead of silently passing for a release; delete the tag if the workflow did not make it, or prepare a new version. Only `unreleased` runs the rest of the workflow; the other two end the run there, successfully, with the release and staging jobs skipped. A push that leaves `package.json` alone does not start the workflow at all.

For an unreleased version, the release job runs `check`, `package-determinism` and `install-proof` on the pushed commit, packs the tarball with `pack-package`, records the tarball's name and SHA-256 as outputs of the release job, and creates a GitHub release for `v<version>` at that commit with the tarball attached. Creating the release creates the tag: the tag is the record that the version is released. `gh release create` creates that release as a draft, uploads the tarball and only then publishes it, which is when the tag is made, so with immutable releases on, the tarball is attached before the release's assets and tag become immutable, and a run that fails before then leaves no tag. When a tag of that name already exists, GitHub attaches the release to it and ignores the commit asked for, so the release job then reads the tag back from the repository with `scripts/release-tag-command.ts` and fails unless it names the pushed commit. A tag made by hand on another commit while the job ran therefore stops the run before anything is staged on npm; the failure says to delete that GitHub release and release a new version with a new release pull request, since re-running would find the tag on the wrong commit and refuse. The `release tags` ruleset leaves creating `v*` tags open, so the workflow's own token can make the tag, and restricts updating and deleting them. A tag or release made with the workflow's own token starts no other workflow, and no workflow here starts on a tag. `scripts/release-text-command.ts` prints the release's title from the identity and the tag, its notes, which name the npm install command under its dist-tag and the attached tarball but no version, and its dist-tag: `next` when the version has a pre-release part such as `-pre.1` before any `+` build metadata, otherwise `latest`. The release is marked as a pre-release exactly when its dist-tag is `next`, and the step stops if any of the three cannot be printed. The release does not wait on npm.

A version reaches npm in four steps:

1. The merged release pull request creates the GitHub release and its tag, as above.
2. A second job downloads that release's tarball, refuses it unless its SHA-256 equals the one the release job recorded in the same run, and stages it with `npm stage publish` under the release job's dist-tag. A staged version is held by npm and cannot be installed. Its dist-tag is fixed when it is staged.
3. The npm owner approves it, on npmjs.com under `@hailstails/hone`, Staged Packages, or with `npm stage approve <stage-id>`. Approval needs the owner's two-factor sign-in, so CI cannot approve.
4. The version is published under its dist-tag and installable.

The second job runs in the GitHub environment `npm`, which accepts only the `main` branch, and only when the repository variable `NPM_PUBLISH` is `enabled`; with any other value, or none, it is skipped and the release is unaffected. It authenticates by npm trusted publishing, so no npm token is stored. The trusted publisher is saved on npmjs.com under `@hailstails/hone`, Settings, Trusted publishing, GitHub Actions, as: user `HailsTails`, repository `hone`, workflow filename `release.yml`, environment `npm`, with both allowed actions, "npm publish" and "npm dist-tag", unticked, so CI can only stage. The published `package.json` carries `repository`, `homepage` and `bugs` from the identity's repository, which trusted publishing matches against this repository, and `publishConfig.access` `public`, because npm otherwise publishes a scoped package as restricted. `build-package` fails if a shipped page names a versioned tarball of the package, at any version, or the version in `package.json`, with or without a leading `v`, so a page cannot name the current version and go stale on the next release.

npm does not check a trusted publisher when it is saved, and one that has not completed a successful publish within 2 days of being added expires and can no longer be used or edited. npm's documentation does not say whether a staged publish counts as that first publish, so save the trusted publisher only just before merging a release pull request, and approve the staged version within the same 2 days. A re-run of an older release run stages a version npm already has, so it cannot complete that first publish.

Re-running a release run never releases a version twice. Re-running all its jobs runs the first job again, which finds the tag and ends the run. When the release job failed before publishing the release, there is no tag, so re-running the run releases that same commit. When only the staging job failed, re-run the failed jobs: the staging job runs again with the outputs of the release job it followed, and npm refuses a version it already holds.

The release relies on these repository settings, which only the owner changes:

- The `main` ruleset requires a pull request with one approval, squash merging only, and "Require review from Code Owners" on, so `.github/CODEOWNERS` holds.
- The `release tags` ruleset restricts updating and deleting `v*` tags but not creating them, so the release job's own token can create the tag. A tag publishes nothing: no workflow starts on a tag, and the environment `npm` does not accept one.
- The environment `npm` accepts only the `main` branch.
- The repository variable `NPM_PUBLISH` is `enabled` for the staging job to run.

Merging the release pull request does not make the version installable: staging on npm still waits for the owner's approval there, as step 3 above says.

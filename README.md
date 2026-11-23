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

Two engines ship: `walker`, a standalone TypeScript syntax walker, and `eslint`, which runs the check as an ESLint rule inside the team's own ESLint setup. Rules are referred to by name; a number is only a clause address. [rules/README.md](rules/README.md) explains how the named pages read, and [the checks page](rules/typescript/checks.md) lists every check; a check that needs ESLint says so on its page. The rest are judgement rules, applied in review with the review methods in [methods/](methods/README.md).

To adopt Hone in another repository, follow [ADOPTING.md](ADOPTING.md) step by step. A repository already using the older standalone route, or a copy of Hone's source, follows [MIGRATING.md](MIGRATING.md) instead.

A team adds its own symptoms and checks as a rule set in its own repository, with ESLint and walker pieces, following [docs/extending.md](docs/extending.md). Adding a symptom, check or engine to Hone itself, and the full list of ESLint native channels, are covered in [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

## Commands

The package ships one command, `hone`. `check` and `project` run through a `package.json` script as [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) shows; `record-debt` runs once, when a repository adopts Hone; `prune-debt` runs when the check names it, to remove the records of debt that is paid; `authorise` writes one authorised location; `upgrade` runs once, to move a version 1 repository to version 2, as [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 shows. `hone --help` lists the commands, and `hone <command> --help` gives each one's options and exit codes.

`hone check` loads the repository's `hone.config.json`, the symptom catalogue and the records in `hone-records`; works out which files changed since `--base-revision`; runs each engine its listed checks name once over the repository's tracked files; answers each finding by the records; and prints one report ending in its verdict. The verdict and exit code always come from the whole report, whatever `--report-output` or `reportOutput` print.

Without `--base-revision`, Hone cannot tell which files were touched, so debt cannot be forfeited and records carried from version 1 cannot be compared with the base; the report says so and the run fails. `--forfeiture elsewhere`, or `"forfeiture": "elsewhere"` in `hone.config.json`, leaves debt forfeiture to another run, such as a pre-push hook given a base revision; that run's report says what it left, and its verdict is a partial assessment.

`hone project` writes the native configuration each engine that runs a listed check through one needs. The walker is standalone and needs none.

### Recording inherited debt

`hone record-debt` gives a repository that adopts Hone with existing code a debt record for each finding it cannot fix on day one. [ADOPTING.md](ADOPTING.md#7a-record-the-debt-you-inherit) step 7a is the procedure. The command runs the check with the `--base-revision` it is given, then writes one debt record under `hone-records/debt/<symptom>.json` for each symptom, check and file that has a finding, and for each inline disable or TypeScript directive under `unrecorded`, since debt on its check and file is what holds one. Each is the record a person would write, so nothing downstream treats it differently: it names only its symptom, or its symptom and check as `<symptom>#<check>`, and its file. Debt needs no why-chain and no case, so the command needs no setting in `hone.config.json` and never sets one. Add a `note` by hand afterwards if you want to leave a note for future developers on what the debt signals.

Give it the base that the run assessing forfeiture is given, such as `origin/main` for a branch: a record for a file changed since that base is forfeited by that run, so the command writes none for such a file and says so, and a check against a later revision, such as `HEAD`, would not show it.

It never writes anything that needs an owner's reason: no authorised location, no boundary record, no deviation, no dependency record and no setting. It prints one line per finding and per native exception under `unrecorded`, and writes nothing for:

- a symptom and file that already hold debt;
- a file under a `--leave` path. `--leave` takes an exact file or folder, as `exclude` does, and may be given once for each path. It names the deliberate, permanent exceptions, which a person records as an authorised location with a why chain;
- a file this change created or changed, when the run assesses forfeiture, since a finding there is the change's own breach: fix it there. With `forfeiture` set to `elsewhere` the check forfeits nothing, so the command writes debt on such a file like any other;
- a finding the catalogue gives no symptom or check to record against, such as one of a team rule set's clauses;
- a native exception no debt record can hold. A `config-override` is never recorded, since debt holds what is owed and an override on a clean file owes nothing: a file under it that breaks the check gets its debt from the finding, because Hone's own run does not read the override, so remove the override or narrow it. An `ignore` and a `suppression-entry` hide nothing from Hone's run, which has already recorded what it finds in the file, so remove them; a generated or vendored file under an `ignore` can instead be listed in `exclude`, which Hone's run then honours too, so no `ignore` line is printed for it. An inline rule configuration changes what the rule checks: remove the comment. A lint-script option gets the advice for why Hone could not judge it, the same as its `unrecorded` line.

Each line it prints says what to do next.

It adds each record to its symptom's file, writing the file when there is none yet, and leaves every record already there as written. It stages and commits nothing: the diff of `hone-records` is the review, and nothing takes effect until a person commits it. It never removes or rewrites a record, so running it again writes nothing the second time. A record whose debt is paid is removed by `hone prune-debt`, below. Run `hone project` after it when any listed check runs on `eslint`, so the projection carries the new records.

The command does not refuse to run again later, and has no flag for it. Forfeiture is what stops it turning new findings into debt: debt is forfeited once its file changes since `--base-revision`, so a record written for a file someone has just changed fails the next check that assesses forfeiture, and a file that is new or changed since the base gets no record at all. That holds only where forfeiture is assessed. In an arrangement that leaves it elsewhere, such as `"forfeiture": "elsewhere"` with the pre-push hook that assesses it bypassed, such a record is not caught until a run that does assess it.

### Pruning paid debt

Debt is a record that a finding is owed, and once the debt is paid the record should go. `hone prune-debt` removes the debt a run lists under `paid`, `stale` or `forfeited`: debt that another record answers in place of, debt on a file that is gone, a file the settings exclude, or a file whose check its engine measured there with nothing found, and debt on a file this change touched, whether or not that file still breaks its check. The `stale` line and the `prune-debt` line say which of the three it was. Only the engine knows what it measured. A file it was handed and skipped, a file outside the checked set and an engine that did not run are not measured, so their debt is unjudged: it is not listed as stale and the command leaves it.

Every other record stays for a person, such as a `stale` authorised location whose finding is gone: it carries a person's judgement, so delete it by hand.

The command runs the check with the `--base-revision` and `--forfeiture` it is given, so give it what the check was given; a check that finds paid debt names the exact command. Like `hone record-debt`, it writes `hone-records`, keeps every other record's text as written, stages and commits nothing, and does not write the projection: run `hone project` after it when any check runs on `eslint`. It has no dry run: the diff of `hone-records` is the review.

For an `eslint` check, the off-switch the projection writes for a record is Hone's own. The check does not list it as a `config-override`, so it never counts as a native exception the record holds. A `config-override` on a check and file no record holds is reported under `unrecorded`, and `hone record-debt` never records it: remove the override or narrow it. Once a record is removed, a team off-switch placed after the projection is listed under `unrecorded` as a `config-override`, and one placed before it never takes effect, since the projection turns the rule on after it, so ESLint and the check both flag the file. A team block placed after the projection that sets a recorded file's rule to `"warn"` or `"error"` leaves the projection out of effect, and the check says `not-included`.

## Adopting the ESLint mechanism

With any check listed for `eslint`, run `hone project`. It writes `hone.eslint.mjs` at the repository root, which turns the listed checks' rules on and off where records answer them, and `hone.eslint.d.mts`, which types it. Commit both, and spread the default export of the projection last in the repository's flat config:

```js
import hone from "./hone.eslint.mjs";

export default [
  // the team's own blocks
  ...hone,
];
```

This is the only supported way to adopt the checks. On every run, Hone reads the team's resolved configuration for each checked file and fails the run if the projection is missing, not in effect, or differs from what `hone project` would write now, with a line that says what to run. Re-run `hone project` after changing the checks or the records.

### Package slices

A package that runs ESLint from its own folder resolves the `files` of its config against that folder, so spreading the root projection there loses every record written with a root-relative path. `hone project` therefore writes one projection per config root, and beside each a `hone.eslint.d.mts` that types its default export as ESLint's `Linter.Config[]`, so a TypeScript config can import the projection and spread it. Commit both files in every folder. The repository root gets `hone.eslint.mjs` as above. Under the nearest-to-file lookup, each package folder with a tracked `eslint.config.*` is a config root; under the repository-root lookup a package's own config is never loaded, so it gets no slice. Each folder `hone.config.json` lists under `eslintConfigRoots` is a config root under either lookup. Each package config root gets its own `hone.eslint.mjs` beside it: the same checks, imported by a path relative to that folder, and only the records for files under it, with paths relative to it; every slice also carries the block that turns the listed checks' rules on. Each package config spreads its own slice:

```js
import hone from "./hone.eslint.mjs";

export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...hone];
```

A package with no `eslint.config.*` of its own is linted by the nearest config above it, so its records stay in that config's slice. A file is governed by the deepest config root that contains it. A folder holding its own `hone.config.json` is a nested Hone configuration, which is not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)): when the ESLint engine would check a file under it, `check` and `project` stop before anything is checked or written, while a run that lists only walker checks does not stop. A folder holding one and no file the run would check gets no slice, and nor does anything under it. Either fix works today: run the folder on its own with `--repo`, as the line says, or govern it from this repository by removing its `hone.config.json` and keeping its records here, after which `hone project` writes its slice.

A config root keeps its slice even where a config above it ignores its folder: a lint run from that folder loads its own config and never reads the ignores above it, so `hone project` writes the same slices from the same inputs every time. A repository with only a root config gets exactly the projection it had before.

The check reports each package slice that is missing, out of date or not in effect. A package that spreads the root projection is reported only once a record answers a file in it, since until then both projections give that package the same rules; one that spreads nothing is reported at once. A folder listed under `eslintConfigRoots` with no `eslint.config.*` on disk is reported too: generate its config before the check runs, as a tool such as sku does on any of its commands.

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
- Listing a check adopts it, and only a listed check runs. A check of a symptom that a listed check sees, listed nowhere, is offered under `available`; it never fails the run, so a new check in a later Hone never turns a run red by itself.
- `"not-run"` states that the check is adopted and binds the repository, but its engine is not run: the check is not a true measure of the rule's intent here, or cannot work here. The rule is enforced by review. `"not-adopted"` states that the check does not apply to the repository. Either way the check is never run and never projected, and its engine is not loaded unless another check uses it. The report lists it under `not-run` or `not-adopted`; both are informational, and the run is still a whole assessment. No engine may be named `not-run` or `not-adopted`.
- `eslintConfigLookup`, optional, is `"nearest-to-file"` or `"repository-root"` and says which `eslint.config.*` the team's own ESLint run applies to a file; see [Runtime](#runtime). Leave it out to let Hone detect it.
- `eslintConfigRoots`, optional, lists repository folders that get their own projection slice under either lookup although they track no `eslint.config.*`, such as a package whose config a tool generates and ignores; see [Package slices](#package-slices). Globs are refused. Each entry must be a folder git tracks files under outside every `exclude` path, spelled exactly as git spells it; any other entry stops the run before anything is checked or written.
- `forfeiture`, optional, is `"this-run"` (the default) or `"elsewhere"`, and says which run assesses whether debt is forfeited; `--forfeiture` overrides it for one run; see [Commands](#commands).
- `reportOutput`, optional, is `"full"` (the default), `"actionable"`, `"counts"` or `"verdict-only"`: the repository's default for how much of the report the check prints. `--report-output` overrides it for one run; see [Commands](#commands).
- `checkEditions`, optional, is `"pinned"` (the default) or `"latest"`. A check that has been tightened has more than one edition, listed on its check page. `"pinned"` runs each check's default edition, which changes only in a major release; `"latest"` runs the newest edition the installed Hone has for every listed check, so a minor release can add findings. `"edition"` in a check's `checkSettings` holds that one check to the edition it names over either. The report lists the edition each such check ran under `editions`.
- `checkSettings`, optional, maps a listed check address to an object of that check's settings, for a check whose page lists settings. Each key must be one the check's piece declares, and its value must be the same JSON kind as the declared default and, where the piece lists choices, one of them; the value replaces the default. Anything else makes `hone.config.json` malformed, naming the check, the key and what is accepted.
- `exclude`, optional, lists repository folders or exact files that no engine checks. A folder entry covers everything under it. Globs are refused: an entry containing `*` makes `hone.config.json` malformed. The report lists the active entries under `excluded`. Exclude Hone's own install when it is vendored inside the repository.
- `generated` and `layers`, optional, are declared for checks that will read them; no check reads either yet, and the report says so under `settings-notes`.

The keys version 1's `disciplines.json` used under other names are refused, each naming what replaces it: `clauses` is `checks`, `clauseSettings` is `checkSettings`, `assessment` is `forfeiture`, and `fileExceptionWhyChains` is gone, since every record shows its why-chain. [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 lists what moved.

## hone-records

A folder at the repository root; without it, no record answers any finding. It holds the records that answer findings, one file for each kind and symptom or recipe, each a document `{ "version": 2, "records": [...] }`. A file in the wrong folder or under a name that is not a catalogue name is refused, naming where each record belongs. Each record names what it reaches by the symptom's name, or by `<symptom>#<check>` to reach one check of it. [rules/records.md](rules/records.md) says what each kind is for.

- **Debt** is in `hone-records/debt/<symptom>.json`: `answers`, `file` and an optional `note`, a note to future developers on what the debt signals, which nothing reads. It says a finding in one file is owed. It needs no case and no why-chain; forfeiture is what holds it: it is forfeited once its file is touched.
- **An authorised location** is in `hone-records/authorised-locations/<symptom>.json`: `answers`, `file`, `case` and `owes`, naming the case the file is and the principle it owes, and a `whyChain`. It says the symptom is correct in that file. [`hone authorise`](#commands) writes one from the arguments it is given.
- **A deviation** is in `hone-records/deviations/<recipe>.json`: `recipe`, `file`, `recipeReason`, `reasonFails`, `evidence` and `ruleHolds`. It says why a file does not follow a recipe the catalogue gives.
- **A boundary record** is in `hone-records/boundary-records.json`: `module`, `outsideParty` (a runtime facility such as `runtime:clock`, or an outside module's specifier), the `ports` the module declares and an optional `conformist`. It says the module is where an outside party is met.
- **A dependency record** is in `hone-records/dependency-records.json`: `dependency`, `nativeWay`, `whyNotEnough` and an optional `peerRisk`. It says why a package is used where the platform's own way exists.

An authorised location's `whyChain` follows the [why-chain contract](docs/why-chain-contract.md), which gives its shape, what Hone refuses and what review still judges.

- A record that `hone upgrade` moved from version 1 keeps its old entry word for word under a `carried` key, in place of the keys version 1 did not hold. The check lists it under `carried`, with what it lacks, and judges it against `--base-revision`: it is `established` when the base held it unchanged and `unjudged` when the run could not compare it; a carried record changed since the base is refused as `carried-changed-since-base`. [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 describes them.
- A record the catalogue does not recognise, or whose form is wrong, is refused with its records file and index, and the run fails. A record that names a case or an `owes` the catalogue does not list is kept, with a note under `record-notes`.
- A record that answers no finding and holds no native exception is stale where the checks it reaches were measured at its place, or its place is gone or excluded; a record whose checks were not measured there is unjudged, not stale, and a dependency record, which no check reads yet, is never stale. Debt on a file this change touched is forfeited, and a record that duplicates another is refused. Each fails the run. Debt that another record answers in place of is paid, which does not.
- An inline exception, an `eslint-disable` comment naming a selected rule or no rule, or a `@ts-expect-error`, `@ts-ignore` or `@ts-nocheck` directive under `claimed-type#unlisted-cast-site`, is held only by a record on its check and file. A comment naming no rule escapes every selected ESLint check and needs one per check. Without a record it is listed under `unrecorded` and fails the run. A lint-script option that weakens the whole run, such as `--rule`, `--suppress-all` or `-c` naming another config, cannot be recorded.
- Files are exact repository paths, never globs.

## Installing

Hone installs as one npm package, `@hailstails/hone`, installed from npm at an exact version, `@hailstails/hone@<version>` with `--save-exact`, downloaded as the tarball `hailstails-hone-<version>.tgz` attached to a GitHub release, or built by `pnpm run pack-package` into `artefacts/hailstails-hone-<version>.tgz`, the file name `npm pack` gives the scoped package, and added to the repository root as a development dependency; [ADOPTING.md](ADOPTING.md#2-install-the-hone-package) step 2 has the steps. The package is plain JavaScript holding only Hone's own code. It declares its own `dependencies` as caret ranges starting at the version `pnpm-lock.yaml` locks, so the package manager installs them from the registry, and the repository's own audit tools see them as it does any other dependency. Which release inside each range is installed is decided by the repository's own lockfile and overrides, so a patched release can be taken without waiting for a new Hone. It declares the toolchain as `peerDependencies`, `typescript` required and the ESLint packages optional, and exposes one command, `hone`, described under [Commands](#commands). It ships the rule data and pages, both mechanisms, the review methods and the why-chain contract, and no TypeScript source, only the declaration files of the public type entries below.

With the ESLint mechanism selected, a packaged install's projection imports one plugin, `@hailstails/hone/eslint-plugin`, registered under the namespace `hone`, so the repository's ESLint must resolve the package from the repository root. Hone compares the committed projection `hone.eslint.mjs` and its declaration `hone.eslint.d.mts` byte for byte with what `hone project` would write now.

## Public type entries

The package has three public entries for TypeScript. No other path in the package is a public TypeScript entry.

| Entry | Status | What it is for |
| --- | --- | --- |
| `@hailstails/hone/rule-set` | Stable | Types only, for the files a team writes in its own rule set. |
| `@hailstails/hone/walker` | Experimental, may change in a minor release | Writing a walker piece. It names TypeScript's syntax types, so it needs the repository's `typescript` peer. |
| `@hailstails/hone/testing` | Experimental, may change in a minor release | Running a team's checks against their own examples in the team's tests. |

`install-proof` type-checks the `acme` team rule set against these entries, and checks that a wrongly typed field fails, on TypeScript 4.8.4 from an ES module with `moduleResolution` `"nodenext"`, and on 6.0.3 from an ES module with `"nodenext"` and `"bundler"` and from a CommonJS file with `"nodenext"`. It also runs acme's examples through `@hailstails/hone/testing`.

## Runtime

- Windows, Linux, macOS or WSL. Hone keeps absolute paths in the platform's own form and repository paths in POSIX form, as git reports them. CI proves Windows and Linux; macOS is not proven in CI.
- The package: the Node versions its `engines.node` declares. It is plain JavaScript, so Node never strips types from it, and Node strips types from a rule set's `.ts` piece modules, within the limits [ADOPTING.md](ADOPTING.md#1-check-the-prerequisites) lists.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- Hone's own packages, declared in `dependencies` as caret ranges whose floor is the version `pnpm-lock.yaml` locks, which is the version Hone is tested on. The repository's lockfile, and any override it sets, decides which release inside each range is installed. They are implementation details: nothing of theirs crosses into the repository's code or configuration.
- The repository's own toolchain, declared as `peerDependencies`: `typescript` required, because every walker check needs it, and the ESLint packages optional, for the ESLint mechanism. Declare `typescript` at the root at the version the repository uses. TypeScript stops below 7 because TypeScript 7's compiler API is a different one. Yarn Plug'n'Play is not supported.

Hone loads the toolchain by Node's own resolution, upward from the install directory, which is the same resolution the pieces' plugin modules get when the team's ESLint loads the projection. Hone's query of the team's configuration, its governance run and the pieces therefore all use one copy, the repository's. Keep the toolchain resolvable from the repository root: declare it in the root `package.json` (in a pnpm workspace, `pnpm add -Dw`). A package may install a different ESLint for its own lint script; Hone's verdict still comes from the root's, its governance behaviour is the same on either supported line, and the pieces that wrap native rules wrap the root's copies there too.

A peer that is missing, cannot load, or is outside its range stops the engine before any piece loads, with one line naming every such peer and what to install. A peer that resolves from inside the installed package stops it too, naming the folder to delete before reinstalling.

A repository can hold one `eslint.config.*` at its root or one per package. Hone resolves the team's configuration the way the team's own ESLint run does. ESLint 10, and ESLint 9 started with `--flag v10_config_lookup_from_file` (or `unstable_config_lookup_from_file`), use the `eslint.config.*` nearest each checked file. Plain ESLint 9 uses only the one in the directory it runs from, so for a repository whose `eslint` resolves to 9.x at `node_modules/eslint` and whose lint scripts carry no such flag, Hone reads the root `eslint.config.*` for every file, and fails the run if there is none. When Hone cannot read an installed `eslint` at the repository root it assumes the nearest-to-file lookup. Each config that applies to a file must spread its projection: the root config the root projection, each package config its own slice; see [Package slices](#package-slices). A config that fails to load stops the run, naming the config, the checked file it applies to and ESLint's message: fix that config. Only if its folder holds nothing Hone should check, add it to `exclude` in `hone.config.json` instead. A broken config in a folder that the repository's own ESLint never enters does not stop the run. Before failing, Hone asks the config that governs that folder, and each config above it up to the root, whether it really ignores both that folder and the file; a file that no `files` block matches is not taken for an ignored one. If one does, the file is treated like any other file the team's ESLint ignores and reported as an `ignore` native exception. Hone asks about a folder through a file inside it, so one gap remains: an ignore that matches every entry directly inside the folder but not the folder itself, such as `gen/*`, counts as ignoring `gen`, and Hone reports its files as ignored where the team's `eslint .` still loads the broken `gen/eslint.config.*` and fails. A file that no `eslint.config.*` applies to stops the run the same way, and the next step is to create one at the repository root that spreads the projection, as [ADOPTING.md](ADOPTING.md) step 4a shows. Detection cannot see how a task runner starts ESLint, so `hone.config.json` can state the lookup: `"eslintConfigLookup": "nearest-to-file"` or `"repository-root"`, which overrides detection. Both lookups are tested against monorepo fixtures with a config per package.

## Compatibility

Hone's version numbers follow semantic versioning under these rules:

- A new or tightened check ships off by default in a minor release and becomes a default only in a major release. A new check arrives as a new check of a symptom, which a repository adopts by listing it. A tightened check arrives as a new edition of the check, which runs only for a repository that sets `checkEditions` to `"latest"` or names the edition in the check's `checkSettings`; a major release makes it the default edition and may retire older ones.
- A change to the ESLint config that `hone project` generates, which an adopter must regenerate, is a minor release, with a clear message telling the adopter to regenerate: its changelog entry says to run `hone project` and commit the result, and until then the check reports the projection `out-of-date`.
- Renaming or removing a check address, a config key in `hone.config.json`, a records file or a key of a record, or a CLI flag, or changing what one means, is a major release. Adding one with a safe default is not.
- A change that breaks a tool parsing hone's output is a major release: the command and option names, the exit codes, the report's section names and its verdict lines. A change to the help text or to the wording of a message is a minor release.
- A breaking change to a type in `@hailstails/hone/rule-set` is a major release. `@hailstails/hone/walker` and `@hailstails/hone/testing` are experimental: they may change in a minor release until they are marked stable.
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

This repository is self-contained: it holds its own configuration and its own lock. `package.json` declares the packages the code imports and the development tools, `pnpm-lock.yaml` locks both, `tsconfig.json` typechecks the code under `strict`, `.oxfmtrc.json` configures the formatter, and `vitest.config.ts` runs its tests. `package.json` pins the pnpm version that locks and installs them, `pnpm-workspace.yaml` holds its settings, and pnpm resolves a dependency only to a release that is at least three days old when a dependency is added or updated; installing from the lock does not re-check it. Run `corepack enable` once so that Node provides that pnpm, install with `pnpm install --frozen-lockfile` in this directory, then run a script from it with `pnpm run <script>`:

| Script | Runs |
| --- | --- |
| `typecheck` | `tsc` with `tsconfig.json` |
| `format` | oxfmt with `.oxfmtrc.json`, writing the formatted files |
| `test` | Vitest with `vitest.config.ts` |
| `check` | typecheck, the oxfmt check and the tests in that order |
| `build-package` | Builds the published package into `dist/`, and fails on anything the package must not ship, such as an undeclared import, a bundled dependency or a page linking to a file the package does not ship |
| `pack-package` | Builds `dist/` and packs it with `npm pack` into `artefacts/hailstails-hone-<version>.tgz`, named by the `version` in `package.json` |
| `package-determinism` | Builds and packs twice into separate temporary roots and fails naming any file that differs, or when the two packed tarballs differ |
| `self-check` | Runs Hone's own check on this repository; pass `--base-revision <rev>` after the script name. See [Hone's check on itself](#hones-check-on-itself) |
| `install-proof` | Packs the package, or takes `--tarball <path>`, and installs it into the consumers under `delivery/install-proof/consumer-proof/` in a temporary directory, each proving one thing only an installed package shows |
| `pull-request-title` | Passes a title shaped as a Conventional Commits subject, `type(scope)!: description`, and fails any other with the expected form. See [Versions and releases](#versions-and-releases) |
| `release-pull-request` | Writes the next release's section into `CHANGELOG.md` and its version into `package.json`, in the working tree only. See [Versions and releases](#versions-and-releases) |

### Hone's check on itself

Hone checks itself with its own `hone.config.json` and the records in `hone-records/`. The consumer folders `install-proof` copies out are excluded, since they are other repositories checked by their own Hone run.

`self-check` prints Hone's full report on itself, then one `self-check:` line. It fails when the selection, the records or the projection are not sound, and not on findings, which it prints and counts. CI runs it on every change with the pull request's base, or the previous `main`, as the base revision.

Continuous integration runs on every pull request, drafts included, and on every push to `main`, from `pnpm-lock.yaml` alone, in two jobs, both required checks. They run side by side on the oldest claimed Node. Linux runs `check`, `self-check` and `package-determinism`, packs as the release does, and proves the tarball installs on a newer Node. Windows packs and proves its own tarball. A third job fails when the two tarballs differ. macOS is not proven in CI. A separate workflow, `pull-request-title.yml`, runs `pull-request-title` on each pull request's title whenever the pull request is opened, edited, reopened, marked ready or pushed to.

### Versions and releases

Pull requests are squash-merged, and the pull request's title becomes the commit's subject on `main`. The `pull-request-title` check requires that title to be a Conventional Commits subject: `type(scope)!: description`, where the scope is optional and lowercase, `!` marks a breaking change as [Compatibility](#compatibility) defines it, and the type is one of `feat`, `fix`, `perf`, `revert`, `docs`, `refactor`, `test`, `build`, `ci`, `chore` or `style`. Reverting behaviour that has been released is breaking, so its title is `revert!:`; `revert:` without `!` is for undoing a change that has not been released, and counts as a patch. A title that changes the ESLint projection says that adopters must run `hone project`, since the title becomes the changelog entry. `.github/dependabot.yml` leaves Dependabot's routine version updates off and gives its security pull requests a conventional title with the type `build` and a scope, such as `build(deps):`. It covers the GitHub Actions the workflows use and, through the `npm` ecosystem, which is how Dependabot names pnpm, the JavaScript dependencies in `pnpm-lock.yaml`. A security release published in the last three days can be held back by the minimum release age when pnpm resolves it.

To prepare a release, create a new branch at the tip of `main` and run `pnpm run release-pull-request` on it before anything is committed to it. It finds the highest release tag `v<version>` merged into `HEAD`, reads the full message of every commit after it, and works out the next version by semantic versioning alone. It sizes the release from every commit since the latest stable release tag, or, when no release is stable, since the earliest release tag, so a pre-release line is sized by all it holds and not only by what followed its last pre-release. It needs the commits since the tag it sizes from, which include those after the latest tag, to be the straight line of squash-merged commits that `main` holds, so it refuses, changing nothing and naming the commits, when any of them is a merge commit, since a merge brings in changes whose subjects it cannot size. It works out the version like this:

- A subject with `!`, or a message with a `BREAKING CHANGE:` or `BREAKING-CHANGE:` footer line, is a major change, `feat` a minor change, and every other subject a patch. The largest change decides the release.
- On a stable release, the change increments the version: a patch increments the patch number, a minor the minor number with the patch reset to 0, and a major the major number with both others reset to 0.
- On a pre-release, a change no larger than the one the pre-release is numbered towards moves to the next pre-release number; a larger one starts the larger version's first pre-release, numbered `-pre.1`.
- The release stays on the latest tag's channel, so after a stable release the next is stable unless asked otherwise. Pass `pre-release` to start a pre-release line from a stable one, numbered towards the version the change would give, and `stable` to finish a pre-release line as its stable version.

The first stable release is made the same way. The `0.1.0` pre-release line holds breaking changes, so on the branch for that release `pnpm run release-pull-request stable` finishes the line with major version 1, minor and patch 0, and every release after it follows the rules above.

It then writes a section for that version at the top of `CHANGELOG.md`, grouping the subjects under Breaking changes, Features, Fixes and Other changes, and sets `version` in `package.json`. A stable release folds every pre-release section above the newest stable section into its one section, keeping each entry's group, and leaves no pre-release heading. A folded entry is dropped when a later entry names the same pull request, `(#N)`; the new subjects are all kept. Nothing else records which pre-release shipped which change: the GitHub pre-release notes hold only install instructions. It refuses, changing nothing, when no subject follows the latest tag, when a merge commit follows the latest tag or the tag it sizes from, when `package.json` is not at the tag's version, when the changelog already has the new version, or when a section to fold has a group other than those four or a line that is neither a group heading nor an entry. A subject that is not a Conventional Commits subject is named on standard error and counted as a patch under Other changes, or as a major under Breaking changes when its message has a breaking footer, so check its place before opening the pull request. If writing the second file fails, it restores the first. The script only edits those two files: it never commits, tags, pushes or publishes. Open the release pull request with the title `chore(release): <version>`. Merging it is the release: no tag is pushed by hand and nothing is run after the merge. `.github/CODEOWNERS` makes the owner, `@HailsTails`, the code owner of `package.json`, `CHANGELOG.md`, `.github/workflows/`, `.github/CODEOWNERS` itself, the `scripts/release-*` scripts, `scripts/published-manifest.ts`, which writes the published `package.json`, `core/values/tool-identity.ts`, which names the package and its repository, and `pnpm-workspace.yaml`, which holds the `minimumReleaseAge` the release job installs under, so a release pull request, or any change to how a release is made, needs her code-owner approval before it can merge. That also covers every change to `package.json`, dependency updates included, since the version a release is triggered by lives there.

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

# Adopting Hone

This page takes a TypeScript repository from nothing to a checked, passing run. Do the steps in order. Every command is run from the root of the repository being checked, which this page calls `<repo>`. Nothing here needs AIDLC or any agent harness. A repository that adopted the disciplines through the older standalone copy route follows [MIGRATING.md](MIGRATING.md), which uses these steps.

Hone reads `hone.config.json` in `<repo>`, runs the listed checks over every git-tracked file, answers what they find by the records in `hone-records`, and prints one report ending in `verdict: pass` or `verdict: fail`. A repository that already runs version 1, with `disciplines.json`, runs `hone upgrade` once instead of writing these files by hand, as [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 says, then follows this page from step 5.

## 1. Check the prerequisites

```bash
node --version
```

It must be in the `engines.node` range that `npm view @hailstails/hone engines` prints. A rule set of your own may write its piece modules as `.ts` files, which Hone runs with Node's built-in type stripping, so they are limited to what [Node's TypeScript support](https://nodejs.org/docs/latest-v22.x/api/typescript.html) allows; Node does not strip types under `node_modules`, so a rule set installed as a package must ship `.js`. Also needed: git and npm. `<repo>` must be a git repository, and the files to check must be committed or staged: untracked files are not checked.

## 2. Install the Hone package

Hone ships as one npm package of built JavaScript, so it needs no TypeScript support from Node. Its own dependencies are declared as caret ranges, so your repository's lockfile, and any override you set, decides which release inside each range is installed.

**The npm package is named `@hailstails/hone`.** The unscoped name `hone` on npm belongs to an unrelated package: never run `npm install hone`. The package `@hailstails/hone` installs one command, `hone`. Its tarball is named `hailstails-hone-<version>.tgz`, the file name `npm pack` gives a scoped package. Its first pre-release was released under the old name `honed`; [MIGRATING.md](MIGRATING.md#11-moving-from-honed-to-hailstailshone) says how to move from it.

Hone follows semantic versioning: only a major release removes or renames a check address, config key or flag, or changes what one means ([README.md](README.md#compatibility)).

The main route is the npm registry. Stable releases are published under the dist-tag `latest`, which names the newest stable release approved on npm; `npm view @hailstails/hone dist-tags.latest` prints its version. Pre-releases are published under `next`. Install that version exactly, with `<version>` in place:

```bash
npm install --save-dev --save-exact @hailstails/hone@<version>
```

With pnpm, add it as a development dependency, using `-Dw` in place of `-D` at the root of a pnpm workspace:

```bash
pnpm add -D --save-exact @hailstails/hone@<version>
```

Pin the exact version. A major release can remove or rename a check address, config key or flag, and an install by tag can record a range in `package.json`, such as `^` and the version, which a later install without the lockfile, or an update, moves to a newer release that nobody chose. With an exact pin, the version changes only when you change it (step 10). Check the name before you run it: `@hailstails/hone`, never the unscoped `hone`. With Yarn, add `@hailstails/hone@<version>` exactly with its own `add -D` command at the workspace root. `latest` can trail the newest GitHub release for a while; [README.md](README.md#developing-hone) says how a version reaches npm.

The alternative is a tarball, copied into the repository so every teammate and CI runner installs the same Hone without the registry. Its three dependencies still come from the registry, or the mirror your package manager uses, at releases inside the ranges the tarball's `package.json` declares, and the repository's lockfile records which. This page writes its location as `<hone-tarball>`: a path such as `vendor/hailstails-hone/hailstails-hone-<version>.tgz`, or an `https://` URL your team serves it from. Download the tarball attached to the latest [GitHub release](https://github.com/HailsTails/hone/releases), or build it from a pinned commit as below.

To build the tarball yourself, use Node.js 22.18 or later with [corepack](https://nodejs.org/api/corepack.html) available, which provides the pnpm version `package.json` pins, and pick the commit to pin, such as the latest on [`main`](https://github.com/HailsTails/hone/commits/main). Then run, with that commit's SHA in place of `<pinned-sha>`:

```bash
git clone -c core.longpaths=true https://github.com/HailsTails/hone.git /tmp/hone-source
git -C /tmp/hone-source checkout <pinned-sha>
cd /tmp/hone-source && corepack pnpm install --frozen-lockfile && corepack pnpm run pack-package && cd -
```

The last command writes the tarball under `artefacts/`. Copy the downloaded or built tarball into `<repo>/vendor/hailstails-hone/` and commit it with a message naming the release tag or the pinned SHA. The commands in this guide are POSIX shell; on Windows run them in Git Bash.

Install it as a development dependency of the repository root, beside the toolchain:

```bash
npm install --save-dev <hone-tarball>
```

With pnpm, using `-Dw` in place of `-D` at the root of a pnpm workspace:

```bash
pnpm add -D <hone-tarball>
```

The package manager records it in `package.json` and the lockfile. With Yarn, add the same tarball with its own `add -D` command at the workspace root.

Add the two commands to the root `package.json` scripts:

```json
"scripts": {
  "hone:check": "hone check --repo .",
  "hone:project": "hone project --repo ."
}
```

Options for one run go after the script name. npm needs `--` before them, as in `npm run --silent hone:check -- --base-revision origin/main`. pnpm takes them straight after the script name, as in `pnpm run --silent hone:check --base-revision origin/main`. This guide shows both wherever a command takes options.

`hone --help` lists the commands, and `hone <command> --help` gives each one's options and exit codes.

Hone runs on the toolchain the repository already uses, which the package declares as `peerDependencies`: `typescript` is required, because every check on the `walker` engine needs it, and the ESLint packages are optional, needed only for checks on the `eslint` engine. The supported ranges are those in the installed package's `package.json`. Declare `typescript` yourself at the repository root, at the version the repository already uses, rather than let the package manager choose or skip it. A package that is missing or out of range is named when the check runs; add it at a version inside its range, without moving ESLint or TypeScript to another major for Hone's sake.

Hone finds these by Node's resolution upward from where the package is installed, so in a monorepo they must resolve from the repository root: declare them in the root `package.json` (with pnpm, `pnpm add -Dw` at the versions the packages already use), even where packages also declare their own. Yarn Plug'n'Play is not supported, because Hone resolves the toolchain through `node_modules`.

Commit `package.json`, the lockfile and the tarball if it is a file in the repository. Step 10 says how to update.

## 3. Read what each discipline means

[rules/numbers.md](rules/numbers.md#every-numbered-discipline) lists every discipline, and [rules/README.md](rules/README.md) explains how the named pages read. Rules are referred to by name; a number is only a clause address. Each check has its own page under its symptom, `rules/typescript/symptoms/<symptom>/<check>.md`: exactly what it flags, its settings, a violation and its fix. Read the named pages first; [the spirit of the rules](rules/SPIRIT.md) explains the approach for the whole set. Each check is listed in `hone.config.json` by its address, `<symptom>#<check>`, such as `authored-class-or-this#class-keyword`; [the checks page](rules/typescript/checks.md) lists every one. A clause whose mechanism is `review` is a judgement clause: it has no check and is applied in review, with the review lens its rule item names (step 9).

A check covers only what its page says it flags. Read the whole rule, not only the check: where a rule asks for more than its check can see, the check page says which part is left to review, and the rule's review lens covers that part.

Where to start: for an API, [No leak across a boundary](rules/principles.md#no-leak-across-a-boundary) with its recipe [Zod at the producer's adapter](rules/typescript/recipes.md#zod-at-the-producers-adapter), [Failures are values](rules/rules.md#failures-are-values) and [Ports declared inside](rules/rules.md#ports-declared-inside) are useful next, most of them applied in review. For React, first select the type and test disciplines that apply to component code; do not apply server ports or process-lifecycle rules to browser code.

## 4. Write hone.config.json

Create `<repo>/hone.config.json`. List every check you adopt with the engine that runs it. This example lists `loop-keyword#loop-statement`, `date-used-directly#clock-sources` and `unit-without-a-running-test#companion-test-file`:

```json
{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "loop-keyword#loop-statement": "walker",
    "date-used-directly#clock-sources": "walker",
    "unit-without-a-running-test#companion-test-file": "walker"
  }
}
```

- `checks` keys are check addresses, `<symptom>#<check>`, listed on [the checks page](rules/typescript/checks.md); the value is an engine the check lists, `walker` or `eslint`, `"not-run"` or `"not-adopted"`. A check of a rule set of your own is written `<ruleSet>/<symptom>#<check>`.
- Listing a check adopts it. Only a listed check runs. A check of a symptom that a listed check sees, listed nowhere, is offered under `available` and never fails the run. The symptom [Strictness weakened](rules/typescript/symptoms.md#strictness-weakened) has seven checks, one per compiler flag; list the ones you want. Checks that are one rule today run together: listing one of the six test-body checks without the others stops the run with `checks-run-together` naming them.
- A symptom may span engines; list each of its checks on an engine that has it, or mark it. `authored-class-or-this#class-keyword` runs on `walker` or `eslint` but `authored-class-or-this#static-members-only` only on `eslint`, so adopting that symptom means adopting the ESLint engine for at least that check; see [README.md](README.md#adopting-the-eslint-mechanism). If ESLint cannot work in this repository, list such a check as `"not-run"`, as below.
- A check's value in `checks` is one of three:
  - an engine id, such as `walker`: the check runs and its findings fail the run;
  - `"not-run"`: the check is adopted, but its engine is not run; the report lists it under `not-run`;
  - `"not-adopted"`: the check is not adopted; the report lists it under `not-adopted`.
- A `"not-run"` or `"not-adopted"` check is never run and never projected, not even as `"off"`, and its engine is not loaded unless another check uses it, so a repository that lists every ESLint check this way needs no ESLint installed. Both leave the run a whole assessment.
- When a check cannot simply run clean, [the spirit of the rules](rules/SPIRIT.md#not-adopted-not-run-carved-out-escaped) names three declared states. Choose one deliberately, with reasons:
  - Not adopted: the rule does not apply to this codebase; a tech lead declares that, in the open. Set the check to `"not-adopted"`.
  - Adopted, engine not run: the rule binds, but its check is not a true measure of the rule's intent here, or cannot work here for a technical reason. The check is set aside; the intent is still owed, through review. Set the check to `"not-run"`. The ESLint-only checks of `name-off-its-casing` in a repository without ESLint are the usual case: `"name-off-its-casing#naming-convention": "not-run", "name-off-its-casing#filename-case": "not-run"`.
  - Debt: the rule binds and its check is sound, but the codebase has debt it cannot address right now. Keep the check's engine, so it still runs, and record the debt file by file as debt records, which `hone record-debt` writes for you (step 7a).
- `exclude` lists folders or exact files that no engine checks, as repository paths with forward slashes; an entry containing `*` is refused, because globs are not supported. A folder entry excludes everything under it. It is the only way to narrow what Hone checks: there is no include list, and every tracked file outside `exclude` is checked, including any folder added later. Use it for generated or third-party code, and, to check only part of a repository, list every other folder. The ESLint engine lints every tracked TypeScript file outside `exclude`, including any the repository's own ESLint config ignores: an ignore in that config does not narrow what Hone checks, and each selected check lists such a file under `unrecorded` until the ignore is removed or the file is listed in `exclude`.
- `checkSettings` gives a check the settings its check page lists, keyed by check address. See [README.md](README.md#honeconfigjson).
- `checkEditions` stays out, or `"pinned"`, unless you want stricter checks as soon as they ship. When Hone tightens a check, the stricter check arrives as a new edition, listed on the check's page, and becomes the default only in a major release. `"latest"` runs the newest edition of every listed check, so a minor upgrade can add findings. To take one check's newer edition only, give it `"edition"` in its `checkSettings` entry.
- `ruleSets` stays `{}` unless you write disciplines of your own; see [docs/extending.md](docs/extending.md).

Adopting a symptom with a check whose only engine is `eslint` needs the ESLint engine, or that check listed as `"not-run"`.

Starting with a few disciplines and adding more once the run passes is easier than fixing everything at once.

### 4a. Set up ESLint for `eslint` checks

Skip this if every listed check runs on the `walker`. Otherwise, after writing `hone.config.json`, write the ESLint projection:

```bash
npm run --silent hone:project
```

It writes `hone.eslint.mjs` and `hone.eslint.d.mts`, which types it for a TypeScript config. Spread its default export last in the repository's flat config. The projection sets rules only, so the config must also parse TypeScript, with the `@typescript-eslint/parser` that step 2 installs; without it the repository's own `eslint` run fails on the first type annotation while Hone's check still passes. A repository with no ESLint config yet can start from this `eslint.config.mjs`:

```js
import typescriptParser from "@typescript-eslint/parser";
import projection from "./hone.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"], languageOptions: { parser: typescriptParser } },
  ...projection,
];
```

To confirm it, run the repository's own `eslint` on one TypeScript file with a type annotation, for example `node_modules/.bin/eslint src/index.ts` with a file of your own; it must report findings or nothing, never `Parsing error`.

In a monorepo where ESLint resolves each file from its nearest config, `hone:project` also writes a `hone.eslint.mjs` slice, with its `hone.eslint.d.mts` declaration of the type, beside each package's tracked `eslint.config.*`, holding only that package's records with paths relative to the package. Where one ESLint 9 run applies the root config to every file, package configs are never loaded and get no slice. A package config keeps its slice even in a folder the root config ignores, since a lint run from that package loads its own config without the root's ignores. A folder holding its own `hone.config.json` is a nested Hone configuration, which is not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)): when the ESLint engine would check a file under it, `check` and `project` stop before anything is checked or written, and say to move the folder out and run it on its own with `--repo`. A run that lists only walker checks does not stop, and a folder with no such file gets no slice. The root config spreads the root projection last, and each package config spreads its own slice last, never the root one:

```js
import projection from "./hone.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
];
```

A package whose `eslint.config.*` is generated and not tracked needs its folder listed so Hone writes its slice, and the slice spread where the tool takes extra configuration. Each listed folder must be one git tracks files under, spelled exactly as git spells it, or the check stops. sku is such a tool: it writes an ignored `eslint.config.mjs` on every command and applies `dangerouslySetESLintConfig` to it. For sku, list the package in `hone.config.json` and spread the slice in `sku.config.ts`:

```json
{ "eslintConfigRoots": ["packages/web"] }
```

```ts
import projection from "./hone.eslint.mjs";

export default {
  dangerouslySetESLintConfig: (skuEslintConfig) => [...skuEslintConfig, ...projection],
};
```

Run the tool's configure step (for sku, any sku command or `sku configure`) before the check, or nothing loads the slice. A package that spreads the root projection instead of its slice is reported only once a record answers a file in it, so silence is not proof the spread is right: run ESLint from the package folder on a file the check flags and see the same finding. [README.md](README.md#package-slices) has the details. Hone detects which config the team's ESLint run applies from the installed `eslint` version and the lint scripts; see [README.md](README.md#runtime). Detection is wrong when a task runner (turbo, nx, `pnpm -r`) starts ESLint 9 inside each package, because each package then uses its own config, and when ESLint 9 gets the lookup flag outside the scripts. In those repositories set the lookup in `hone.config.json`:

```json
{ "eslintConfigLookup": "nearest-to-file" }
```

Use `"nearest-to-file"` when ESLint runs per package, with ESLint 10, or with ESLint 9 and `--flag v10_config_lookup_from_file`. Use `"repository-root"` for one ESLint 9 run from the repository root, whose root `eslint.config.*` then applies to every file. To confirm the setting, lint a package file the way the team does (for example `pnpm exec eslint packages/a/src/x.ts` from where the lint script runs) and check that it reports the same finding the Hone check lists for that file.

Commit the projection, every slice and the configs. Hone's check reads this configuration and fails if the projection or a slice is missing, not in effect, or out of date, so re-run `hone:project` whenever `hone.config.json` or `hone-records` changes or Hone is updated. The repository's ESLint must resolve `@hailstails/hone` from the repository root. [README.md](README.md#adopting-the-eslint-mechanism) has the details.

## 5. Run the check

```bash
npm run --silent hone:check
```

It exits `0` on `verdict: pass`, `1` on `verdict: fail` and `2` when an input cannot be loaded. `npm run` passes the exit code through. `sh: hone: not found` or `'hone' is not recognized` means step 2's install is missing. A load failure that names a toolchain package says what to install or delete.

Add the check to the repository's existing validation script, and run that script in CI and in any pre-push hook the repository already has, so the check runs wherever the other checks run.

A known limit: `hone check` runs its own ESLint pass over the governed files, even when the repository's own lint has just run. A hook that runs both pays for lint twice. Reusing the repository's lint run is planned after 1.0.

A first adoption assesses forfeiture at push only, so that a hotfix in a file that holds debt is not blocked in CI while the check is new: set `"forfeiture": "elsewhere"` in `hone.config.json`. CI and the pre-push hook then run different commands. The pre-push hook assesses forfeiture for its run:

```bash
npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main
```

With pnpm:

```bash
pnpm run --silent hone:check --forfeiture this-run --base-revision origin/main
```

A run that leaves forfeiture to another run marks its verdict line as a partial assessment. Act on the exit code.

CI leaves forfeiture to the hook, and with `elsewhere` in effect it can run the check with no base revision:

```bash
npm run --silent hone:check
```

Records carried over by `hone upgrade` follow the same setting. A run given no base leaves them to the run that has one, and says so. A run given a base judges them against it, whatever `forfeiture` says. So keep at least one run that has a base, the pre-push hook above, or they are never judged. If CI should judge them too, pass the pull request's base commit; the base is then used for those records only, and no debt is forfeited. CI needs that one commit fetched, for example `git fetch --depth=1 origin <base-commit>`, not the full history:

```bash
npm run --silent hone:check -- --base-revision <base-commit>
```

With pnpm:

```bash
pnpm run --silent hone:check --base-revision <base-commit>
```

A team that assesses forfeiture in CI leaves `forfeiture` unset and runs `npm run --silent hone:check -- --base-revision origin/main` there, or `pnpm run --silent hone:check --base-revision origin/main`; the check then needs that revision and the history back to where the branch left it, for example `fetch-depth: 0` with `actions/checkout`.

The trade: a push that bypasses the hook, for example with `git push --no-verify`, leaves no later gate, so debt can stop being forfeited unnoticed. Every run that leaves forfeiture to another run says so in its report (step 6). With `eslint` checks, the repository's own `eslint` run also reports them in the editor, from the projection.

Tell any coding agent working in the repository, in its project instructions: "Read the rule pages under `node_modules/@hailstails/hone/rules/` for the checks listed in `hone.config.json` before editing. When a check fails, read the `symptoms` section of the report and the section for the failing check in `disciplines.assessment.md`, and, in node_modules/@hailstails/hone/rules/typescript/symptoms.md, the "May indicate" and "Breach usually sits" lines of each symptom the check names, before changing anything; do not add a record, exclusion or setting to make it pass. Before handing off, run the repository's validation command, report its exit code and findings, and apply the judgement rules listed in `disciplines.assessment.md` with their review lenses." Copying the rule pages does not make an agent read them; the instruction does. Step 5a writes `disciplines.assessment.md`; Hone itself does not read or name it.

### 5a. Write the assessment

The first run on an existing codebase usually fails, often with many findings. Each finding is a signal about the design: a missing boundary, an earlier choice that forces the workaround, a port wider than its use. Before fixing or recording anything, write down what the signals mean in this codebase, in `<repo>/disciplines.assessment.md`. Whoever later hits a red check then has more to go on than the assumption that the friction is unnecessary: the file says what that clause points at here and where the code is going.

Each symptom on [the symptoms page](rules/typescript/symptoms.md) lists the cases it may indicate and where the breach usually sits. The assessment does not repeat them. It says which cause applies here, where, the forward goal in this codebase's terms, and the steps toward it.

Start from the template the package ships:

```bash
cp node_modules/@hailstails/hone/methods/assessment-template.md disciplines.assessment.md
```

Fill the top sections: the rules adopted, the checks not adopted because the rule does not apply here, the checks adopted with their engine not run because the check is not a true measure here or cannot work here, and the judgement rules adopted (step 9). Step 4 says how each is declared in `hone.config.json`; the assessment says why. The template names each by clause address; name each by its check address instead.

Then write one section per high-count check. Hone has no threshold for this. A check is high-count when its findings will not all be fixed in the change that adopts it: three findings in one file you fix today need no section; three findings in three folders you will not reach this week do.

The assessment is usually drafted by a coding agent. Give it this instruction as it is:

```text
Draft disciplines.assessment.md from node_modules/@hailstails/hone/methods/assessment-template.md, using the latest hone:check report.

For each check in the report's findings section whose findings will not all be fixed in this change:
1. Measure. Count its findings and group them by folder, by the value, library or dependency involved, and by the shape of the code.
2. Read the code at several sites in each group, not only the report lines.
3. Read the check's rule page, node_modules/@hailstails/hone/rules/<ID>/README.md, and, in node_modules/@hailstails/hone/rules/typescript/symptoms.md, each symptom the check names, closely, then the `symptoms` section of the report.
4. Match each group against the symptom's "May indicate" and "Breach usually sits" lines. Name the cause exactly as the symptoms page names it. If no listed cause fits, say so and describe what the sites show; do not pick the closest.
5. Write the check's section from the template, headed by its check address: the cause, the count and example sites as file:line, the forward goal in this codebase's terms, and the steps that change the code toward it, starting with the step that unlocks the others.

Exclusions, records, settings and not adopting a check are never a cause, a goal or a step. The Debt line says how existing debt is held while the steps are taken; write it last, after the rest of the section. A section that gives only counts, or whose steps are about recording exceptions, is not done.

Stop when every such check has a section. Report the sections for review before changing code or recording anything.
```

Review the draft as you would a design: the causes and the goals are the decisions in it. Commit it beside `hone.config.json`. Hone does not read it, so point reviewers and agents at it, as step 5's instruction does. Record debt (step 7) only after the assessment, and note each record in the check's Debt line. Keep the file current: when steps land or a count changes, update the section; when a check has no findings left, delete its section.

A finished section reads like this, for the check `claimed-type#unlisted-cast-site`:

```markdown
## claimed-type#unlisted-cast-site

- **Cause here:** Parsing skipped at a boundary. Database rows are cast to domain types where they are read.
- **Sites:** 118 at 3f1c2ab, in src/orders/ and src/billing/. For example src/orders/order-reader.ts:41, src/billing/invoice-reader.ts:17.
- **Forward goal:** rows are parsed once in the storage port, and services receive typed orders and invoices.
- **Steps:** 1. A schema per table read, in the storage port. 2. The port returns parsed types. 3. Delete the casts, one folder at a time.
- **Debt:** held by the orders team; debt records in hone-records/debt/claimed-type.json, paid off as each file is touched.
```

## 6. Read the report

The report prints only the sections that have entries, each with its count, then the verdict. A finding names the check, the engine, the place and the snippet, what the check may indicate and, where it has one, the fix. Each other line says what to do about it. The `symptoms` section, printed last, explains each symptom the findings name.

To print less, set `"reportOutput"` in `hone.config.json`, or pass `--report-output` for one run. The verdict and exit code are the same whichever output you choose.

## 7. Record what a check cannot be made to accept

Before recording anything, take the chain in [the spirit of the rules](rules/SPIRIT.md#when-the-check-is-red): measure the sites for each failing check, ask what each group points at using the `symptoms` section of the report, the "May indicate" and "Breach usually sits" lines of each symptom on [the symptoms page](rules/typescript/symptoms.md) and the check's section in `disciplines.assessment.md` (step 5a), then decide. Fix the cause where you can; a record is not the first move. Where a finding is correct in a place, or owed and cannot be fixed yet, answer it with a record in `<repo>/hone-records`, one file for each kind and symptom or recipe:

- **Debt** is known debt in one file: `hone-records/debt/<symptom>.json` with the symptom's name as `answers`, or `<symptom>#<check>` to reach one check of it, and the `file`. It is forfeited, and fails the run, as soon as that file changes since `--base-revision`. An `eslint-disable` comment or a `@ts-expect-error`, `@ts-ignore` or `@ts-nocheck` directive in a file is held only by a record on its check and file: until one holds it, such a comment is `unrecorded` and fails the run; once held, it is listed under `held` with the record that holds it. Step 7a writes that debt for the findings and for such comments.
- **An authorised location** says the symptom is correct in that file, for example the single adapter that reads the real clock when the catalogue lists that case: `hone-records/authorised-locations/<symptom>.json`. `hone authorise` writes one from the arguments it is given, with the why-chain the person supplies.
- **A boundary record** says a module is where an outside party is met, such as the clock adapter, in `hone-records/boundary-records.json`:

  ```json
  {
    "version": 2,
    "records": [
      { "module": "src/clock.ts", "outsideParty": "runtime:clock", "ports": ["Clock"] }
    ]
  }
  ```

- **A deviation** says why a file does not follow a recipe the catalogue gives, in `hone-records/deviations/<recipe>.json`. **A dependency record** says why a package is used where the platform's own way exists, in `hone-records/dependency-records.json`.

Which kind answers a finding is in the `symptoms` section of the report: each symptom's note lists the situations that are correct uses of it and the record kind that expresses each. [README.md](README.md#hone-records) gives every kind's fields. A record that answers nothing is `stale` and fails the run, except a dependency record, which no check reads yet and so is never stale, so record only what a finding needs: debt while the check still finds it, a location or boundary where the symptom is correct. If the check is not a true measure of the rule here, or cannot work here, list it as `"not-run"` instead; if the rule does not apply, list it as `"not-adopted"` (step 4).

An authorised location needs its `case`, its `owes` and a `whyChain` shaped like this, with exactly five steps in `whys`; debt needs none:

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

The chain runs cause to cause: each why asks why the answer before it is true, each answer cites evidence that can be checked again, the root names the fifth answer's cause and is checked against today, and the readback runs back from the root to the symptom with "therefore". [The why-chain contract](docs/why-chain-contract.md) has a worked example, the checks Hone runs, and what review still judges. A chain that breaks a check is refused. `file` is an exact repository path.

Records an earlier version wrote are moved by `hone upgrade` and kept word for word under `carried`, as [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 says. They are checked against `--base-revision`: any record you write or change yourself needs its full form.

Existing debt needs no chain and no case: a debt record names only its symptom and file, and step 7a writes those records for you. Add a `note` if you want to leave future developers a note on what the debt signals. A run with any debt still needs `--base-revision`, or it reports `forfeiture-unmeasured` and fails, unless forfeiture is left to another run (step 5). [README.md](README.md#hone-records) has the details.

### 7a. Record the debt you inherit

A repository with existing code usually has more findings than the change that adopts Hone can fix. `hone record-debt` writes a debt record for each symptom, check and file the check finds broken, and for each inline disable or TypeScript directive that hides one, so the first passing run does not wait on hundreds of records written by hand. Do this after the assessment (step 5a), and after fixing what you are going to fix in this change.

1. **Decide the permanent exceptions first.** List each file or folder that breaks a check on purpose and always will, such as the one adapter that reads the real clock. Those are not debt. They get an authorised location with its `whyChain`, or a boundary record, written by a person, so keep them out of the generated records with `--leave`.
2. **Leave `hone.config.json` as it is.** Debt needs no why-chain and no case, so the command needs no setting and never sets one. The same command records debt a later change uncovers, such as a newly listed check or a newer edition: run it again against the branch's base.
3. **Finish every source file this change edits.** Forfeiture is assessed against the branch's base, the revision your pre-push hook and CI pass to the check (step 5), such as `origin/main`, not against the commit you run from. A file the adopting change edits has changed since that base, so a record for it is forfeited there, even after you commit the edit; the command writes none for such a file and says so. In each file this change edits, fix every finding of each check, or take the edit out of this change and make it later in a change that fixes the file. A file this change adds has no record to lose: point 4 reports it `touched`.
4. **Run it once, with the branch's base as `--base-revision`**, one `--leave` for each path from point 1. Fetch the base first, so the revision is current:

   ```bash
   git fetch origin
   node_modules/.bin/hone record-debt --repo . --base-revision origin/main --leave src/clock.ts --leave src/adapters
   ```

   It prints one line per finding and per native exception, saying what it recorded and, for each it did not, why and what to do instead. Files under a `--leave` path need their authorised locations or boundary records from point 1 written now. Files this change created or changed need fixing.
5. **Re-project and check against the same base.** With any `eslint` check, run `npm run --silent hone:project`. Then run `npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main` (with pnpm, `pnpm run --silent hone:check --forfeiture this-run --base-revision origin/main`). `--forfeiture this-run` makes this run assess forfeiture whatever `forfeiture` says, as the run that assesses it for your repository does: the pre-push hook with `"forfeiture": "elsewhere"` (step 5), or CI without it. A `forfeited` line names a file this change edits: go back to point 3 for it. A check against `HEAD` hides those lines, because nothing has changed since `HEAD`, and the hook or CI then fails where this run passed. What stays under `unrecorded` is what no record can hold; point 4's line for each says what to do.
6. **Review the diff.** Nothing takes effect until you commit it. Each generated record is debt holding only its symptom, check and file: inherited debt that nobody has reviewed, and the reviewer of the adopting change reads it as that. Note them in each check's Debt line in `disciplines.assessment.md`.

The records are the same as any other debt record: each is forfeited once its file changes, which is how the debt is paid down. A file with no earlier revision gets no record, because it has no debt to inherit. The command is for adoption, but it does not refuse to run again: forfeiture already stops it turning new findings into debt, since a record written for a file just changed is forfeited by the next check that assesses forfeiture. That holds only where forfeiture is assessed. With `"forfeiture": "elsewhere"` (step 5), it is assessed only by the run that the repository leaves it to, such as the pre-push hook, so a push that bypasses that run lets such a record through until a later run assesses it.

Running it again only adds records for symptoms, checks and files that have none; it never removes or rewrites one. Debt that is paid is listed `paid`, or `stale` when nothing it holds is found, and `forfeited` once its file is touched. `hone prune-debt` removes it, as [README.md](README.md#pruning-paid-debt) says; any other record that has gone stale you delete by hand.

## 8. Prove one failure and correction

Before relying on the check, prove that it fails on a real violation in your repository and passes once it is fixed. With `date-used-directly#clock-sources` listed, create `src/discipline-probe.ts` (any path the check covers) containing exactly:

```ts
const probeStartedAt = Date.now();
```

Stage it, since only tracked files are checked, and run the check:

```bash
git add src/discipline-probe.ts
npm run --silent hone:check
```

It must exit `1` with a `date-used-directly#clock-sources` finding at `src/discipline-probe.ts:1`. Change the same file to `const probeStartedAt = 0;`, stage it, and run the check again: that finding must be gone. Then remove the probe with `git rm -f src/discipline-probe.ts`. A run that never showed the finding proves nothing: check that the file was staged and is not under an `exclude` entry. For another check, take a flagged form from its check page.

## 9. Apply the judgement rules

A judgement clause cannot be listed in `hone.config.json`, and no check reports it. List the judgement rules the repository adopts in the Judgement rules section of `disciplines.assessment.md` (step 5a), so reviewers and agents know to apply them.

Each rule item names its review lenses in its `lenses` fact, each a method under [methods/lenses/](methods/README.md) for reading code against that kind of rule. To review a change, by a human reviewer or a coding agent:

1. The reviewer is not the change's author. An agent reviewing a change reads files only; it does not edit them.
2. Pin the tree under review to a commit and review that.
3. Run each lens on its own, one concern at a time, without seeing the other lenses' findings. Follow the lens file: load the rule items that name it, inspect the change as it says, and report findings in its output shape, citing the clause address. A lens covers mechanical rules too, beyond what their checks flag.
4. Run [defended-on-intent](methods/lenses/defended-on-intent.md) last, over the rule text and the other lenses' findings, to catch changes that meet a rule's letter but defeat its intent.
5. Fix each finding. A deliberate departure from a judgement rule is recorded where the review decision is kept, with a `whyChain` in the same shape as step 7.

To use an agent, give it the lens file, the rule items that name it, the change and the pinned commit, and ask it to follow the lens exactly. A single reviewer covering every concern at once misses what separate lenses catch.

## 10. Update and remove

To update, on a branch, read [the changelog](https://github.com/HailsTails/hone/blob/main/CHANGELOG.md) for each version since yours, then install the new version exactly as step 2 does, with `npm install --save-dev --save-exact @hailstails/hone@<version>` or `pnpm add -D --save-exact @hailstails/hone@<version>`. Compare the installed rule pages under `node_modules/@hailstails/hone/rules/` with the old ones, re-run `hone:project` if any check is on `eslint`, run the check, and commit `package.json` and the lockfile with a message naming the new version. With a tarball, replace it with the newer one and install that instead. Rule text can change between versions, so read the changed pages. Version 2 reads different files from version 1: a repository on version 1 runs `hone upgrade` once after installing version 2, as [MIGRATING.md section 20](MIGRATING.md#20-moving-from-version-1-to-version-2) says, before it runs the check.

To remove, run `npm uninstall @hailstails/hone`, delete the two `hone:` scripts, any vendored tarball, `hone.config.json`, `hone-records`, `disciplines.assessment.md` and, with `eslint` checks, `hone.eslint.mjs`, `hone.eslint.d.mts`, every package slice and their spread in the flat config, and take the check out of the validation script.

## Known gaps

- Each check flags exactly what its page says and no more. Where a rule asks for more than its check can see, the page says which part is left to review.
- A broken nested `eslint.config.*` in a folder the root config ignores, such as fixtures under `ignores: ["fixtures/**"]`, does not stop the check: those files are reported as `ignore` native exceptions, as the team's own `eslint .` never loads that config. One pattern shape is taken for a folder ignore although it is not one: an ignore matching every entry directly inside the folder, such as `gen/*`, where the team's ESLint still enters `gen` and fails on its broken config.
- The disciplines' IDs and rule text come from one team's code-discipline set. Selecting a subset is supported; editing a shipped rule is not. Write your own rule set for different rules, following [docs/extending.md](docs/extending.md).

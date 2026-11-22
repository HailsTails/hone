# Adopting Hone

This page takes a TypeScript repository from nothing to a checked, passing run. Do the steps in order. Every command is run from the root of the repository being checked, which this page calls `<repo>`. Nothing here needs AIDLC or any agent harness. A repository that adopted the disciplines through the older standalone copy route follows [MIGRATING.md](MIGRATING.md), which uses these steps.

Hone reads `hone.config.json` in `<repo>`, runs the listed checks over every git-tracked file, answers what they find by the records in `hone-records`, and prints one report ending in `verdict: pass` or `verdict: fail`. A repository that already runs version 1, with `disciplines.json`, runs `hone upgrade` once instead of writing these files by hand, as [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) section 20 says, then follows this page from step 5.

## 1. Check the prerequisites

```bash
node --version
```

It must print `v22.18.0` or a later 22.x, or `v24.0.0` or later. A rule set of your own may write its piece modules as `.ts` files, which Hone runs with Node's built-in type stripping, so they are limited to what [Node's TypeScript support](https://nodejs.org/docs/latest-v22.x/api/typescript.html) allows: only syntax that can be erased, so no enums, no namespaces that hold values and no parameter properties; relative imports that spell the `.ts` extension; and `import type` (or `type` on each name) for anything that is only a type. Node does not strip types from files under `node_modules`, so a rule set installed as a package must ship `.js`. Also needed: git 2.24 or later and npm. `<repo>` must be a git repository, and the files to check must be committed or staged: untracked files are not checked.

## 2. Install the Hone package

Hone ships as one npm package tarball of built JavaScript, so it needs no TypeScript support from Node. It has three dependencies of its own, `zod`, `jsonc-parser` and `@eslint/plugin-kit`, each declared as a caret range starting at the version Hone is tested on, which the package manager installs from the registry. Your repository's lockfile, and any override you set, decides which release inside each range is installed, so you can take a patched release of one of them without waiting for a new Hone.

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

The last command prints `pack package: wrote <path>/artefacts/hailstails-hone-<version>.tgz`. Copy the downloaded or built tarball into `<repo>/vendor/hailstails-hone/` and commit it with a message naming the release tag or the pinned SHA. The commands in this guide are POSIX shell; on Windows run them in Git Bash.

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

`hone` is the package's one command, with six subcommands: `hone check` runs the check, `hone project` writes the ESLint projection, `hone record-debt` writes the debt records of an adopting repository, for its findings and for the inline disables that hide findings (step 7a), `hone prune-debt` removes the records of debt that is paid, `hone authorise` writes an authorised location (step 7), and `hone upgrade` moves a version 1 repository to version 2 (step 10). A seventh command, `hone split-records`, belongs to version 1: on a version 2 repository it prints `load failure: not-ready-yet` and exits `2`, and `hone split-records --help` prints its version 1 help on every repository. `hone` with no subcommand, or with a name that is none of the seven, exits `2` with one `load failure: arguments-invalid` line that names all seven and points at `hone --help`, which prints the usage.

Hone runs on the toolchain the repository already uses, which the package declares as peer dependencies: `typescript` is a required peer, because every check on the `walker` engine needs it, and the ESLint packages are optional peers, needed only for checks on the `eslint` engine. npm 7 and later install a missing required peer on their own, and some other package managers only warn about one, so declare `typescript` yourself at the repository root, at the version the repository already uses, rather than let the package manager choose or skip it. Keep the versions you have; Hone supports these ranges:

| Package | Needed for | Range |
| --- | --- | --- |
| `typescript` | any `walker` check | `>=4.8.4 <7.0.0` |
| `eslint` | any `eslint` check | `^9.39.5 \|\| ^10.15.0` |
| `@typescript-eslint/parser` | any `eslint` check | `^8.73.0` |
| `@typescript-eslint/eslint-plugin` | any `eslint` check | `^8.73.0` |

A repository that already has them in range needs nothing more. A package that is missing or out of range is named when the check runs; add it at a version inside its range and inside the range your other tooling accepts, without moving ESLint or TypeScript to another major for Hone's sake.

Hone finds these by Node's resolution upward from where the package is installed, so in a monorepo they must resolve from the repository root: declare them in the root `package.json` (with pnpm, `pnpm add -Dw` at the versions the packages already use), even where packages also declare their own. Yarn Plug'n'Play is not supported, because Hone resolves the toolchain through `node_modules`.

Commit `package.json`, the lockfile and the tarball if it is a file in the repository. Step 10 says how to update.

## 3. Read what each discipline means

[rules/numbers.md](rules/numbers.md#every-numbered-discipline) lists every discipline, and [rules/README.md](rules/README.md) explains how the named pages read. Rules are referred to by name; a number is only a clause address. Each numbered discipline has two pages. `rules/<ID>/README.md` gives its verdict, the named rules, recipes and symptoms to read, and its review lens. `rules/<ID>/CHECKS.md` holds the mechanics: the Clauses table, exactly what each check flags, a violation and its fix, and how to record an exception. Read the named pages first; [the spirit of the rules](rules/SPIRIT.md) explains the approach for the whole set. Each check is listed in `hone.config.json` by its address, `<symptom>#<check>`, such as `authored-class-or-this#class-keyword`; the Clauses table in a discipline's CHECKS.md gives each check's address beside the rule's clause address, such as `CD-14#class-syntax`, and the table in step 4 lists every one. A clause whose mechanism is `review` is a judgement clause: it has no check and is applied in review, with the review lens the rule page names (step 9).

A check covers only what its CHECKS.md says it flags. Read the whole rule, not only the Clauses table: where a rule asks for more than its check can see, CHECKS.md says which part is left to review, and the rule's review lens covers that part.

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

- `checks` keys are check addresses, `<symptom>#<check>`, listed in the table below and on the rules' CHECKS.md pages; the value is an engine the check lists, `walker` or `eslint`, `"not-run"` or `"not-adopted"`. A check of a rule set of your own is written `<ruleSet>/<symptom>#<check>`.
- Listing a check adopts it. Only a listed check runs. A check of a symptom that a listed check sees, listed nowhere, is offered under `available` and never fails the run. The symptom [Strictness weakened](rules/typescript/symptoms.md#strictness-weakened) has seven checks, one per compiler flag; list the ones you want. Checks that are one rule today run together: listing one of the six test-body checks without the others stops the run with `checks-run-together` naming them.
- A symptom may span engines; list each of its checks on an engine that has it, or mark it. `authored-class-or-this#class-keyword` runs on `walker` or `eslint` but `authored-class-or-this#static-members-only` only on `eslint`, so adopting that symptom means adopting the ESLint engine for at least that check; see [README.md](README.md#adopting-the-eslint-mechanism). If ESLint cannot work in this repository, list such a check as `"not-run"`, as below.
- A check's value in `checks` is one of three:
  - an engine id, such as `walker`: the check runs and its findings fail the run;
  - `"not-run"`: the check is adopted, but its engine is not run; the report lists it under `not-run` as `<check> adopted, engine not run: enforced by review`;
  - `"not-adopted"`: the check is not adopted; the report lists it under `not-adopted`.
- A `"not-run"` or `"not-adopted"` check is never run and never projected, not even as `"off"`, and its engine is not loaded unless another check uses it, so a repository that lists every ESLint check this way needs no ESLint installed. Both leave the run a whole assessment.
- When a check cannot simply run clean, [the spirit of the rules](rules/SPIRIT.md#not-adopted-not-run-carved-out-escaped) names three declared states. Choose one deliberately, with reasons:
  - Not adopted: the rule does not apply to this codebase; a tech lead declares that, in the open. Set the check to `"not-adopted"`.
  - Adopted, engine not run: the rule binds, but its check is not a true measure of the rule's intent here, or cannot work here for a technical reason. The check is set aside; the intent is still owed, through review. Set the check to `"not-run"`. The ESLint-only checks of `name-off-its-casing` in a repository without ESLint are the usual case: `"name-off-its-casing#naming-convention": "not-run", "name-off-its-casing#filename-case": "not-run"`.
  - Debt: the rule binds and its check is sound, but the codebase has debt it cannot address right now. Keep the check's engine, so it still runs, and record the debt file by file as debt records, which `hone record-debt` writes for you (step 7a).
- `exclude` lists folders or exact files that no engine checks, as repository paths with forward slashes; an entry containing `*` is refused, because globs are not supported. A folder entry excludes everything under it. It is the only way to narrow what Hone checks: there is no include list, and every tracked file outside `exclude` is checked, including any folder added later. Use it for generated or third-party code, and, to check only part of a repository, list every other folder. The walker already skips `node_modules`, `dist`, `build`, `coverage`, `.git` and a top-level `vendor` folder. The ESLint engine lints every tracked TypeScript file outside `exclude`, including any the repository's own ESLint config ignores: an ignore in that config does not narrow what Hone checks, and each selected check lists such a file under `unrecorded` as `<check> eslint ignore <file>` until the ignore is removed or the file is listed in `exclude`.
- `checkSettings` gives a check the settings its CHECKS.md lists under Settings, keyed by check address. `outside-import-past-a-boundary#import-or-require`, for example, flags only imports of the packages you list in its `confinedOutsideDependencies`, which the rule's CHECKS.md page still calls `confinedPackages`; `trackerPatterns` on `untracked-escape#directive-pointers` narrows tracked references to your tracker's format. See [README.md](README.md#honeconfigjson).
- `checkEditions` stays out, or `"pinned"`, unless you want stricter checks as soon as they ship. When Hone tightens a check, the stricter check arrives as a new edition, listed on the check's CHECKS.md, and becomes the default only in a major release. `"latest"` runs the newest edition of every listed check, so a minor upgrade can add findings. To take one check's newer edition only, give it `"edition"` in its `checkSettings` entry. The report lists the edition each such check ran under `editions`.
- `ruleSets` stays `{}` unless you write disciplines of your own; see [docs/extending.md](docs/extending.md).

Every check Hone ships, with the engines that can run it and the clause address its rule's pages know it by:

| Check to list | Engines | Clause address on the rule pages |
|---|---|---|
| `claimed-type#cast-to-any` | `walker` | `CD-1#any-cast` |
| `untyped-value#explicit-any` | `eslint` | `CD-1#explicit-any` |
| `untyped-value#implicit-any-let` | `eslint` | `CD-1#implicit-any-let` |
| `claimed-type#unlisted-cast-site` | `walker` | `CD-2#cast-expressions` |
| `claimed-type#non-null-assertions` | `eslint` | `CD-2#non-null-assertions` |
| `strictness-weakened#strict` | `walker` | `CD-3#strict` |
| `strictness-weakened#no-unchecked-indexed-access` | `walker` | `CD-3#no-unchecked-indexed-access` |
| `strictness-weakened#exact-optional-property-types` | `walker` | `CD-3#exact-optional-property-types` |
| `strictness-weakened#no-implicit-override` | `walker` | `CD-3#no-implicit-override` |
| `strictness-weakened#no-fallthrough-cases-in-switch` | `walker` | `CD-3#no-fallthrough-cases-in-switch` |
| `strictness-weakened#no-property-access-from-index-signature` | `walker` | `CD-3#no-property-access-from-index-signature` |
| `strictness-weakened#use-unknown-in-catch-variables` | `walker` | `CD-3#use-unknown-in-catch-variables` |
| `untracked-escape#directive-pointers` | `walker` | `CD-5#comments-directives` |
| `shorthand-name#identifier-names` | `walker` | `CD-6#identifier-names` |
| `name-off-its-casing#naming-convention` | `eslint` | `CD-6#naming-convention` |
| `drawer-path#drawer-names` | `walker` | `CD-7#categorical-paths` |
| `name-off-its-casing#filename-case` | `eslint` | `CD-7#filename-case` |
| `type-derived-from-code#factory-return-types` | `walker` | `CD-7a#factory-return-types` |
| `default-on-a-closed-union#default-arm` | `walker` | `CD-8#switch-defaults` |
| `throw-or-catch-in-a-test#throw-statement` | `walker` | `CD-10#throws-in-tests` |
| `thrown-non-error#throw-only-error` | `eslint` | `CD-10#throw-only-error` |
| `authored-class-or-this#class-keyword` | `walker` or `eslint` | `CD-14#class-syntax` |
| `authored-class-or-this#static-members-only` | `eslint` | `CD-14#static-only-class` |
| `loop-keyword#loop-statement` | `walker` | `CD-15#loops` |
| `date-used-directly#clock-sources` | `walker` | `CD-17#clock-sources` |
| `outside-import-past-a-boundary#import-or-require` | `walker` | `CD-19#import-boundaries` |
| `unit-without-a-running-test#companion-test-file` | `walker` | `CD-23#export-test-sibling` |
| `double-with-a-body#stub-implementation` | `walker` | `CD-25#dependency-isolation` |
| `module-or-global-patched#module-mock-call` | `walker` | `CD-26#module-mocking` |
| `branch-in-a-test#test-body` | `walker` | `CD-27#test-body-logic` |
| `throw-or-catch-in-a-test#try-block` | `walker` | `CD-27#test-body-logic` |
| `rebinding#test-body` | `walker` | `CD-27#test-body-logic` |
| `computed-value-in-a-test#test-body` | `walker` | `CD-27#test-body-logic` |
| `text-past-its-reader#test-body` | `walker` | `CD-27#test-body-logic` |
| `double-with-a-body#logic-in-a-passed-function` | `walker` | `CD-27#test-body-logic` |
| `test-switched-off#focused-tests` | `eslint` | `CD-27#focused-tests` |
| `test-switched-off#skipped-tests` | `eslint` | `CD-27#skipped-tests` |
| `positional-parameters#parameter-count` | `eslint` | `CD-40#parameter-count` |
| `tangled-function#cognitive-complexity` | `eslint` | `CD-41#cognitive-complexity` |
| `long-function#function-length` | `eslint` | `CD-41#function-length` |
| `work-inside-a-condition#else-after-an-exit` | `eslint` | `CD-42#useless-else` |
| `boolean-in-a-signature#boolean-annotation` | `walker` | `CD-43#boolean-signatures` |
| `write-into-a-parameter#parameter-mutation` | `walker` | `CD-44#parameter-mutation` |
| `rebinding#parameter-reassignment` | `eslint` | `CD-44#parameter-reassignment` |
| `inherited-environment-in-a-subprocess#git-spawn-environment` | `walker` | `CD-47#hermetic-git-spawns` |

Adopting a symptom with a check whose only engine is `eslint` needs the ESLint engine, or that check listed as `"not-run"`.

Starting with a few disciplines and adding more once the run passes is easier than fixing everything at once.

### 4a. Set up ESLint for `eslint` checks

Skip this if every listed check runs on the `walker`. Otherwise, after writing `hone.config.json`, write the ESLint projection:

```bash
npm run --silent hone:project
```

It prints `hone.eslint.mjs written` and `hone.eslint.d.mts written`; the second file types the first as ESLint's `Linter.Config[]`, so a TypeScript config can import it. Spread its default export last in the repository's flat config. The projection sets rules only, so the config must also parse TypeScript, with the `@typescript-eslint/parser` that step 2 installs; without it the repository's own `eslint` run fails on the first type annotation while Hone's check still passes. A repository with no ESLint config yet can start from this `eslint.config.mjs`:

```js
import typescriptParser from "@typescript-eslint/parser";
import projection from "./hone.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"], languageOptions: { parser: typescriptParser } },
  ...projection,
];
```

To confirm it, run the repository's own `eslint` on one TypeScript file with a type annotation, for example `node_modules/.bin/eslint src/index.ts` with a file of your own; it must report findings or nothing, never `Parsing error`.

In a monorepo where ESLint resolves each file from its nearest config, `hone:project` also writes a `hone.eslint.mjs` slice, with its `hone.eslint.d.mts` declaration of the type, beside each package's tracked `eslint.config.*`, holding only that package's records with paths relative to the package. Where one ESLint 9 run applies the root config to every file, package configs are never loaded and get no slice. A package config keeps its slice even in a folder the root config ignores, since a lint run from that package loads its own config without the root's ignores. A folder holding its own `hone.config.json` is a nested Hone configuration, which is not supported yet ([#72](https://github.com/HailsTails/hone/issues/72)): when the ESLint engine would check a file under it, `check` and `project` stop with `load failure: not-ready-yet eslint-config-roots: this release does not run a repository that holds other version 2 repositories yet; …` before anything is checked or written, and the line says to move the folder out and run it on its own with `--repo`. A run that lists only walker checks does not stop, and a folder with no such file gets no slice. The root config spreads the root projection last, and each package config spreads its own slice last, never the root one:

```js
import projection from "./hone.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
];
```

A package whose `eslint.config.*` is generated and not tracked needs its folder listed so Hone writes its slice, and the slice spread where the tool takes extra configuration. Each listed folder must be one git tracks files under, spelled exactly as git spells it, or the check stops with `config-root-untracked`. sku 16.6.1 is such a tool: its `packages/sku/src/utils/configureApp.ts` writes `eslint.config.mjs` into the project on every sku command and adds it to `.gitignore`, and that config applies the `dangerouslySetESLintConfig` function that `packages/sku/src/types/types.ts` declares as taking and returning `Linter.Config[]`. For sku, list the package in `hone.config.json` and spread the slice in `sku.config.ts`:

```json
{ "eslintConfigRoots": ["packages/web"] }
```

```ts
import projection from "./hone.eslint.mjs";

export default {
  dangerouslySetESLintConfig: (skuEslintConfig) => [...skuEslintConfig, ...projection],
};
```

The check names a slice that is missing or out of date, and names a listed folder whose `eslint.config.*` is not on disk as `unconfigured`: until the tool has written it, nothing loads the slice, so run the tool's configure step (for sku, any sku command or `sku configure`) before the check. A package that spreads nothing at all has its checks out of effect at once, and the check reports `engine-not-run eslint not-included` rather than trust what it could not have measured. A package that spreads the root projection instead of its slice is reported the same way only once a record answers a file in it; until then both projections give it the same rules, so the check says nothing, and silence is not proof the spread is right. To confirm the spread before recording debt, run ESLint from the package folder on a file the check flags and see the same finding. [README.md](README.md#package-slices) has the details. Hone detects which config the team's ESLint run applies from the installed `eslint` version and the lint scripts; see [README.md](README.md#runtime). Detection is wrong when a task runner (turbo, nx, `pnpm -r`) starts ESLint 9 inside each package, because each package then uses its own config, and when ESLint 9 gets the lookup flag outside the scripts. In those repositories set the lookup in `hone.config.json`:

```json
{ "eslintConfigLookup": "nearest-to-file" }
```

Use `"nearest-to-file"` when ESLint runs per package, with ESLint 10, or with ESLint 9 and `--flag v10_config_lookup_from_file`. Use `"repository-root"` for one ESLint 9 run from the repository root, whose root `eslint.config.*` then applies to every file. To confirm the setting, lint a package file the way the team does (for example `pnpm exec eslint packages/a/src/x.ts` from where the lint script runs) and check that it reports the same finding the Hone check lists for that file.

Commit the projection, every slice and the configs. Hone's check reads this configuration and fails if the projection or a slice is missing, not in effect, or out of date, so re-run `hone:project` whenever `hone.config.json` or `hone-records` changes or Hone is updated. The projection imports one plugin, `@hailstails/hone/eslint-plugin`, registered under the namespace `hone`, so the repository's ESLint must resolve `@hailstails/hone` from the repository root. Hone's own ESLint run uses the repository's root `eslint` from step 2, the same copy the projection's pieces load; its verdict is the same on 9.x and 10.x. [README.md](README.md#adopting-the-eslint-mechanism) has the details.

## 5. Run the check

```bash
npm run --silent hone:check
```

| Exit code | Meaning |
| --- | --- |
| `0` | `verdict: pass` |
| `1` | `verdict: fail`: the report says why |
| `2` | an input could not be loaded or a check crashed; the output is one line starting `load failure:` or names the failing piece |

`npm run` passes the exit code through. `sh: hone: not found` or `'hone' is not recognized` means step 2's install is missing; run `npm install`. A `load failure: engine-failed <engine> toolchain-unavailable <package> ...` line names every toolchain package that is missing from the repository root or outside its range; install a version of each in the range it prints. For a `typescript` that is not installed, the line says the install is incomplete, since a supported install always has its required peer: add `typescript` to the root's `devDependencies` and reinstall. An `engine-failed <engine> toolchain-shadowed <package> resolved from ...` line means a copy of that package sits inside Hone's own install folder, which the line names: delete that `node_modules` folder and reinstall.

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

A run that leaves forfeiture to another run ends `verdict: pass (partial assessment)` or `verdict: fail (partial assessment)`, not `verdict: pass` or `verdict: fail`. A hook or gate that matches `verdict: pass` or `verdict: fail` at the end of the line reads neither, and may report the run as unverified. Act on the exit code, or match all four verdict lines that [docs/output-contract.md](docs/output-contract.md#the-version-2-report) lists.

CI leaves forfeiture to the hook, and with `elsewhere` in effect it can run the check with no base revision:

```bash
npm run --silent hone:check
```

Records carried over by `hone upgrade` follow the same setting. A run given no base leaves them to the run that has one: it prints `carried standing elsewhere` with how many, and passes as a partial assessment when nothing else fails. A run given a base judges them against it, whatever `forfeiture` says. So keep at least one run that has a base, the pre-push hook above, or they are never judged. If CI should judge them too, pass the pull request's base commit; the base is then used for those records only, and no debt is forfeited. CI needs that one commit fetched, for example `git fetch --depth=1 origin <base-commit>`, not the full history:

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

The report prints only the sections that have entries, each with its count, then the verdict. A finding line names the check that raised it, the engine, the place and the snippet, then what the check may indicate and, where it names one, the fix:

```text
<check> <engine> <file>:<line>:<column> <snippet> may indicate: <indicated>
<check> <engine> <file>:<line>:<column> <snippet> may indicate: <indicated> fix: <fix> (<fix page>#<section>)
loop-keyword#loop-statement walker src/basket.ts:15:0 for (const line of this.lines) { may indicate: no-hidden-effects, ports-declared-inside, doer-or-orchestrator
```

A finding of a clause the symptom catalogue gives no check, such as one from a rule set of your own, prints its clause address and its mechanism, without the indication.

[docs/output-contract.md](docs/output-contract.md#the-version-2-report) lists every line the report can print, exactly as printed, and which parts are stable. Lines are 1-based and columns 0-based. The run passes only when every failing section is empty. The sections, in the order they print, are:

| Section | Meaning and what to do |
| --- | --- |
| `excluded` | the `exclude` entries from `hone.config.json` that were left out of the run; informational, check it is what you meant |
| `not-adopted` | the checks `hone.config.json` lists as `"not-adopted"`; informational, they were neither run nor projected |
| `not-run` | the checks `hone.config.json` lists as `"not-run"`, each as `<check> adopted, engine not run: enforced by review`; informational, they were neither run nor projected, and the rule is still owed through review |
| `editions` | each check with more than one edition, with the edition that ran and the latest; informational, see `checkEditions` in [step 4](#4-write-honeconfigjson) |
| `findings` | violations: fix the code, or answer them with a record (step 7) |
| `answered` | findings a record answers, each with the record that answers it; informational |
| `available` | a check no setting lists whose symptom a listed check sees; informational, list it in `hone.config.json` with an engine to run it |
| `stale` | a record that answers no finding and holds no native exception, which says why when it is debt: nothing it holds is found, its file is gone, or its file is excluded. Debt is removed by the `hone prune-debt` command its line names; run it, then `npm run --silent hone:project`. Delete every other stale record by hand ([README.md](README.md#pruning-paid-debt)) |
| `forfeited` | debt on a file this change touched, which no longer answers: fix the file; `hone prune-debt` then removes the record |
| `unrecorded` | a native exception no record holds, as `<check> <engine> <kind> <detail>`: remove it, or record it where step 7 allows. An inline disable, an `eslint-disable` naming no rule, and a lint-script option each print their own line; [README.md](README.md#commands) lists them. A lint-script option weakens the script's whole run, so no record can cover it: remove it from the script |
| `misnamed` | an inline disable naming a version 1 rule id, or an id no check of this run has, which suppresses nothing: name the rule the check now has |
| `paid` | debt that another record answers in place of, for a finding this run raised, with the exact `hone prune-debt` command that removes it; informational next step, it never fails the run |
| `refused` | a record that cannot be read or applied, with the reason: correct or delete it |
| `unmeasured` | something could not be measured; each line says what, why and what Hone needs, for example `forfeiture-unmeasured no-base-revision: no --base-revision was given, so debt cannot be checked for forfeiture; pass --base-revision with the branch's base, such as origin/main, or leave forfeiture to another run with "forfeiture": "elsewhere" in hone.config.json or --forfeiture elsewhere` |
| `projection-problems` | a projection or package slice that differs from what `hone project` writes now, is not written, is not in effect, or has no configuration to load it, each with what to do, for example `eslint out-of-date: hone.eslint.mjs differs from what hone project writes now; run node /work/shop/node_modules/@hailstails/hone/core/check/tool-command.js project --repo /work/shop and commit every file it writes` |
| `assessment` | a concern this run left to another run, for example `forfeiture elsewhere: 37 debt records not checked for forfeiture in this run`; informational, and the verdict line then reads `verdict: pass (partial assessment)` or `verdict: fail (partial assessment)` |
| `settings-notes` | what `hone.config.json` declares that no check reads yet; informational |
| `record-notes` | a note on a record, such as a case or an `owes` the catalogue does not list, by its records file and index; informational |
| `carried` | records `hone upgrade` carried from version 1, with what each lacks and whether the base held them; informational, see [MIGRATING.md](MIGRATING.md#20-moving-from-version-1-to-version-2) |
| `symptoms` | printed last, one note for each symptom the findings name: what it may indicate, where the breach usually sits, the recipes that answer it, its correct uses and where to record each, and the page that explains it; guidance, it never fails the run |

To print less, set `"reportOutput"` in `hone.config.json` for the repository, or pass `--report-output <output>` for one run, which wins over the file. `full` is the default and prints the report above; `actionable` leaves out the informational sections and keeps the failing, next-step and guidance ones; `counts` prints only each section's heading and count, adding `informational`, `next-step` or `guidance` after the sections that never fail the run so every other line names a section that failed it; `verdict-only` prints only the verdict line. Every output ends in the verdict line, and the exit code is the same whichever output you choose. An unknown value fails the run with exit `2`, as `arguments-invalid` for the option or `file-malformed` for the file.

## 7. Record what a check cannot be made to accept

Before recording anything, take the chain in [the spirit of the rules](rules/SPIRIT.md#when-the-check-is-red): measure the sites for each failing check, ask what each group points at using the `symptoms` section of the report, the "May indicate" and "Breach usually sits" lines of each symptom on [the symptoms page](rules/typescript/symptoms.md) and the check's section in `disciplines.assessment.md` (step 5a), then decide. Fix the cause where you can; a record is not the first move. Where a finding is correct in a place, or owed and cannot be fixed yet, answer it with a record in `<repo>/hone-records`, one file for each kind and symptom or recipe:

- **Debt** is known debt in one file: `hone-records/debt/<symptom>.json` with the symptom's name as `answers`, or `<symptom>#<check>` to reach one check of it, and the `file`. It is forfeited, and fails the run, as soon as that file changes since `--base-revision`. An `eslint-disable` comment or a `@ts-expect-error`, `@ts-ignore` or `@ts-nocheck` directive in a file is held only by a record on its check and file: until one holds it, such a comment is `unrecorded` and fails the run. Step 7a writes that debt for the findings and for such comments.
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

1. **Decide the permanent exceptions first.** List each file or folder that breaks a check on purpose and always will, such as the one adapter that reads the real clock. Those are not debt. They get an authorised location or a boundary record with their own reason, written by a person, so keep them out of the generated records with `--leave`.
2. **Leave `hone.config.json` as it is.** Debt needs no why-chain and no case, so the command needs no setting and never sets one. The same command records debt a later change uncovers, such as a newly listed check or a newer edition: run it again against the branch's base.
3. **Finish every source file this change edits.** Forfeiture is assessed against the branch's base, the revision your pre-push hook and CI pass to the check (step 5), such as `origin/main`, not against the commit you run from. A file the adopting change edits has changed since that base, so a record for it is forfeited there, even after you commit the edit; the command writes none for such a file and says so. In each file this change edits, fix every finding of each check, or take the edit out of this change and make it later in a change that fixes the file. A file this change adds has no record to lose: point 4 reports it `touched`.
4. **Run it once, with the branch's base as `--base-revision`**, one `--leave` for each path from point 1. Fetch the base first, so the revision is current:

   ```bash
   git fetch origin
   node_modules/.bin/hone record-debt --repo . --base-revision origin/main --leave src/clock.ts --leave src/adapters
   ```

   It prints one line per finding and per native exception under `unrecorded`. `recorded` lines are records it added to `hone-records`. `left` lines are files under a `--leave` path: write their records now, each with its own reason. `touched` lines are files this change created or changed: fix them, or record them yourself with a reason of your own. `already-recorded` and `unrecordable` lines say why nothing was written, and each `unrecordable` line says what to do instead; for an `ignore` it is to remove the ignore, or to list a generated or vendored file in `exclude` so that Hone's setting and the team's ignore agree; [README.md](README.md#recording-inherited-debt) has the details. When it recorded anything, a last line names the `hone project` command that puts the records into effect, which point 5 runs.
5. **Re-project and check against the same base.** With any `eslint` check, run `npm run --silent hone:project`. Then run `npm run --silent hone:check -- --forfeiture this-run --base-revision origin/main` (with pnpm, `pnpm run --silent hone:check --forfeiture this-run --base-revision origin/main`). `--forfeiture this-run` makes this run assess forfeiture whatever `forfeiture` says, as the run that assesses it for your repository does: the pre-push hook with `"forfeiture": "elsewhere"` (step 5), or CI without it. A `forfeited` line names a file this change edits: go back to point 3 for it. A check against `HEAD` hides those lines, because nothing has changed since `HEAD`, and the hook or CI then fails where this run passed. The generated records cover the findings and the inline disables and directives that hide them, so what stays under `unrecorded` is what no record can hold: an `ignore`, a `suppression-entry`, an inline rule configuration, a `config-override` or a lint-script option. Each has an `unrecordable` line from point 4 that says what to do about it. For an `ignore`, the findings in the file are already recorded, so removing it hides nothing, and a generated or vendored file can instead be listed in `exclude` so that Hone's setting and the team's ignore agree; for a `suppression-entry`, the findings in the file are already recorded, so removing it hides nothing; for a `config-override`, remove it or narrow it to the files that need it.
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

It must exit `1` with a line starting `date-used-directly#clock-sources walker src/discipline-probe.ts:1:0 const probeStartedAt = Date.now();` among its findings. Change the same file to `const probeStartedAt = 0;`, stage it, and run the check again: that finding must be gone. Then remove the probe with `git rm -f src/discipline-probe.ts`. A run that never showed the finding proves nothing: check that the file was staged and is not under an `exclude` entry. For another discipline, take a flag case from its `rules/<ID>/discipline.json`.

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

## Worked example

In the Hone source repository, `tests/test-fixtures/walkthrough/` is a small repository before and after its fix, and a test runs both through the shipped `hone check` and requires the reports below, and the two files shown, to be what it prints. It lists `claimed-type#unlisted-cast-site` and `claimed-type#cast-to-any`, `loop-keyword#loop-statement`, `date-used-directly#clock-sources` and `unit-without-a-running-test#companion-test-file` on the walker, with the ESLint-only `claimed-type#non-null-assertions` listed as `"not-run"`, because the repository has no ESLint, and a `generated/` folder excluded:

```json
{
  "version": 2,
  "ruleSets": {},
  "checks": {
    "claimed-type#cast-to-any": "walker",
    "claimed-type#unlisted-cast-site": "walker",
    "claimed-type#non-null-assertions": "not-run",
    "loop-keyword#loop-statement": "walker",
    "date-used-directly#clock-sources": "walker",
    "unit-without-a-running-test#companion-test-file": "walker"
  },
  "exclude": ["generated"]
}
```

Before, `npm run --silent hone:check` prints, and exits `1`:

```text
excluded (1)
generated
not-run (1)
claimed-type#non-null-assertions adopted, engine not run: enforced by review
findings (5)
date-used-directly#clock-sources walker src/basket.ts:7:0 private openedAt = Date.now(); may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator
claimed-type#unlisted-cast-site walker src/basket.ts:10:20 entry as Line);   }    total(): string {     let pence = 0;     for (const line … may indicate: declared-not-asserted, straight-through-tests, handed-what-it-uses
loop-keyword#loop-statement walker src/basket.ts:15:0 for (const line of this.lines) { may indicate: no-hidden-effects, ports-declared-inside, doer-or-orchestrator
date-used-directly#clock-sources walker src/basket.ts:22:0 return Date.now() - this.openedAt; may indicate: ports-declared-inside, written-out-answers, doer-or-orchestrator
unit-without-a-running-test#companion-test-file walker src/utils/format.ts:1:0 missing co-located *.test.ts(x) sibling may indicate: tested-where-its-owned
symptoms (4)
date-used-directly: Date used directly. May indicate: needs the current time, a random value, a new id or an outside ordering → Ports declared inside, Written-out answers; does one job → Doer or orchestrator. The breach usually sits in the unit that should be passed the time, often a doer doing two jobs. Recipe: World values through a port. Correct use: a boundary record on the clock adapter. Known debt: debt. Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#date-used-directly
claimed-type: Claimed type. May indicate: gives a value its type (declares it, or needs it narrower) → Declared, not asserted; checks a value that may be one of several outcomes → Straight-through tests; gives a value its type (declares it, or needs it narrower): in a test, a cast to build an input → Handed what it uses. The breach usually sits in the declaration: an input too wide, a generic not bounded, a missing parse. Recipes: Fix the declaration, not the value; Assert to narrow; One argument object. Correct use: an authorised location in the adapter whose outside contract forces it. Known debt: debt. Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#claimed-type
loop-keyword: Loop keyword. May indicate: makes a new value from what it has → No hidden effects; causes an effect (writes, logs, sends, exits) → Ports declared inside; coordinates other units → Doer or orchestrator. The breach usually sits in the unit. Recipe: Functional iteration. Draining a stream: an authorised location in its source's adapter. Known debt: debt. Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#loop-keyword
unit-without-a-running-test: Unit without a running test. May indicate: gives each unit its test → Tested where it's owned. The breach usually sits in the missing test. Recipe: Companion test file. Known debt: debt. Read node_modules/@hailstails/hone/rules/typescript/symptoms.md#unit-without-a-running-test
verdict: fail
```

The reports name the pages from an installed package, `node_modules/@hailstails/hone/rules/typescript/symptoms.md`; a run from the source repository names them from there.

The fix replaces the `Basket` class with functions over a readonly `Basket` value, sums with `reduce`, takes the time from an injected `Clock`, types the input instead of casting it, moves `src/utils/format.ts` to `src/format.ts` with a `src/format.test.ts` sibling, and records `src/clock.ts`, the one adapter that reads `Date.now()`, as a boundary record in `hone-records/boundary-records.json`:

```json
{
  "version": 2,
  "records": [
    { "module": "src/clock.ts", "outsideParty": "runtime:clock", "ports": ["Clock"] }
  ]
}
```

After, the same command prints, and exits `0`:

```text
excluded (1)
generated
not-run (1)
claimed-type#non-null-assertions adopted, engine not run: enforced by review
answered (1)
date-used-directly#clock-sources walker src/clock.ts:3:0 export const createSystemClock = (): Clock => ({ now: () => Date.now() }); answered by boundary-record runtime:clock
verdict: pass
```

## Known gaps

- The worked example uses only the walker engine. The ESLint consumer in `tests/test-fixtures/consumer-proof/eslint/` is the tested ESLint setup.
- Each check flags exactly what its CHECKS.md says and no more. Where a rule asks for more than its check can see, the page says which part is left to review.
- A snippet is the text the check reports; some checks report a fixed-width window that runs across lines, as `claimed-type#unlisted-cast-site` does above. No snippet is longer than 200 characters: a longer one is cut and ends in `…`. An ESLint finding on a line longer than that, such as a bundled or minified file, shows the line from the finding's column.
- A broken nested `eslint.config.*` in a folder the root config ignores, such as fixtures under `ignores: ["fixtures/**"]`, does not stop the check: those files are reported as `ignore` native exceptions, as the team's own `eslint .` never loads that config. One pattern shape is taken for a folder ignore although it is not one: an ignore matching every entry directly inside the folder, such as `gen/*`, where the team's ESLint still enters `gen` and fails on its broken config.
- The disciplines' IDs and rule text come from one team's code-discipline set. Selecting a subset is supported; editing a shipped rule is not. Write your own rule set for different rules, following [docs/extending.md](docs/extending.md).

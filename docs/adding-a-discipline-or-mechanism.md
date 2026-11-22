# Adding a discipline or a mechanism

Core names no discipline and no mechanism, so adding either one is a matter of adding files in the right places. This guide lists those files, the import boundaries they must keep, and, for a mechanism with its own exception formats, how each format maps to an exception kind.

Terms used below:

- A **discipline** is a rule a repository can adopt, with an id such as `PD-1`, made of one or more **clauses**.
- A **mechanism** is a tool that checks clauses, such as the TypeScript `audit` or `eslint`. Each mechanism has one **runner**.
- A **piece** is one discipline's code for one mechanism, written in that mechanism's own extension format.
- A **rule set** is a directory holding `rules/` and `mechanisms/` folders. The rule set shipped with the tool is `hone`, which a bare address also names, so no rule-set name may be `hone` or start with `hone-`, and no declared name may be another declared name plus `-<suffix>`; a repository can add its own and name them in `disciplines.json`.
- A **native channel** is a way the tool itself lets a team exempt or weaken a rule, outside core's exception records.

## Adding a discipline

### 1. The discipline file

Create `rules/<DisciplineId>/discipline.json` in a rule set. The id is two to four capital letters, a hyphen and a number, with an optional lower-case letter (`PD-1`, `AC-12`, `AC-7a`), and must match the folder name.

```json
{
  "version": 1,
  "id": "PD-1",
  "clauses": [ ]
}
```

Each clause is either mechanical or judgement:

- A **mechanical** clause has `"kind": "mechanical"`, `id`, `summary`, `mechanisms` (the mechanism ids allowed to check it), `anchor` and `cases`. `anchor` is `{ "kind": "keyword", "keyword": "<token>" }` when hits sit on a token in the source, or `{ "kind": "file" }` for a clause about a path, whose hits are at line 1, column 0.
- A **judgement** clause has `"kind": "judgement"`, `id`, `summary` and `"enforcedBy": "review"`. It records the requirement but cannot be selected; review enforces it.

Clause ids are lower-case words joined by hyphens, and are unique within the discipline.

### 1a. The rule pages

Each discipline has two pages beside its `discipline.json`, so a reader meets the rule's intent before any detail of how it is checked.

`rules/<DisciplineId>/README.md` holds the rule and its spirit, and ends on the spirit:

- `# <ID>: <title>`, then `## Rule` with the rule text.
- One line that starts `Review lens:` and links the lens (the lenses find their pages by this line), then links `CHECKS.md` and [the spirit of the rules](../rules/SPIRIT.md).
- `## Spirit`, where a reader starts before changing code. On Hone's own pages it names the [symptoms](../rules/typescript/symptoms.md) a finding may show and the [principles](../rules/principles.md) behind them, and its `## Rule` gives the rule's verdict and the named pages that govern it in place of rule text. The pages of the disciplines outside the cases keep an earlier Spirit in five bold-lead parts.

The Spirit section does not talk about syntax, detectors or linting. [rules/SPIRIT.md](../rules/SPIRIT.md) gives the approach for the whole set.

`rules/<DisciplineId>/CHECKS.md` holds the mechanics. It opens by pointing back to the rule page, then gives the Clauses table, what each check flags and misses, any settings, a violation and its fix, and how to record an exception.

### 2. The shared cases

A mechanical clause's `cases` hold `flag` and `allow` lists. Each case is `{ "name", "fileName", "source", "expectedLines" }`: a flag case lists the lines that must be flagged (at least one), and an allow case lists none. `fileName` is a repository path and may be a declaration file such as `x.d.ts`. There must be at least one of each.

The cases are shared by every mechanism the clause lists. A mechanism conforms for a clause when, run over each case's source, it flags exactly the expected lines. That is how two mechanisms are held to the same verdict: the cases behind `authored-class-or-this#class-keyword` are run through both the walker and the ESLint runner. `authored-class-or-this#class-keyword` is the check's name, given for reading: today's tool neither accepts nor prints a check's name, so write and expect the clause address; check names become typeable in 2.0.

### 3. A piece per mechanism

For each mechanism in a clause's `mechanisms` list, add a piece folder `mechanisms/<MechanismId>/<DisciplineId>/` in the same rule set, holding `piece.json` and the piece's source.

```json
{
  "version": 1,
  "discipline": "PD-1",
  "mechanism": "audit",
  "clauses": [{ "clause": "no-tmp-files", "settings": { "module": "no-tmp-files.ts" } }]
}
```

`discipline` and `mechanism` must match the folder names, every `clause` must exist in the discipline, and no clause may appear twice. Core reads only this envelope. `settings` belongs to the runner, which parses it with its own schema:

- **audit:** `{ "module": "<file>.ts" }`, a path inside the piece folder; a `.js` module is accepted too, which is what the built package's pieces name. The module exports `check`, typed with `import type { WalkerPiece }` from `mechanisms/audit/runner/walker-piece.ts`. See `mechanisms/audit/runner/README.md`.
- **eslint:** `{ "pluginNamespace", "pluginModule", "rule" }`. `pluginModule` is a `.ts` or `.js` path inside the piece folder whose default export is an ESLint plugin; `rule` must be a key of its `rules`. The rule id is `<pluginNamespace>/<rule>`. The namespace `hone-core` is reserved for Hone's own machinery. The namespaces `hone` and `hone-*` belong to Hone's own rule set. A team rule set's pieces must use its rule-set name or `<ruleSet>-<name>`. Two selected clauses may not share a rule id, or a namespace with different plugin modules. The ESLint piece behind `authored-class-or-this#class-keyword` is the `piece.json` in its discipline's folder under `mechanisms/eslint/`, pointing at the rule `no-class-authoring` in `cd14/cd14.eslint-plugin.ts` under the namespace `hone`. A shipped piece writes each of its own rules with `siteRule` from `mechanisms/eslint/runner/rule-sites.ts`, which holds the mapping onto ESLint's listener keys (see the runner's README). A team rule set's piece stays a plain ESLint plugin.

A clause entry may also declare the settings a repository may tune, beside `settings`: `"clauseSettings": { "<key>": { "default": <JSON>, "choices": [<JSON>, ...] } }`. `choices` is optional; when given, every choice is the default's JSON kind and the default is one of them. Core reads these declarations itself, checks a repository's values from its `disciplines.json` against them when the check loads, and hands the piece the settled values, defaults included, as `clauseSettings` on each clause, typed `ClauseSettingValues`, apart from the mechanism's own `settings`. The `audit` and `rule-set` type entries carry no code, so a team's piece checks the shape of its `clauseSettings` itself, for example with its own schema, and returns `piece-invalid` when they do not match. No eslint piece declares `clauseSettings` yet, so a repository's settings for an eslint clause are refused when the check loads.

A runner reports a bad `settings` value, a module that fails to load or does not match its schema, or a missing rule as `piece-invalid`.

### 4. Tests

Give each piece source file a co-located `.test.ts`. A piece's test runs the clause's shared cases through its runner and checks the flagged lines:

- an audit piece calls `conform` on an audit runner (the `class-syntax.test.ts` of the audit piece behind `authored-class-or-this#class-keyword` builds one with `createWalkerRunner` and the real TypeScript parse port);
- an ESLint piece calls the ESLint port's `lintSourceCases` with its plugin (`cd14/cd14.eslint-plugin.test.ts` in the same discipline's ESLint piece).

A path-only audit piece reads no source, so its test can prepare `check` and call `prepareFile` directly on each path, as the probe's does. The runner's own suite runs core's `checkConformance` over every shared piece it serves (see "Adding a mechanism", step 4). FR-8's import checks (below) cover the new files with no change.

### Worked example: the probe discipline

`tests/probe-rule-set/` is a test-only rule set, named `probe`, holding one discipline written exactly as a team would write its own. It was added beside Hone's own rule set with no change to core or to the audit runner.

- `tests/probe-rule-set/rules/PD-1/discipline.json` declares one mechanical clause, `no-tmp-files`: mechanisms `["audit"]`, anchor `{ "kind": "file" }`, one flag case (`src/scratch.tmp.ts`, line 1) and one allow case (`src/kept.ts`, no lines).
- `tests/probe-rule-set/mechanisms/audit/PD-1/piece.json` maps that clause to the module `no-tmp-files.ts`.
- `tests/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts` exports `check`, an audit piece that completes each file from its path alone: a hit at line 1 for a path ending `.tmp.ts`, none otherwise. It reads no file, so the walker never parses on its behalf.
- `no-tmp-files.test.ts` tests `check` directly; the probe has no conformance test of its own.
- The piece imports only a type, `WalkerPiece`, from the audit runner, as a path relative to its own file. Type imports are erased when Node runs the source, so the path matters only to typechecking.

A repository selects it by naming the rule set and the clause:

```json
{
  "version": 1,
  "ruleSets": { "probe": "probe" },
  "clauses": { "probe/PD-1#no-tmp-files": "audit", "CD-23#export-test-sibling": "audit" }
}
```

`src/composition/probe-check.integration.test.ts` runs that selection: the probe flags `src/scratch.tmp.ts`, `unit-without-a-running-test#companion-test-file` (`CD-23#export-test-sibling`) flags `src/kept.ts` for its missing test sibling, and the audit runner parses each file once even though two disciplines are selected.

## Adding a mechanism

### 1. The runner

Create `mechanisms/<MechanismId>/runner/runner.ts`. The id is lower-case words joined by hyphens, and never `not-run` or `not-adopted`, which `disciplines.json` reserves for a clause adopted with its mechanism not run and a clause a repository does not adopt. The module has one named export, `runner`, built by a factory in its own file so the runner's tests can call the factory with test doubles. The ESLint runner's `runner.ts`:

```ts
export const runner = toolchainBoundEmbeddedRunner({
  toolchain: loadEslintToolchain({ peers: defaultEslintToolchainPeers }),
  projectedKinds: ESLINT_PROJECTED_KINDS,
  runnerOf: (toolchain) =>
    createEslintRunner({
      fileText: createDefaultFileTextPort({}),
      modules: createDefaultModuleLoaderPort({}),
      path: createDefaultPathPort({}),
      eslint: createEslintPort({ toolchain }),
    }),
});
```

A runner whose tool comes from the adopting repository declares that tool as a peer dependency with a `ToolchainRequirement` that says whether the peer is `required`, as `typescript` is for the audit mechanism, or `optional`, as the ESLint toolchain is, matching the package's `peerDependenciesMeta`, and whose floor is the oldest release its API use is tested on, and is given a `PeerToolchain`: the package location port (`core/platform-ports/package-location-port.ts`) and a dynamic import per package. It loads each package through `loadedPeer` (`core/mechanism-port/toolchain-requirement.ts`) and binds itself to the result with `toolchainBoundStandaloneRunner` or `toolchainBoundEmbeddedRunner` (`core/mechanism-port/toolchain-bound-runner.ts`), which build the runner once. A missing, unloadable or out-of-range tool is the failure `toolchain-unavailable`, and one that resolves from inside the installed core package is `toolchain-shadowed`, both before any piece loads.

Core loads `runner.ts` once per check and parses the export with its own schema (`core/mechanism-port/runner-module-schema.ts`). An unknown exception path, a missing member or a member that is not a function is the load failure `runner-invalid`. Core also parses everything a runner returns; a value outside its schema, a hit for a clause or file it was not asked about, or a call that throws or rejects is `runner-invalid-output`, and the check exits `2`. A runner reports its own failures as a `RunnerFailure` (`core/mechanism-port/runner-failure.ts`): `piece-invalid`, `tool-failed`, `file-unreadable`, `file-unparseable`, `plugin-conflict`, `team-config-unloadable`, `runner-invalid-output`, `toolchain-unavailable` or `toolchain-shadowed`.

Either kind of runner may also return `measured`: a list of `{ clause, file }` pairs, one for each clause it measured on each file. Only the mechanism knows this, so core infers none of it. A file the runner was handed and skipped has no pair, and neither does a run that did not happen. A pair for a clause or file the request did not hold is `runner-invalid-output`. `hone prune-debt` removes a stale or forfeited `file-carve-out` on a file that still exists only when its clause and file are among the pairs and no finding or native exception still holds them. A runner that returns no `measured` has measured nothing, so its debt on files that still exist stays for a person.

Use core's ports (`core/platform-ports/`) for files, module loading and paths, and wrap the tool itself in one factory file that is the only place the tool's package is imported. The audit mechanism's is `typescript-parse.ts`; the ESLint runner's is `eslint-toolchain.ts` (`eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` and `typescript`), with `inline-config-parser.ts` the only importer of `@eslint/plugin-kit`.

### 2. Choose an exception path

A runner declares `exceptionPath`, which tells core how the tool's own exception formats are handled.

- **Standalone** (`"standalone"`): the tool has no exception format of its own, or none the repository can write to. The runner implements `run`, which returns raw hits for the selected clauses with no exception applied, and the `inline-disable` native exceptions it found, and `conform`, which runs a clause over its shared cases without reading any repository file. Core applies `discipline-exceptions.json` itself. The audit mechanism is standalone. The author's contract is `StandaloneRunner` in `core/mechanism-port/runner-module-schema.ts`.
- **Embedded** (`"embedded"`): the tool has its own ignore, override, suppression or inline formats, which the team's own run of the tool honours. The runner reports every native channel that touches a selected clause, and writes a projection so the team's run honours the recorded exceptions. ESLint is embedded. The author's contract is `EmbeddedRunner` in `core/mechanism-port/embedded-runner-module-schema.ts`; see "Embedded mechanisms" below.

Core knows only these two paths. A mechanism that fits neither would need a change to core.

### 3. The runner's other files

- `mechanisms/<MechanismId>/runner/piece-type-packages.json`: a JSON array of the packages a piece may import types from. The audit mechanism's is `["typescript"]` and the ESLint runner's is `["eslint"]`. It is not the runtime list.
- `mechanisms/<MechanismId>/runner/README.md`: the runner's runtime requirements, its piece contract and its piece settings. See `mechanisms/audit/runner/README.md` and `mechanisms/eslint/runner/README.md`.
- A co-located `.test.ts` for every source file.

### 4. Conformance

Each runner's suite runs core's `checkConformance` (`core/conformance/conformance.ts`) over the real runner as core loads it, for every shared clause its pieces serve. It calls the runner's `conform` and compares the flagged lines with each case's expected lines; the runner conforms for a clause when the result is ok and lists no failures. The audit mechanism's is `mechanisms/audit/runner/walker-conformance.test.ts`; the ESLint runner's is in `src/composition/native-exceptions.integration.test.ts`. Conformance runs the real tool in memory, because the tool's verdict is what is being checked.

A runner that answers a version 2 run through a checks runner, as ESLint does with its `checksRunner` export (`ChecksRunner` in `core/mechanism-port/checks-runner-types.ts`), implements `conform` there as well as `run`. `conform` is required: a module whose `checksRunner` has none is the load failure `runner-invalid`. `toolchainBoundChecksRunner` passes `conform` through the toolchain binding, as it does `run`. The report of a checks runner's `run` holds `projection`, the state of the root projection file, and `slices`, each other projection file it found `missing`, `out-of-date` or `unconfigured` (written for a declared config root whose folder holds no lint configuration on disk, so nothing loads it), named by its repository path. A checks runner reports no other slice state. Core lists each entry under `projectionProblems` as a line naming the file, which fails the check, whatever the root projection's state. The conformance kit (`clauseConformanceOf` in `@hailstails/hone/testing`) asks a standalone runner's `runner.conform`, and for an engine that runs through a native tool asks `checksRunner.conform`; such an engine with no `checksRunner` is the setup failure `runner-unloadable`, "the runner module exports no checksRunner, which version 2 conformance needs of an engine that runs through a native tool". Importing the module still builds its `runner` export; version 2 conformance does not call it.

### 5. Selecting it

To let a clause use the new mechanism, add the mechanism id to that clause's `mechanisms` list and add a piece for it (see "Adding a discipline", step 3). Until a clause lists it, a repository cannot select it.

## Import boundaries (FR-8)

These hold for every discipline and mechanism. Tests under `core/check/` check them over every file in the install and the probe rule set, so a new file is covered with no change, with one exception: a new mechanism's wrapping file, the one runner file allowed to import its tool, must be added by name to the lists in `core/check/vendor-imports.test.ts`, which name each mechanism's wrapping files and vendors.

- **Core names no discipline and no mechanism.** No file under `core/` may contain a discipline id or mechanism id found in the install, or import anything under `mechanisms/` or `rules/` (`core/check/core-names-no-mechanism.test.ts`). Core reaches a runner only by loading its `runner.ts` at run time.
- **A runner names no discipline.** No file in a `mechanisms/<MechanismId>/runner/` folder may contain a discipline id.
- **A piece reaches only its own mechanism's runner, core, and its own discipline's files** (`core/check/piece-imports.test.ts`). A relative import from a piece in `mechanisms/<MechanismId>/<DisciplineId>/` must resolve inside exactly one of: that piece folder; the same rule set's `rules/<DisciplineId>/`; the install's `mechanisms/<MechanismId>/runner/`; or the install's `core/`. Another mechanism's piece for the same discipline is out of reach.
- **A piece imports a package only as a type**, and only a package its runner lists in `piece-type-packages.json`. A value import of a package, including a `node:` module, and any dynamic import are refused. An audit piece gets TypeScript's runtime API as an argument, so it never imports `typescript` as a value; an ESLint rule gets everything it needs from ESLint's rule context.

## Embedded mechanisms

An embedded runner has the same `run` and `conform` as a standalone one, plus:

- `projectedKinds`: the native exception kinds its own projection writes. Only these kinds can be matched by a record.
- `run` also receives the repository's exception records for that mechanism, so it can regenerate the projection and compare it. It returns hits, the native exceptions it found, and the projection's state: `current`, `out-of-date`, `missing` or `not-included`. A projection that is missing or not included means the mechanism did not run: core lists `mechanism-not-run` and the check fails. An out-of-date one is a projection problem and also fails. It may also return `slices`, each a projection file other than the root one with its state, `missing`, `out-of-date`, `not-applied`, `unconfigured` or `nested-configuration`; a runner reports `nested-configuration` only beside a `not-included` projection, for a folder holding its own `disciplines.json` whose own config left the projection out of effect, and core names that folder on the `mechanism-not-run` entry; core lists each other state as a projection problem naming the file. A runner that returns none has none. It may also return `unprojectedFolders`: each `folder` whose files load a configuration the projection never reaches, such as one inside a folder holding its own `disciplines.json`, with the outermost such `selectionFolder` that holds it. The check prints nothing for them; `hone record-debt` writes no record for a file under one and prints a `nested-configuration` line instead, since that record could not take effect. A runner that returns none has none, and its type, `ReturnedEmbeddedRunReport`, leaves the field optional.
- `project`: writes the projection files and returns each path with `written`, `unchanged`, `removed` or `left-in-place`. `hone project` calls it.

Core passes every record for the mechanism to both calls, forfeited or not, and never passes the touched set. A forfeited file carve-out therefore stays in the projection; core's check reports it as `forfeited`, no longer counts it as holding any native exception, so each one it held is listed under `unrecorded`, and fails the run. Keep it that way: a runner must not compute forfeiture or read the touched set itself, so that whether a forfeited carve-out stays pushed down remains core's decision. No test checks this; it is a rule for review.

### Native channels

Writing an embedded mechanism means listing every native channel the tool has and mapping each one to an exception kind core understands (`nativeExceptionSchema` in `core/mechanism-port/embedded-run-report-schema.ts`). A native exception is accepted only when its kind is in the runner's `projectedKinds` and a record in `discipline-exceptions.json` covers it; every other native exception is reported as unrecorded and fails the run, whether or not it currently hides a finding. A standalone run can always have its `inline-disable` exceptions covered. An `inline-disable` is debt on its clause in its file, so only an `authorised-location` or `file-carve-out` on that clause and file covers it, never a `clause-wide-carve-out`; editing a carved file forfeits the carve-out as for any other file carve-out. A `command-line-option` is never covered: it changes the whole run of its script, so no record can hold it.

The ESLint runner's map. "Checked file" means a tracked `.ts`, `.tsx`, `.mts` or `.cts` file; "selected rule" means the rule id of a selected clause's ESLint piece.

| ESLint native channel | Exception kind | Can a record cover it? |
| --- | --- | --- |
| a checked file the team's configuration ignores (for example a global `ignores` block); reported for every selected clause | `ignore` | no |
| a checked file on which the team's resolved configuration leaves a selected rule below `"error"` (`"warn"`, `"off"` or not set), unless a record projects that rule off for that file | `config-override` | yes |
| an entry for a selected rule in any tracked file named `eslint-suppressions.json`, or in a file named by `--suppressions-location` in a tracked `package.json` script | `suppression-entry` | no |
| an `eslint-disable`, `eslint-disable-line` or `eslint-disable-next-line` comment naming a selected rule, or naming no rule, which escapes every selected clause and is reported once for each | `inline-disable` | yes, by a file record on its clause and file |
| an `/* eslint ... */` comment configuring a selected rule, or one that cannot be parsed | `inline-rule-config` | no |
| an option in an ESLint invocation in a tracked `package.json` script that weakens or replaces a selected rule's configuration: `--rule` or `--suppress-rule` naming it, or `--suppress-all`, `--no-config-lookup`, `--parser`, `--parser-options` or `--plugin`; `-c`/`--config` or `--ignore-pattern`, unless the script's own folder settles that it changes nothing | `command-line-option` | no |

The ESLint runner declares `projectedKinds: ["config-override", "inline-disable"]`, because a file record's projection block turns the rule off for that file whatever its comments say. A record covers a `config-override` on its own file (authorised location or file carve-out) or on every file (clause-wide carve-out), and an `inline-disable` on its own file only. The runner does not report a `config-override` on a clause and file that a record projects off, forfeited or not: while the projection is in effect it is spread last and enables every selected rule at `"error"`, so a rule below `"error"` there is the projection's own off-switch. That off-switch never counts as a native exception the record holds, so a record whose file no longer breaks its clause is `stale`.

How the runner finds each channel (`mechanisms/eslint/runner/`):

- `ignore` and `config-override` come from a query instance of ESLint on the team's own configuration (`eslint-instance.ts`): `isPathIgnored` and `calculateConfigForFile` per checked file. A configuration that fails to load is `team-config-unloadable`, whose detail names the config through ESLint's `findConfigFile` and the checked file it applies to. Before failing, `governing-config.ts` asks the config governing the broken config's folder, and each one above it up to the repository root, whether it ignores that folder and then the file. Each question is `governingConfigIgnores`: ESLint built on that one config from its folder, with a files-only override block matching the asked path, so `isPathIgnored` answers true only for a real ignore and never for a path no `files` block matches; a folder is asked through a probe file directly inside it. A yes for both makes the file `ignore`, because the team's ESLint never enters that folder. A configuration that registers a different module under a selected piece's namespace is `plugin-conflict`.
- `inline-disable` and `inline-rule-config` come from a reserved rule, `<reservedNamespace>/inline-config` (currently `hone-core/inline-config`), that runs in core's governance lint and reads each file's inline configuration comments with `@eslint/plugin-kit` (`inline-config-parser.ts`). `eslint-enable` and other directives such as `/* global */` are not reported.
- `suppression-entry` comes from `suppressions-scanner.ts`. Keys in a tracked `eslint-suppressions.json` are read relative to its folder; keys in a file named by `--suppressions-location` are read relative to the `package.json` that names it.
- `command-line-option` comes from `package-script-scanner.ts`, which parses every tracked `package.json` and splits each script into commands. A command is an ESLint invocation when a token is `eslint`, starts `eslint@`, or ends `/eslint` or `/eslint.js`. A script with an unterminated quote is `tool-failed`. `script-option-effect.ts` clears only two cases, judged on the checked files under the `package.json` folder: `-c` or `--config` naming, from that folder, the config the query instance finds for each of those files, and `--ignore-pattern` that ESLint, built from that folder on that pattern alone with a files block matching each asked file, ignores none of them with. Anything it cannot settle weakens the run: no checked file under the folder, or any token after `eslint` that the shell expands (an unquoted `*`, `?`, `[`, `]`, `{`, `}`, `~`, `$` or backtick, or a `$` or backtick in double quotes) or that holds `..`, `$` or a backtick or starts with `/`, `~` or a drive letter. An invocation that is not plain is reported with its reason instead, as the cause `wrapped` naming the first token before `eslint` that is neither a package runner (`npx`, `pnpm`, `yarn`, `npm`, `bunx`, `exec`, `--`), a literal `NAME=value` assignment, nor `cross-env` followed only by `NAME=value` assignments; or, failing that, as the cause `after-another-command` when another command comes before it in the script, carrying its whole command as the suggested script. Every other option weakens the run.

Hits come from a separate governance instance that uses only the runner's configuration: the selected rules and the inline-config rule at `"error"` on `**/*.{ts,tsx,mts,cts}`, parsed with `@typescript-eslint/parser`, with the team's configuration file, ignores, suppressions and inline configuration all off. No native channel can change core's findings.

Options passed outside a `package.json` script (a CI step, an editor setting, a wrapper script) are not found. They cannot change core's verdict, but core cannot check whether such a run honours the records.

### The ESLint projection

`projection.ts` writes `disciplines.eslint.mjs` at the repository root, and one slice of it beside each package config the team's ESLint loads (see the runner's README). It imports each piece's plugin module by a path relative to the slice's folder, then exports, in order: one block per plugin namespace enabling its selected rules at `"error"` on `**/*.{ts,tsx,mts,cts}`; one block per distinct set of clauses that authorised locations and file carve-outs except files from, listing those files (each path escaped as a glob) and turning the set's rules `"off"` for them, so the block count follows the clause combinations in use rather than the number of records; and one block per clause-wide carve-out turning them `"off"` everywhere. Block names start with `reservedNamespace` (currently `hone-core/`). The output is sorted, so the same selection and records always produce the same text.

The team spreads its default export last in its flat config; the projection is the only supported way to adopt the rules. On each check the runner first compares the file with what it would write now (`missing`, or `out-of-date` if it differs). It then checks the projection's effect through the query instance, in two directions. Every selected rule must be set, at any severity, on at least one checked file that is not ignored, when there is one. Every record whose file is checked must leave its rules at severity `0` on that file, or on every checked file for a clause-wide carve-out. If either fails, the result is `not-included` only when the root file is current and no slice file is out of date; otherwise the stale file is what is reported, with its `project` step; either way there are no hits. The second direction catches a team that enables a rule another way, for example through a config of its own that names a piece's rule, without importing the projection.

### Runtime

The ESLint mechanism runs on the repository's own toolchain, declared as optional peers: `eslint` `^9.39.5 || ^10.15.0`, and `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` `^8.73.0` (the latter for the pieces that reuse its rules). TypeScript is the parser's peer and the audit mechanism's, at `>=4.8.4 <7.0.0`. `@eslint/plugin-kit` is core's own dependency, imported directly because a transitive copy does not resolve under strict package managers. The development pins are `eslint` 10.15.0 and, as `eslint-9`, 9.39.5, with typescript-eslint 8.73.0; the integration suite runs on both lines, against the consumer repositories in `mechanisms/eslint/runner/test-fixtures/`.

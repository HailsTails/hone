# Extending Hone with your own rule set

A team can add its own disciplines beside the ones Hone ships, without forking Hone. They live in the team's repository as a **rule set**: a folder of discipline files and the pieces that check them. `hone check` loads them from the repository, runs them, reports them and applies exceptions to them the same way as Hone's own; the differences are listed under [What is stable](#what-is-stable).

This guide follows one tested example. `install-proof` installs the packed package into a small repository, stored in Hone's source repository under `tests/test-fixtures/consumer-proof/team/`, type-checks its rule set and runs `hone project` and `hone check` against it. Its rule set is `acme`, with two disciplines: `ACME-1` checked by ESLint and `ACME-2` checked by the audit mechanism. Every file sample below is a file of that repository, apart from the rule pages, the per-package ESLint config, the settings samples and the exception record, which are described rather than tested there.

Read [ADOPTING.md](../ADOPTING.md) first: this guide assumes Hone is installed and `disciplines.json` exists.

## Which mechanism

- **ESLint** for anything about code syntax. The piece is an ordinary ESLint plugin, typed with ESLint's own types, and the team's editor and lint run report it too.
- **Audit** for what ESLint cannot see: which files exist, file names, and files that are not TypeScript. An audit piece is offered every tracked file in the repository, Markdown and JSON included.

## Where the files go

```text
disciplines.json
eslint.config.mjs
disciplines.eslint.mjs
tools/disciplines/acme/
  package.json
  tsconfig.pieces.json
  rules/ACME-1/discipline.json
  rules/ACME-1/README.md
  rules/ACME-2/discipline.json
  rules/ACME-2/README.md
  mechanisms/eslint/ACME-1/piece.json
  mechanisms/eslint/ACME-1/acme.eslint-plugin.ts
  mechanisms/eslint/ACME-1/piece-settings.ts
  mechanisms/audit/ACME-2/piece.json
  mechanisms/audit/ACME-2/scratch-files.ts
```

The rule set may sit anywhere inside the repository. Hone reads `rules/<ID>/discipline.json` and `mechanisms/<mechanism>/<ID>/piece.json` under it, and loads the modules the pieces name. Everything else in the folder is yours.

## Declare the rule set

Name the folder in `disciplines.json` under `ruleSets`, then select its clauses with the rule set's name in front:

```json
{
  "version": 1,
  "ruleSets": { "acme": "tools/disciplines/acme" },
  "clauses": {
    "acme/ACME-1#console-calls": "eslint",
    "acme/ACME-2#scratch-files": "audit"
  }
}
```

- The path is relative to the repository root and must stay inside it.
- `hone` is Hone's own rule set, and its clauses can be selected beside the team's. `hone/CD-15#loops` (`loop-keyword#loop-statement`) and `CD-15#loops` are the same clause, and the report prints the short form. `loop-keyword#loop-statement` is the check's name, given for reading: today's tool neither accepts nor prints a check's name, so write and expect the clause address; check names become typeable in 2.0.
- A rule set may not be called `hone` or start with `hone-`, and no declared name may be another declared name plus `-<suffix>`.
- Discipline IDs only need to be unique inside one rule set: a team rule set may reuse an ID Hone's own rule set has, and `acme/<DisciplineId>` and `<DisciplineId>` stay two disciplines.

The report names team clauses with their rule set:

```text
findings (2)
acme/ACME-1#console-calls eslint src/start-banner.ts:1:0 console.log("web started");
acme/ACME-2#scratch-files audit notes.scratch.md:1:0 notes.scratch.md
verdict: fail
```

## Write the discipline

`rules/ACME-1/discipline.json`:

```json
{
  "version": 1,
  "id": "ACME-1",
  "clauses": [
    {
      "kind": "mechanical",
      "id": "console-calls",
      "summary": "no direct console output in source",
      "mechanisms": ["eslint"],
      "anchor": { "kind": "keyword", "keyword": "console" },
      "cases": {
        "flag": [
          { "name": "console.log", "fileName": "src/a.ts", "source": "console.log(1);\n", "expectedLines": [1] }
        ],
        "allow": [
          { "name": "no console", "fileName": "src/b.ts", "source": "export const b = 1;\n", "expectedLines": [] }
        ]
      }
    }
  ]
}
```

- `id` matches the folder name. IDs are two to four capital letters, a dash and a number, with an optional lower-case letter after it.
- Each clause lists the mechanisms that can check it. Selecting one clause adopts the whole discipline, so its other mechanical clauses must be selected too.
- `anchor` is `{ "kind": "keyword", "keyword": "..." }` or `{ "kind": "file" }`.
- `cases` say what the clause must flag and what it must leave alone. They are the clause's contract. `hone check` does not run them against a team's pieces; the team runs them in its own tests: see [Test a piece](#test-a-piece).
- A clause with `"kind": "judgement"`, a `summary` and `"enforcedBy": "review"` is applied in review and cannot be selected.
- `"exceptions": "refused"` on a clause stops any exception record from exempting it.

`rules/ACME-1/README.md` is the rule's page: why the rule exists, one example that honours it and one that breaks it. Write it for the people and agents who apply the rule, not about how the check matches. It is optional today and will be required. Hone's own rule pages follow a fixed shape, a Rule and its Spirit on `README.md` with the mechanics in a sibling `CHECKS.md`; [adding a discipline](adding-a-discipline-or-mechanism.md#1a-the-rule-pages) describes it.

## An ESLint piece

`mechanisms/eslint/ACME-1/piece.json`:

```json
{
  "version": 1,
  "discipline": "ACME-1",
  "mechanism": "eslint",
  "clauses": [
    {
      "clause": "console-calls",
      "settings": { "pluginNamespace": "acme", "pluginModule": "acme.eslint-plugin.ts", "rule": "no-console-calls" }
    }
  ]
}
```

`mechanisms/eslint/ACME-1/acme.eslint-plugin.ts`:

```ts
import type { ESLint, Rule } from "eslint";

export const noConsoleCalls: Rule.RuleModule = {
  meta: {
    type: "problem",
    schema: [],
    messages: { console: "Write through the logger port, not console." },
  },
  create: (context) => ({
    "MemberExpression[object.name='console']": (node: Rule.Node) => {
      context.report({ node, messageId: "console" });
    },
  }),
};

const plugin: ESLint.Plugin = { rules: { "no-console-calls": noConsoleCalls } };

export default plugin;
```

- `pluginModule` is a path inside the piece folder. Its default export is the plugin, and `rule` is a key of its `rules`.
- `pluginNamespace` must be the rule set's name or start with it and a dash: `acme` or `acme-console`. `hone`, `hone-*` and `hone-core` belong to Hone.
- `options`, optional, is the rule's options array, passed to ESLint as written.

Then run `hone project`. It writes `disciplines.eslint.mjs`, which imports the plugin by a path relative to the repository root:

```js
import piece0 from "./tools/disciplines/acme/mechanisms/eslint/ACME-1/acme.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/acme",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "acme": piece0 },
    rules: { "acme/no-console-calls": "error" },
  },
];
```

Every `eslint.config.*` that applies to checked files spreads the projection last. The projection sets rules only, so the config also sets the typescript-eslint parser, as [ADOPTING.md](../ADOPTING.md#4a-set-up-eslint-for-eslint-checks) step 4a explains. The example's `eslint.config.mjs`:

```js
import typescriptParser from "@typescript-eslint/parser";
import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"], languageOptions: { parser: typescriptParser } },
  ...projection,
];
```

In a monorepo each package's own config does the same, importing the projection by its relative path, such as `../../disciplines.eslint.mjs`. A package config that leaves the projection out fails the check, listing each of its files under `unrecorded` as `acme/ACME-1#console-calls eslint config-override <file>`. [ADOPTING.md](../ADOPTING.md#4a-set-up-eslint-for-eslint-checks) step 4a says which config ESLint applies to a file and how to state it in `disciplines.json` when detection cannot tell.

## An audit piece

`mechanisms/audit/ACME-2/piece.json`:

```json
{
  "version": 1,
  "discipline": "ACME-2",
  "mechanism": "audit",
  "clauses": [
    {
      "clause": "scratch-files",
      "settings": { "module": "scratch-files.ts" },
      "editions": ["1", "2"]
    }
  ]
}
```

`mechanisms/audit/ACME-2/scratch-files.ts`:

```ts
import { editionReaches, isEdition, type PieceHit, type RunnerClause, type WalkerPiece } from "@hailstails/hone/audit";

const SCRATCH_MARKER = ".scratch.";
const DRAFT_MARKER = ".draft.";
const DRAFT_EDITION = "2";

const markersOf = (request: { readonly clause: RunnerClause }): readonly string[] =>
  isEdition(DRAFT_EDITION) && editionReaches({ edition: request.clause.edition, introducedIn: DRAFT_EDITION }) === "reached"
    ? [SCRATCH_MARKER, DRAFT_MARKER]
    : [SCRATCH_MARKER];

const scratchHits = (request: { readonly clauses: readonly RunnerClause[]; readonly file: string }): readonly PieceHit[] =>
  request.clauses
    .filter((clause) => markersOf({ clause }).some((marker) => request.file.includes(marker)))
    .map((clause) => ({ clause: clause.address, anchor: { line: 1, column: 0 }, snippet: request.file }));

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => ({ outcome: "ok", value: { kind: "complete", hits: scratchHits({ clauses, file }) } }),
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
```

- `module` is a path inside the piece folder, and the module exports `check`.
- `prepare` runs once with the selected clauses, the repository's file list and TypeScript's syntax API. The repository also carries a `disk`, a required field: its `root`, the kind of entry at an absolute path (`kindAt`) and a file's text (`textAt`), for a piece that must read files beyond the one it is given, untracked ones included. In a conformance case the disk holds only the case's file. A piece's own tests that build a `WalkerRepository` by hand must now give it a `disk` (the type is `WalkerDisk` from `@hailstails/hone/audit`), as the example's proof does. Such tests written before the field was added no longer type-check until they give it one. `prepareFile` runs once per tracked file and returns `skipped`, `complete` with its hits, or `syntax` with observers that walk the file's syntax tree. `finish` returns hits that need the whole repository.
- `prepareFile` answers `skipped` for a file the piece does not judge. Any other answer, `complete` with no hits included, says the piece's clauses were measured on that file: the runner reports each as a `measured` pair, and `hone prune-debt` removes a stale or forfeited `file-carve-out` on that clause and file. The example answers `complete` for every file because it judges every file by its name; a piece that judges only TypeScript sources answers `skipped` for a `.md` or `.js` file.
- A hit passes back the clause's `address` unchanged, a 1-based line and 0-based column, and a short snippet.
- A hit may also give a `remedy` (the type is `Remedy` from `@hailstails/hone/audit`): a `fix` naming what to write instead of the form it flagged, the `page` that shows it as a path inside the rule's folder (`rules/<ID>/`), such as `CHECKS.md` or `README.md`, and the `section` of that page, as lowercase letters, digits and hyphens. Core resolves the page to the path a reader opens, as it does for the rule page under `readFirst`, and the finding then ends with ` fix: <fix> (<fix page>#<section>)`.
- When the piece cannot run, for example on settings it does not accept, return a failed result whose error is a `PieceFailure`: `kind` `piece-invalid`, the clause's `pieceRoot` and a `detail`. `hone check` then stops with a load failure naming the piece folder.
- When the piece cannot parse a file, return a failed result whose error is `kind` `file-unparseable`, the `file` and a `detail`. `hone check` then stops with `load failure: runner-failed audit file-unparseable <file> <detail>`.
- To read JSON with comments, such as a `tsconfig.json`, call TypeScript's own parser on the syntax API: `syntaxApi.parseConfigFileTextToJson(file, text)` returns the parsed value as `config` and sets `error` when it cannot parse the text. A piece does not import a JSON parser of its own; see [What is stable](#what-is-stable).

### Settings a repository can change

The example's marker is fixed. To let a repository change it, a clause entry in `piece.json` declares `clauseSettings`: each key with its `default`, and optionally `choices`, a list of the values allowed. For a `marker` setting with default `".scratch."`, the clause entry would read:

```json
{
  "clause": "scratch-files",
  "settings": { "module": "scratch-files.ts" },
  "clauseSettings": { "marker": { "default": ".scratch." } }
}
```

A repository that selects the clause can then override it in `disciplines.json`, keyed by the clause's address:

```json
"clauseSettings": {
  "acme/ACME-2#scratch-files": { "marker": ".scratch.md" }
}
```

Hone refuses a value under an undeclared key, of another JSON kind than the default, or outside the `choices`, before any piece runs. The piece reads the value, the override or else the default, from `clause.clauseSettings` on each `RunnerClause`, in place of the fixed `SCRATCH_MARKER`. The value is typed as any JSON value, so the piece narrows it, for example with `typeof marker === "string"`, and returns a `piece-invalid` failure when it is not what it accepts. Name the settings on the discipline's page under a Settings heading. This section is described, not run by the example: Hone's unit tests cover reading, refusing and overriding settings.

### Editions of a check

When a clause's check becomes stricter, ship the stricter check as a new edition instead of changing what the clause flags. A clause entry in `piece.json` lists its `editions` in ascending order: the first is the default, and the last is the latest. The example's piece lists `["1", "2"]`: edition 2 also flags files named with `.draft.`. An entry without `editions` has the single edition `"1"`. The setting key `edition` is reserved for the edition a repository pins, so a piece cannot declare it under `clauseSettings`.

The piece reads the edition that runs from `clause.edition` on each `RunnerClause`. `@hailstails/hone/audit` exports two helpers. `isEdition` narrows a text such as `"2"` to an `Edition` without a cast. `editionReaches({ edition: clause.edition, introducedIn })` says whether the running edition covers something introduced in a given edition. The example piece uses both, and a piece's tests use `isEdition` the same way to build a `RunnerClause` for each edition.

A case in `discipline.json` names the edition it runs under with `"edition": "2"`. A case without one runs under the piece's default edition. A case naming an edition the piece does not declare makes the rule set invalid. Conformance runs each edition's cases under that edition, and `clauseUnderTestOf` gives each case its `edition`. The example's `rules/ACME-2/discipline.json` flags `src/notes.draft.ts` under edition 2 and allows it under edition 1:

```json
{ "name": "draft file", "fileName": "src/notes.draft.ts", "source": "export const notes = 1;\n", "expectedLines": [1], "edition": "2" }
```

A repository that selects the clause runs edition 1 until it sets `"checkEditions": "latest"` or pins the clause with `"edition": "2"` in its `clauseSettings`. Its report lists the edition that ran under `editions`, such as `acme/ACME-2#scratch-files audit edition 1 of 2`.

## TypeScript pieces under Node

Hone loads piece modules with Node, which strips the types from a `.ts` file as it loads it. Node 22.18 or later does this without flags.

- A piece module ends in `.ts` or `.js`. `.mts` and `.mjs` are refused.
- Node decides whether a `.ts` file is an ES module from the nearest `package.json`:
  - `"type": "module"`: it loads, silently.
  - No `"type"` field: it still loads, because Node sees the `export` syntax, but every run prints a `[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///… is not specified` block per piece module before the report.
  - `"type": "commonjs"`: it fails to load, with the `Failed to load the ES module` warning and load failure shown under [Common refusals](#common-refusals).

  The example repository says `"type": "commonjs"` at its root, the hard case, so its rule set has its own `package.json`:

  ```json
  {
    "private": true,
    "type": "module"
  }
  ```

  These three behaviours were checked by hand on Node 22.22.2; `install-proof` checks the first on every Node it runs.
- Use only syntax Node can erase, spell the `.ts` extension in relative imports, and use `import type` for types. [ADOPTING.md](../ADOPTING.md#1-check-the-prerequisites) step 1 lists the limits.
- Node does not strip types under `node_modules`. A rule set kept in an installed package is named by its repository path, for example `"acme": "node_modules/@acme/disciplines"`, and must ship `.js` piece modules; a `.ts` one fails with `Stripping types is currently unsupported for files under node_modules`.

## Type-check the rule set

`@hailstails/hone/rule-set` holds types only. `@hailstails/hone/audit` holds the walker piece types and three values: `folderScope`, `isEdition` and `editionReaches`. Import types with `import type`. A `tsconfig` for the rule set that matches how Node runs it, `tools/disciplines/acme/tsconfig.pieces.json`:

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "skipLibCheck": false,
    "types": []
  },
  "include": ["**/*.ts"]
}
```

Run it with the repository's own compiler, for example `tsc --noEmit -p tools/disciplines/acme/tsconfig.pieces.json`. `erasableSyntaxOnly` needs TypeScript 5.8 or later; leave it out on older versions.

The ESLint piece's `settings` can be checked against `EslintPieceSettings` from the JSON file itself. `mechanisms/eslint/ACME-1/piece-settings.ts`:

```ts
import type { EslintPieceSettings } from "@hailstails/hone/rule-set";
import piece from "./piece.json" with { type: "json" };

type Settled<Settings extends EslintPieceSettings> = Settings;

export type PieceSettings = Settled<(typeof piece)["clauses"][number]["settings"]>;
```

A wrong field then fails the type check, for example `Type 'number' is not assignable to type 'string'` for a numeric `rule`; `install-proof` checks this on TypeScript 4.8.4 and 6.0.3 with the same `Settled` type over settings typed as a JSON file types them. TypeScript reads string values in a JSON file as `string`, so this works for `settings` but not for `discipline.json` or the rest of `piece.json`, whose types name exact values such as `"mechanical"`. Hone checks those files when it reads them.

## Test a piece

Test an ESLint rule with ESLint's own `RuleTester`, importing the rule the plugin exports, such as `noConsoleCalls`, and giving it the clause's `flag` cases as `invalid` and its `allow` cases as `valid`. Run on its own with `node`, `RuleTester` prints nothing when the cases hold and throws on the first that does not; under a test runner that defines `describe` and `it`, it reports each case as a test.

Test an audit piece with `@hailstails/hone/testing`. `clauseConformanceOf` loads the installed audit runner, binds the clause from the rule set as `hone check` binds it, and runs every `flag` and `allow` case through the piece:

```ts
import { clauseConformanceOf } from "@hailstails/hone/testing";

const conformance = await clauseConformanceOf({ ruleSetRoot: "tools/disciplines/acme", clause: "acme/ACME-2#scratch-files" });
```

A relative `ruleSetRoot` is read from the working directory. `{ outcome: "ok", value: [] }` means the piece met every case. Each entry in a longer list names a case, the lines it expects and the lines the piece flagged. `{ outcome: "failed", error: { kind, detail } }` means the cases could not run, for example `rule-set-unloadable` for a clause the audit mechanism may not check.

Checks of your own call the piece directly. `clauseUnderTestOf` returns the same bound clause and each case's `name`, `file`, `source` and `edition`, ready for `check.prepare` and `prepareFile`; `repoPathOf` makes the `RepoPath` for any other file, such as one whose `readText` fails with `file-unreadable`. `folderScope` from `@hailstails/hone/audit` tells a piece whether a file sits in a generated folder. Hone does not run these tests; the team runs them with its own test runner.

## Exceptions

Exception records in `discipline-exceptions.json` name team clauses by their full address and work exactly as for Hone's own clauses. This entry records the console calls already in `src/start-banner.ts` as debt: it moves the finding to `exempted` and, after `hone project`, turns the rule off for that file in the team's own ESLint run, until the file is next touched and the record is forfeited:

```json
{
  "kind": "file-carve-out",
  "clause": "acme/ACME-1#console-calls",
  "file": "src/start-banner.ts"
}
```

A `file-carve-out` is debt and needs no `whyChain` and no `reason`. Where the clause does not apply to a file at all, record an `authorised-location` instead: it is never forfeited, so it needs a `reason` and a `whyChain` that follows the [why-chain contract](why-chain-contract.md), and without the chain it is refused as `evidence-refused`. [README.md](../README.md#hone-records) describes the record kinds and what each needs.

## What is stable

Two requirements are decided and not yet built. Each will make some rule sets that pass today fail:

- **A rule page is required.** A selected team discipline without `rules/<ID>/README.md` will fail to load.
- **Pieces keep to import boundaries.** A team piece will be refused if it imports from anywhere but its own piece folder, its discipline's `rules/<ID>` folder, `@hailstails/hone/rule-set`, `@hailstails/hone/audit` and its mechanism's toolchain package (`eslint` or `typescript`), with values only from its own piece folder and `folderScope`, `isEdition` and `editionReaches` from `@hailstails/hone/audit`. The rule is about a piece's run-time code: a piece's own tests may also import `@hailstails/hone/testing`.

To be ready now: write each discipline's `README.md`, and import nothing from Hone in a piece but types from `@hailstails/hone/rule-set` and `@hailstails/hone/audit`, and `folderScope`, `isEdition` and `editionReaches`.

| Part | Status |
| --- | --- |
| `ruleSets`, the address `[<ruleSet>/]<ID>#<clause>`, `hone` reserved | Stable |
| The folder layout `rules/<ID>/` and `mechanisms/<mechanism>/<ID>/` | Stable, with `rules/<ID>/README.md` becoming required |
| `discipline.json` and `piece.json` version 1, and the ESLint piece `settings` with the namespace rule | Stable file formats |
| `@hailstails/hone/rule-set` | Stable |
| Exception records for team clauses | Stable |
| `@hailstails/hone/audit` and the walker piece contract | Experimental: may change in a minor release |
| `@hailstails/hone/testing` | Experimental: may change in a minor release |
| A rule set named by a package name, such as `"acme": "@acme/disciplines"` | Not supported: name its repository path instead, as under [TypeScript pieces under Node](#typescript-pieces-under-node) |
| A new mechanism from outside Hone | Not supported |

## Common refusals

| Output | Cause |
| --- | --- |
| `load failure: reserved-rule-set-name hone` | A rule set is declared as `hone`. Pick the team's own name. |
| `load failure: unknown-rule-set beta` | A clause names a rule set that `ruleSets` does not declare. |
| `load failure: runner-failed eslint piece-invalid <piece folder> the plugin namespace hone belongs to Hone; the rule set acme must use acme or acme-<name>` | The ESLint piece uses one of Hone's namespaces. |
| `load failure: runner-failed eslint piece-invalid <piece folder> the plugin namespace lint is not owned by the rule set acme; use acme or acme-<name>` | The namespace does not start with the rule set's name. |
| `load failure: runner-failed eslint piece-invalid <piece folder> ✖ not a path inside the piece folder ending in .ts, or .js in a built install\n  → at pluginModule` | The ESLint piece's `pluginModule` is outside the piece folder or ends in neither `.ts` nor `.js`. The `\n` is printed as written, not as a line break. |
| `load failure: runner-failed audit piece-invalid <piece folder> [\n  {\n    "code": "custom",\n    "path": [\n      "module"\n    ],\n    "message": "the module is not a path inside the piece folder ending .ts, or .js in a built install"\n  }\n]` | The audit piece's `module` is outside the piece folder or ends in neither `.ts` nor `.js`. The whole message is one line, each `\n` printed as written. |
| `(node:<pid>) Warning: Failed to load the ES module: <piece module>. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.` and ``(Use `node --trace-warnings ...` to show where the warning was created)``, then `load failure: runner-failed eslint piece-invalid <piece folder> Unexpected token 'export'` | The nearest `package.json` says `"type": "commonjs"`, so Node read the `.ts` piece as CommonJS. Node prints its warning for each `.ts` piece module it tried; the load failure names one mechanism whose piece failed. Give the rule set a `package.json` with `"type": "module"`. |
| `<clause> eslint config-override <file>` under `unrecorded` | An `eslint.config.*` that applies to the file does not spread the projection. |

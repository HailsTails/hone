import { afterAll, assert, describe, expect, it, vi } from "vitest";
import { createDefaultScratchFilesPort } from "../../../../../../delivery/install-proof/install-proof-ports.ts";
import { withSingleFileRecords, } from "../../../../../../tests/records-disk.ts";
import { NO_TEXT_FILES, restoredFixtureRepositoriesOver, type TextFiles } from "../../../../../../tests/restored-fixture-repository.ts";
import { scratchRepositoriesUnder } from "../../../../../../tests/scratch-repositories.ts";
import { runCheck } from "../../../../../application/run/check/run-check.ts";
import { loadRunner } from "../../../protocol/engine-run/load-runner.ts";
import { checkConformance } from "../../../protocol/conformance.ts";
import type { ExceptionRecord } from "../../../../discipline-exceptions-folder/exception-records.ts";
import type { LoadedRunner, RunnerClause } from "../../../protocol/runner-module/runner-module-schema.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { GitPort } from "../../../../git/git-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { type ClauseDefinition, readDisciplineFile } from "../../../../content-files/rule-sets/rule-set-reader.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../../../hone-config-file/assessment.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema, mechanismIdSchema } from "../../../../hone-config-file/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { VERSION_ONE_CAUSAL_WHY_CHAIN } from "../../../../../../tests/version-one-causal-why-chain.ts";
import { overlaidFileText } from "../../../../../../tests/overlaid-file-text.ts";
import { runner as walkerRunner } from "../../../audit/runner/runner.ts";
import { createEslintRunner } from "../embedded-runner/create-eslint-runner.ts";
import {
  ESLINT_LINES,
  type EslintLine,
  eslintClassOn,
  eslintPortOn,
  eslintRunnerOn,
  pieceModulesOn,
  runnerModulesOn,
} from "../../../../../../tests/eslint-toolchains.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/CD-14`,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { pluginNamespace: "hone", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const WALKER_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/audit/CD-14`,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "class-syntax.ts" },
};

const fileText = createDefaultFileTextPort({});

const modules = createDefaultModuleLoaderPort({});

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const repositories = scratchRepositoriesUnder({ parent: `${INSTALL_ROOT}/artefacts`, fileText, scratch });

const restoredFixtures = restoredFixtureRepositoriesOver({ repositories, scratch, fileText, path });

afterAll(() => {
  repositories.removeAll();
});

const consumerRepoWithText = (request: { readonly name: string; readonly textFiles: TextFiles }): AbsolutePath =>
  restoredFixtures.restoredFrom({ fixtureRoot: absolutePathSchema.parse(`${import.meta.dirname}/${request.name}`), textFiles: request.textFiles });

const consumerRepo = (request: { readonly name: string }): AbsolutePath => consumerRepoWithText({ name: request.name, textFiles: NO_TEXT_FILES });

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const checkOver = (request: { readonly repoRoot: AbsolutePath; readonly tracked: readonly RepoPath[]; readonly line: EslintLine }) =>
  runCheck(withSingleFileRecords({
    repoRoot: request.repoRoot,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    assessment: DEFAULT_ASSESSMENT,
    fileText,
    modules: runnerModulesOn({ line: request.line, base: modules }),
    path,
    git: gitTracking({ tracked: request.tracked }),
  }));

const checkOf = (request: { readonly name: string; readonly tracked: readonly RepoPath[]; readonly line: EslintLine }) =>
  checkOver({ repoRoot: consumerRepo({ name: request.name }), tracked: request.tracked, line: request.line });

const classFinding = (request: { readonly file: string; readonly line: number }) => ({
  clause: CLASS_SYNTAX,
  file: request.file,
  anchor: { line: request.line, column: 7 },
  snippet: "export class Kept {}",
  mechanism: "eslint",
});

const NOT_RUN_NOT_INCLUDED = { kind: "mechanism-not-run", mechanism: "eslint", projection: "not-included", nestedConfigurations: [] };

describe.each(ESLINT_LINES)("real %s config resolution behind the ESLint runner's query instance, over a consumer repository", (line) => {
  it("reports an unrecorded override block placed after the projection as a config-override", async () => {
    await expect(checkOf({ name: "override-after", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unrecorded: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts", mechanism: "eslint" }],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("reports an unrecorded global ignore over a file holding a class, and core still finds the class", async () => {
    await expect(checkOf({ name: "global-ignore", tracked: [repoPathSchema.parse("gen/g.ts"), repoPathSchema.parse("src/clean.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "gen/g.ts", line: 1 })],
        unrecorded: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "gen/g.ts", mechanism: "eslint" }],
        unmeasured: [],
      },
    });
  });

  it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
    await expect(checkOf({ name: "severity-zero", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unrecorded: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts", mechanism: "eslint" }],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("lists mechanism-not-run not-included when a later team block sets a recorded file back to error", async () => {
    await expect(checkOf({ name: "re-enabled-record", tracked: [repoPathSchema.parse("src/owned.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

describe.each(ESLINT_LINES)("eslint-suppressions.json files and package.json lint scripts read by the ESLint runner on %s, over a consumer repository", (line) => {
  it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
    await expect(
      checkOf({ name: "suppression-default", tracked: [repoPathSchema.parse("supp/a.ts"), repoPathSchema.parse("eslint-suppressions.json")], line }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "supp/a.ts", line: 1 })],
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/a.ts",
            location: "eslint-suppressions.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports entries in suppressions files a package.json script names in space and equals form, a dormant one included", async () => {
    await expect(
      checkOf({
        line,
        name: "suppression-scripted",
        tracked: [
          repoPathSchema.parse("supp/b.ts"),
          repoPathSchema.parse("supp/clean.ts"),
          repoPathSchema.parse("package.json"),
          repoPathSchema.parse("custom/supp.json"),
          repoPathSchema.parse("custom/supp2.json"),
        ],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "supp/b.ts", line: 1 })],
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/b.ts",
            location: "custom/supp.json",
            mechanism: "eslint",
          },
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/clean.ts",
            location: "custom/supp2.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports an entry in a nested tracked eslint-suppressions.json against its own directory", async () => {
    await expect(
      checkOf({
        line,
        name: "suppression-nested",
        tracked: [repoPathSchema.parse("packages/a/src/n.ts"), repoPathSchema.parse("packages/a/eslint-suppressions.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "packages/a/src/n.ts",
            location: "packages/a/eslint-suppressions.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports each command-line option that weakens the run, and neither one that changes nothing ESLint already does nor a rule id that merely extends the selected one", async () => {
    await expect(
      checkOf({
        line,
        name: "command-line-options",
        tracked: [repoPathSchema.parse("src/plain.ts"), repoPathSchema.parse("package.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [],
        unrecorded: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "--rule hone/no-class-authoring: off",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "-c alt.config.mjs",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-all",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-rule hone/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:hidden",
            option: "--ignore-pattern src/**",
            mechanism: "eslint",
          },
        ],
      },
    });
  });
});

const INLINE_FORM_FILES: readonly RepoPath[] = [
  repoPathSchema.parse("i/disable-file.ts"),
  repoPathSchema.parse("i/disable-file-named.ts"),
  repoPathSchema.parse("i/disable-line.ts"),
  repoPathSchema.parse("i/disable-next-line.ts"),
  repoPathSchema.parse("i/rule-config.ts"),
  repoPathSchema.parse("i/other-rule.ts"),
  repoPathSchema.parse("i/enable.ts"),
  repoPathSchema.parse("i/global.ts"),
];

const INLINE_FORM_TEXTS: TextFiles = {
  "i/disable-file-named.ts": "/* eslint-disable hone/no-class-authoring */\nexport class Kept {}\n",
  "i/disable-line.ts": "export const plain = 1;\nexport class Kept {} // eslint-disable-line hone/no-class-authoring\n",
  "i/disable-next-line.ts": "// eslint-disable-next-line hone/no-class-authoring\nexport class Kept {}\n",
  "i/rule-config.ts": '/* eslint hone/no-class-authoring: "off" */\nexport class Kept {}\n',
};

const inlineFormsCheckOf = (request: { readonly line: EslintLine }) =>
  checkOver({ repoRoot: consumerRepoWithText({ name: "inline-forms", textFiles: INLINE_FORM_TEXTS }), tracked: INLINE_FORM_FILES, line: request.line });

describe.each(ESLINT_LINES)("inline configuration comments read by the ESLint runner's governance rule on real %s, over a consumer repository", (line) => {
  it("reports each disable and rule-config form naming the selected rule and none of the rest", async () => {
    await expect(inlineFormsCheckOf({ line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        unrecorded: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file.ts",
            line: 1,
            text: "/* eslint-disable */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file-named.ts",
            line: 1,
            text: "/* eslint-disable hone/no-class-authoring */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            line: 2,
            text: "// eslint-disable-line hone/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-next-line.ts",
            line: 1,
            text: "// eslint-disable-next-line hone/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX,
            file: "i/rule-config.ts",
            line: 1,
            text: '/* eslint hone/no-class-authoring: "off" */',
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("still finds the class in every file whatever its inline comment says", async () => {
    await expect(inlineFormsCheckOf({ line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [
          classFinding({ file: "i/disable-file.ts", line: 2 }),
          classFinding({ file: "i/disable-file-named.ts", line: 2 }),
          {
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            anchor: { line: 2, column: 7 },
            snippet: "export class Kept {} // eslint-disable-line hone/no-class-authoring",
            mechanism: "eslint",
          },
          classFinding({ file: "i/disable-next-line.ts", line: 2 }),
          classFinding({ file: "i/rule-config.ts", line: 2 }),
          classFinding({ file: "i/other-rule.ts", line: 2 }),
          classFinding({ file: "i/enable.ts", line: 2 }),
          classFinding({ file: "i/global.ts", line: 2 }),
        ],
      },
    });
  });
});

describe.each(ESLINT_LINES)("real %s glob matching of the generated projection's record blocks, over a consumer repository", (line) => {
  it("exempts route/[id].ts by its authorised location and still finds the class in route/i.ts", async () => {
    await expect(
      checkOf({ name: "route-brackets", tracked: [repoPathSchema.parse("route/[id].ts"), repoPathSchema.parse("route/i.ts")], line }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "route/i.ts", line: 1 })],
        exempted: [
          {
            finding: classFinding({ file: "route/[id].ts", line: 1 }),
            by: [{ kind: "authorised-location", file: "route/[id].ts" }],
          },
        ],
        unrecorded: [],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });
});

describe.each(ESLINT_LINES)("the ESLint runner's projection states under real %s, over a consumer repository", (line) => {
  it("lists mechanism-not-run missing when the projection was never generated", async () => {
    await expect(checkOf({ name: "projection-missing", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unmeasured: [{ kind: "mechanism-not-run", mechanism: "eslint", projection: "missing" }] },
    });
  });

  it("lists the projection out-of-date when it was hand-edited", async () => {
    await expect(checkOf({ name: "projection-hand-edited", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unmeasured: [],
        projectionProblems: [{ mechanism: "eslint", state: "out-of-date" }],
      },
    });
  });

  it("lists mechanism-not-run not-included when the team config does not import the projection", async () => {
    await expect(checkOf({ name: "projection-not-imported", tracked: [repoPathSchema.parse("x.ts")], line })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });

  it("lists mechanism-not-run not-included when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
    await expect(
      checkOf({
        line,
        name: "fragment-not-projection",
        tracked: [repoPathSchema.parse("src/owned.ts"), repoPathSchema.parse("src/clean.ts")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

const SHARED_CASE_FILES: readonly RepoPath[] = [
  repoPathSchema.parse("src/decl.ts"),
  repoPathSchema.parse("src/expr.ts"),
  repoPathSchema.parse("src/default.ts"),
  repoPathSchema.parse("src/abstract.ts"),
  repoPathSchema.parse("src/nested.ts"),
  repoPathSchema.parse("src/space.ts"),
  repoPathSchema.parse("src/anon.ts"),
];

const SHARED_CASES_RUN = {
  repoRoot: consumerRepo({ name: "fr3-anchors" }),
  installRoot: INSTALL_ROOT,
  declaredConfigRoots: [],
  files: SHARED_CASE_FILES,
  trackedPaths: SHARED_CASE_FILES,
};

const EXPECTED_SHARED_HITS = [
  { clause: CLASS_SYNTAX, file: "src/decl.ts", anchor: { line: 1, column: 7 }, snippet: "export class Alpha {}" },
  { clause: CLASS_SYNTAX, file: "src/expr.ts", anchor: { line: 1, column: 20 }, snippet: "export const Beta = class {};" },
  { clause: CLASS_SYNTAX, file: "src/default.ts", anchor: { line: 2, column: 0 }, snippet: "class {}" },
  {
    clause: CLASS_SYNTAX,
    file: "src/abstract.ts",
    anchor: { line: 1, column: 16 },
    snippet: "export abstract class Gamma {}",
  },
  { clause: CLASS_SYNTAX, file: "src/nested.ts", anchor: { line: 2, column: 2 }, snippet: "class Delta {}" },
  { clause: CLASS_SYNTAX, file: "src/space.ts", anchor: { line: 2, column: 9 }, snippet: "export class Epsilon {}" },
  {
    clause: CLASS_SYNTAX,
    file: "src/anon.ts",
    anchor: { line: 1, column: 25 },
    snippet: "export const zeta = new (class {})();",
  },
];

const CLASS_SYNTAX_MEASURED_ON_SHARED_CASES = [
  { clause: CLASS_SYNTAX, file: "src/decl.ts" },
  { clause: CLASS_SYNTAX, file: "src/expr.ts" },
  { clause: CLASS_SYNTAX, file: "src/default.ts" },
  { clause: CLASS_SYNTAX, file: "src/abstract.ts" },
  { clause: CLASS_SYNTAX, file: "src/nested.ts" },
  { clause: CLASS_SYNTAX, file: "src/space.ts" },
  { clause: CLASS_SYNTAX, file: "src/anon.ts" },
];

describe.each(ESLINT_LINES)("FR-3 over real files: the ESLint runner on real %s and the audit runner on real TypeScript", (line) => {
  it("give the same whole anchors for every flagged CD-14 shared case", async () => {
    const eslintRun = await eslintRunnerOn({ line }).run({ ...SHARED_CASES_RUN, records: [], clauses: [ESLINT_CLAUSE] });
    const walkerRun = await walkerRunner.run({ ...SHARED_CASES_RUN, clauses: [WALKER_CLAUSE] });
    expect({ eslint: eslintRun, audit: walkerRun }).toEqual({
      eslint: {
        outcome: "ok",
        value: { hits: EXPECTED_SHARED_HITS, nativeExceptions: [], projection: "current", slices: [], unprojectedFolders: [], measured: CLASS_SYNTAX_MEASURED_ON_SHARED_CASES },
      },
      audit: { outcome: "ok", value: { hits: EXPECTED_SHARED_HITS, nativeExceptions: [], measured: CLASS_SYNTAX_MEASURED_ON_SHARED_CASES } },
    });
  });
});

type MechanicalCases = Extract<ClauseDefinition, { readonly kind: "mechanical" }>["cases"];

const classSyntaxCases = (): MechanicalCases => {
  const loaded = readDisciplineFile({ fileText, path, ruleSetRoot: INSTALL_ROOT, discipline: disciplineIdSchema.parse("CD-14") });
  assert(loaded.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
  const [classSyntax, libraryConstruction, staticOnlyClass, ...surplus] = loaded.value.clauses;
  assert.isDefined(classSyntax, "CD-14 declares a first clause");
  assert.isDefined(libraryConstruction, "CD-14 declares a second clause");
  assert.isDefined(staticOnlyClass, "CD-14 declares a third clause");
  assert.strictEqual(classSyntax.id, "class-syntax", "CD-14 declares class-syntax as its first clause");
  assert.strictEqual(libraryConstruction.id, "library-construction", "CD-14 declares the library-construction judgement clause second");
  assert.strictEqual(staticOnlyClass.id, "static-only-class", "CD-14 declares the static-only-class clause third");
  assert.isEmpty(surplus, "CD-14 declares exactly three clauses");
  assert(classSyntax.kind === "mechanical", "CD-14 declares class-syntax as a mechanical clause");
  return classSyntax.cases;
};

const CLASS_SYNTAX_CASES = classSyntaxCases();

const coreLoadedEslintRunner = async (request: { readonly line: EslintLine }): Promise<LoadedRunner> => {
  const loaded = await loadRunner({
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    modules: runnerModulesOn({ line: request.line, base: modules }),
    path,
    mechanism: mechanismIdSchema.parse("eslint"),
  });
  assert(loaded.outcome === "ok", "core loads the ESLint runner module");
  return loaded.value;
};

describe.each(ESLINT_LINES)("checkConformance over the ESLint runner as core loads it, on real %s", (line) => {
  it("has no failures for CD-14#class-syntax over every CD-14 shared case", async () => {
    await expect(
      checkConformance({
        clause: ESLINT_CLAUSE,
        cases: [...CLASS_SYNTAX_CASES.flag, ...CLASS_SYNTAX_CASES.allow],
        runner: await coreLoadedEslintRunner({ line }),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});

const ESLINT_PACKAGE_JSON = "node_modules/eslint/package.json";

const LINT_SCRIPT_PACKAGE_JSON = "package.json";

const eslintVersion = (request: { readonly version: string }): string => JSON.stringify({ name: "eslint", version: request.version });

const lintScript = (request: { readonly command: string }): string => JSON.stringify({ scripts: { lint: request.command } });

const monorepoRun = async (request: {
  readonly line: EslintLine;
  readonly name: string;
  readonly version: string;
  readonly lintCommand: string;
  readonly records: readonly ExceptionRecord[];
}) =>
  createEslintRunner({
    fileText: overlaidFileText({
      base: fileText,
      files: {
        [`${consumerRepo({ name: request.name })}/${ESLINT_PACKAGE_JSON}`]: eslintVersion({ version: request.version }),
        [`${consumerRepo({ name: request.name })}/${LINT_SCRIPT_PACKAGE_JSON}`]: lintScript({ command: request.lintCommand }),
      },
    }),
    fileRemoval: createDefaultFileRemovalPort({}),
    modules: pieceModulesOn({ line: request.line, base: modules }),
    path,
    eslint: await eslintPortOn({ line: request.line }),
    moduleExtension: ".ts",
  }).run({
    repoRoot: consumerRepo({ name: request.name }),
    installRoot: INSTALL_ROOT,
    declaredConfigRoots: [],
    files: [repoPathSchema.parse("packages/a/x.ts")],
    trackedPaths: [
      repoPathSchema.parse("packages/a/x.ts"),
      repoPathSchema.parse("package.json"),
      repoPathSchema.parse("packages/a/eslint.config.mjs"),
    ],
    clauses: [ESLINT_CLAUSE],
    records: request.records,
  });

const PACKAGE_HIT = { file: "packages/a/x.ts" };

const PACKAGE_LEGACY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLAUSE,
  mechanism: mechanismIdSchema.parse("eslint"),
  file: repoPathSchema.parse("packages/a/legacy.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const PACKAGE_CONFIG_REPO = { name: "monorepo-package-config", records: [PACKAGE_LEGACY_CARVE_OUT] };

const ROOT_CONFIG_REPO = { name: "monorepo-root-config", records: [] };

const NEAREST_LOOKUP_FLAG = "--flag v10_config_lookup_from_file";

const NEAREST_LOOKUP_TEAMS = [
  { version: "10.11.0", lintCommand: "eslint ." },
  { version: "9.39.5", lintCommand: `eslint ${NEAREST_LOOKUP_FLAG} .` },
];

describe.each(ESLINT_LINES)("the ESLint runner on %s follows the config lookup the team's own ESLint run uses, over a monorepo with a config per package", (line) => {
  it.each(NEAREST_LOOKUP_TEAMS)("applies a package config's projection under ESLint $version running `$lintCommand`", async (team) => {
    await expect(monorepoRun({ line, ...PACKAGE_CONFIG_REPO, ...team })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [PACKAGE_HIT], projection: "current" },
    });
  });

  it("finds no projection in effect under ESLint 9 run from the root, which loads only the root config", async () => {
    await expect(
      monorepoRun({ line, ...PACKAGE_CONFIG_REPO, version: "9.39.5", lintCommand: "eslint ." }),
    ).resolves.toMatchObject({ outcome: "ok", value: { hits: [], projection: "not-included" } });
  });

  it.each(NEAREST_LOOKUP_TEAMS)("finds no projection in effect where a package config drops it under ESLint $version running `$lintCommand`", async (team) => {
    await expect(monorepoRun({ line, ...ROOT_CONFIG_REPO, ...team })).resolves.toMatchObject({
      outcome: "ok",
      value: { hits: [], projection: "not-included" },
    });
  });

  it("applies the root config's projection to every package under ESLint 9 run from the root", async () => {
    await expect(
      monorepoRun({ line, ...ROOT_CONFIG_REPO, version: "9.39.5", lintCommand: "eslint ." }),
    ).resolves.toMatchObject({ outcome: "ok", value: { hits: [PACKAGE_HIT], projection: "current" } });
  });
});

const PACKAGE_A = `${consumerRepo({ name: "monorepo-package-config" })}/packages/a`;

const lintedFromPackage = async (request: { readonly line: EslintLine; readonly file: string }) => {
  const Eslint = await eslintClassOn({ line: request.line });
  return new Eslint({ cwd: PACKAGE_A }).lintText("export class Inherited {}\n", { filePath: `${PACKAGE_A}/${request.file}` });
};

describe.each(ESLINT_LINES)("a package that spreads its own projection slice, on real %s", (line) => {
  it("lints from its own folder against its own config, honouring its carve-out", async () => {
    await expect(lintedFromPackage({ line, file: "legacy.ts" })).resolves.toMatchObject([{ messages: [] }]);
  });

  it("lints from its own folder against its own config, still flagging a file its carve-outs do not name", async () => {
    await expect(lintedFromPackage({ line, file: "fresh.ts" })).resolves.toMatchObject([
      { messages: [{ ruleId: "hone/no-class-authoring" }] },
    ]);
  });

  it.each(NEAREST_LOOKUP_TEAMS)(
    "is judged the same by the check from the root under ESLint $version running `$lintCommand`: slice current and applied, the uncarved file flagged",
    async (team) => {
      await expect(monorepoRun({ line, ...PACKAGE_CONFIG_REPO, ...team })).resolves.toMatchObject({
        outcome: "ok",
        value: { hits: [PACKAGE_HIT], projection: "current", slices: [], unprojectedFolders: [] },
      });
    },
  );

  it.each(NEAREST_LOOKUP_TEAMS)(
    "names the slice of a package whose config spreads no slice as missing and not applied under ESLint $version running `$lintCommand`",
    async (team) => {
      await expect(monorepoRun({ line, ...ROOT_CONFIG_REPO, ...team })).resolves.toMatchObject({
        outcome: "ok",
        value: {
          projection: "not-included",
          slices: [
            { slice: "packages/a/disciplines.eslint.mjs", state: "missing" },
            { slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" },
          ],
        },
      });
    },
  );

  it("requires no slice for a package config ESLint 9 never loads, resolving every file from the root config", async () => {
    await expect(
      monorepoRun({ line, ...ROOT_CONFIG_REPO, version: "9.39.5", lintCommand: "eslint ." }),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current", slices: [], unprojectedFolders: [] } });
  });
});

import { assert, describe, expect, it } from "vitest";
import { defaultClauseSettings } from "../../../../../domain/settings/clause-settings/default-clause-settings.ts";
import { checkConformance } from "../../../protocol/conformance.ts";
import { runnerModuleSchema, type StandaloneRunner } from "../../../protocol/runner-module/runner-module-schema.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { editionRunsOf } from "../../../../../domain/runner/edition-runs.ts";
import { createDefaultEntryKindPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { readLocatedPieceFile } from "../../../../content-files/rule-sets/located-piece-file.ts";
import { readInstalledNames } from "../../../../content-files/rule-sets/installed-pieces.ts";
import { readHeldDiscipline } from "../../../../content-files/rule-sets/held-discipline.ts";
import type { DisciplineFile, SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import { clauseAddressSchema } from "../../../../discipline-exceptions-folder/clause-address.ts";
import { disciplineIdSchema } from "../../../../hone-config-file/identifiers.ts";
import type { EngineId } from "../../../../../domain/rule-set/identifier-types.ts";
import { createWalkerRunner } from "../../runner/create-walker-runner.ts";
import type { CompilerOptions, SyntaxApi, TypeScriptParsePort } from "../../runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort } from "../../runner/toolchain/typescript-toolchain.ts";
import * as walkerRunnerModule from "../../runner/runner.ts";
import { TEST_BODY_REMEDIES, TEST_BODY_SECTIONS } from "./test-body-logic.ts";
import * as eslintRunnerModule from "../../../eslint/runner/runner.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: `${import.meta.dirname}/../../../../../..`, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(/^6\./.test(loadedParsePort.value.syntaxApi.version), `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`);
const defaultParsePort = loadedParsePort.value;

type AllowedFormSection = {
  readonly heading: string;
  readonly section: string;
  readonly flagged: string;
  readonly allowed: readonly string[];
};

const PART_HEADING = "## Allowed forms in a test\n";

const TYPESCRIPT_BLOCK = /^```ts\n([\s\S]*?)^```$/gm;

const sectionSlugOf = (request: { readonly heading: string }): string =>
  request.heading.toLowerCase().replaceAll(/[^a-z0-9 -]/g, "").trim().replaceAll(" ", "-");

const partOf = (request: { readonly page: string }): string => {
  const start = request.page.indexOf(PART_HEADING);
  if (start === -1) return "";
  const afterHeading = request.page.slice(start + PART_HEADING.length);
  const nextPart = afterHeading.search(/^## /m);
  return nextPart === -1 ? afterHeading : afterHeading.slice(0, nextPart);
};

const blocksOf = (request: { readonly chunk: string }): readonly string[] =>
  [...request.chunk.matchAll(TYPESCRIPT_BLOCK)].flatMap((block) => (block[1] === undefined ? [] : [block[1]]));

const sectionOf = (request: { readonly chunk: string }): readonly AllowedFormSection[] => {
  const heading = request.chunk.slice(0, request.chunk.indexOf("\n")).trim();
  const [flagged, ...allowed] = blocksOf(request);
  return flagged === undefined ? [] : [{ heading, section: sectionSlugOf({ heading }), flagged, allowed }];
};

const allowedFormSectionsOf = (request: { readonly page: string }): readonly AllowedFormSection[] =>
  partOf({ page: request.page.replaceAll("\r\n", "\n") })
    .split(/^### /m)
    .slice(1)
    .flatMap((chunk) => sectionOf({ chunk }));

const FORM_FILE = repoPathOf("allowed-form.test.ts");

const VITEST_PRELUDE = "import { assert, expect, it, vi } from \"vitest\";\n";

const cd3CompilerOptionsOf = (request: { readonly syntaxApi: SyntaxApi }): CompilerOptions => ({
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noPropertyAccessFromIndexSignature: true,
  useUnknownInCatchVariables: true,
  target: request.syntaxApi.ScriptTarget.ESNext,
  module: request.syntaxApi.ModuleKind.ESNext,
  moduleResolution: request.syntaxApi.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  noEmit: true,
  types: [],
});

type AllowedBlock = { readonly name: string; readonly source: string };

const allowedBlocksOf = (request: { readonly sections: readonly AllowedFormSection[] }): readonly AllowedBlock[] =>
  request.sections.flatMap((section) =>
    section.allowed.map((source, index) => ({ name: `${section.section} ${index + 1}`, source })),
  );

const allowCasesOf = (request: { readonly blocks: readonly AllowedBlock[] }): readonly SourceCase[] =>
  request.blocks.map((block) => ({
    name: block.name,
    fileName: FORM_FILE,
    source: `${VITEST_PRELUDE}${block.source}`,
    expectedLines: [],
  }));

const rowsNamed = <Row extends { readonly name: string }>(request: {
  readonly rows: readonly Row[];
  readonly names: readonly string[];
}): readonly Row[] => request.rows.filter((row) => request.names.includes(row.name));

type BlockTypeErrors = { readonly name: string; readonly errors: readonly string[] };

type FormDiagnostic = { readonly fileName: string | undefined; readonly message: string };

type TypeErrors = { readonly blocks: readonly BlockTypeErrors[]; readonly unattributed: readonly string[] };

const typeErrorsAmong = (request: {
  readonly forms: readonly { readonly name: string; readonly path: string }[];
  readonly diagnostics: readonly FormDiagnostic[];
}): TypeErrors => {
  const formPaths = request.forms.map((form) => form.path);
  return {
    blocks: request.forms.map((form) => ({
      name: form.name,
      errors: request.diagnostics.filter((diagnostic) => diagnostic.fileName === form.path).map((diagnostic) => diagnostic.message),
    })),
    unattributed: request.diagnostics
      .filter((diagnostic) => diagnostic.fileName === undefined || !formPaths.includes(diagnostic.fileName))
      .map((diagnostic) => (diagnostic.fileName === undefined ? diagnostic.message : `${diagnostic.fileName}: ${diagnostic.message}`)),
  };
};

const typeErrorsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly repoRoot: string;
  readonly blocks: readonly AllowedBlock[];
}): TypeErrors => {
  const { syntaxApi } = request;
  const options = cd3CompilerOptionsOf({ syntaxApi });
  const root = request.repoRoot.replaceAll("\\", "/");
  const forms = request.blocks.map((block, index) => ({
    name: block.name,
    path: `${root}/allowed-form-${index}.test.ts`,
    text: `${VITEST_PRELUDE}${block.source}`,
  }));
  const formTextOf = (fileName: string): string | undefined =>
    forms.find((form) => form.path === fileName.replaceAll("\\", "/"))?.text;
  const host = syntaxApi.createCompilerHost(options);
  const readFile = host.readFile;
  const getSourceFile = host.getSourceFile;
  const program = syntaxApi.createProgram({
    rootNames: forms.map((form) => form.path),
    options,
    host: {
      ...host,
      fileExists: (fileName) => formTextOf(fileName) !== undefined || host.fileExists(fileName),
      readFile: (fileName) => formTextOf(fileName) ?? readFile(fileName),
      getSourceFile: (fileName, languageVersion) => {
        const text = formTextOf(fileName);
        return text === undefined ? getSourceFile(fileName, languageVersion) : syntaxApi.createSourceFile(fileName, text, languageVersion, true);
      },
    },
  });
  return typeErrorsAmong({
    forms,
    diagnostics: syntaxApi.getPreEmitDiagnostics(program).map((diagnostic) => ({
      fileName: diagnostic.file?.fileName.replaceAll("\\", "/"),
      message: syntaxApi.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    })),
  });
};

const slashed = (text: string): string => text.replaceAll("\\", "/");

const overlaidFileText = (request: {
  readonly base: FileTextPort;
  readonly files: Readonly<Record<string, string>>;
}): FileTextPort => {
  const overlaid = (requested: string): string | undefined =>
    Object.entries(request.files).find(([name]) => slashed(name) === slashed(requested))?.[1];
  return {
    ...request.base,
    read: (reading) => {
      const text = overlaid(reading.path);
      return text === undefined ? request.base.read(reading) : { outcome: "ok", value: text };
    },
    exists: (probing) => (overlaid(probing.path) === undefined ? request.base.exists(probing) : "present"),
  };
};

const remedySectionsOf = async (request: {
  readonly repoRoot: string;
  readonly parse: TypeScriptParsePort;
  readonly clause: RunnerClause;
  readonly source: string;
}): Promise<readonly string[]> => {
  const path = createDefaultPathPort({});
  const repoRoot = absolutePathSchema.parse(request.repoRoot);
  const runner: StandaloneRunner = createWalkerRunner({
    fileText: overlaidFileText({
      base: createDefaultFileTextPort({}),
      files: { [path.join({ segments: [repoRoot, FORM_FILE] })]: `${VITEST_PRELUDE}${request.source}` },
    }),
    modules: createDefaultModuleLoaderPort({}),
    path,
    parse: request.parse,
    entryKind: createDefaultEntryKindPort({}),
  });
  const report = await runner.run({ repoRoot, installRoot: repoRoot, files: [FORM_FILE], trackedPaths: [FORM_FILE], clauses: [request.clause] });
  if (report.outcome === "failed") return [`run failed: ${report.error.kind}`];
  return report.value.hits.flatMap((hit) => (hit.remedy === undefined ? [] : [hit.remedy.section]));
};

type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const disciplineOf = (request: { readonly fileText: FileTextPort; readonly discipline: string }): DisciplineFile => {
  const held = readHeldDiscipline({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(held.outcome === "ok", `${request.discipline} reads through the install's discipline reader`);
  const discipline = held.value;
  assert(discipline.held === "present", `the install holds ${request.discipline}`);
  return discipline.file;
};

const rowsOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
  readonly mechanism: EngineId;
}): readonly ConformanceRow[] => {
  const discipline = disciplineOf(request);
  const piece = readLocatedPieceFile({
    fileText: request.fileText,
    path: createDefaultPathPort({}),
    ruleSetRoot: RULE_SET_ROOT,
    installRoot: RULE_SET_ROOT,
    mechanism: request.mechanism,
    discipline,
  });
  assert(piece.outcome === "ok", `${request.discipline} ${request.mechanism} piece.json reads through the rule-set reader`);
  return piece.value.clauses.flatMap((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(definition?.kind === "mechanical", `${request.discipline}#${entry.clause} is a mechanical clause`);
    const clause: RunnerClause = {
      address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
      anchor: definition.anchor,
      pieceRoot: entry.pieceRoot,
      settings: entry.settings,
      clauseSettings: defaultClauseSettings({ declarations: entry.clauseSettings }),
      edition: entry.editions.default,
    };
    return editionRunsOf({ clause, cases: [...definition.cases.flag, ...definition.cases.allow] }).map((run) => ({
      name: run.clause.edition === entry.editions.default
        ? `${request.discipline}#${entry.clause}`
        : `${request.discipline}#${entry.clause} edition ${run.clause.edition}`,
      ...run,
    }));
  });
};

const conformanceRows = (request: {
  readonly disciplines: readonly string[];
  readonly mechanism: EngineId;
}): readonly ConformanceRow[] => {
  const fileText = createDefaultFileTextPort({});
  return request.disciplines.flatMap((discipline) =>
    rowsOf({ fileText, discipline, mechanism: request.mechanism }),
  );
};

const REPO_ROOT = createDefaultPathPort({}).join({ segments: [import.meta.dirname, "..", "..", "..", "..", "..", ".."] });

const checkItemTextOf = (request: { readonly page: string }): string => {
  const read = createDefaultFileTextPort({}).read({ path: createDefaultPathPort({}).join({ segments: [REPO_ROOT, "rules", "typescript", "symptoms", request.page] }) });
  return read.outcome === "ok" ? read.value : "";
};

const CHECK_ITEM_PAGES: readonly string[] = [...new Set(TEST_BODY_REMEDIES.map((remedy) => remedy.page))];

const heldNames = readInstalledNames({ fileText: createDefaultFileTextPort({}), path: createDefaultPathPort({}), installRoot: RULE_SET_ROOT });

assert(heldNames.outcome === "ok", "the install's version 1 names read");

const legacyDisciplines = [...new Set(heldNames.value.namedClauses.filter((clause) => clause.kind === "mechanical").map(({ clause }) => clause.discipline))].sort();

const AUDIT_ROWS = conformanceRows({
  disciplines: legacyDisciplines,
  mechanism: "walker",
});

const ESLINT_ROWS = conformanceRows({
  disciplines: legacyDisciplines,
  mechanism: "eslint",
});

const CLAUSES_THAT_REACH_TEST_FILES = {
  audit: [
    "CD-1#any-cast", "CD-2#cast-expressions", "CD-6#identifier-names", "CD-14#class-syntax", "CD-15#loops", "CD-25#dependency-isolation",
    "CD-27#test-body-logic", "CD-27#test-body-logic edition 2", "CD-43#boolean-signatures",
  ],
  eslint: ["CD-1#explicit-any", "CD-2#non-null-assertions", "CD-10#throw-only-error", "CD-14#class-syntax", "CD-40#parameter-count", "CD-41#function-length"],
};

const SECTIONS = CHECK_ITEM_PAGES.flatMap((page) => allowedFormSectionsOf({ page: checkItemTextOf({ page }) }).map((section) => ({ ...section, page })));

const BLOCKS = allowedBlocksOf({ sections: SECTIONS });

const ALLOW_CASES = allowCasesOf({ blocks: BLOCKS });

const TYPE_ERRORS = typeErrorsOf({ syntaxApi: defaultParsePort.syntaxApi, repoRoot: REPO_ROOT, blocks: BLOCKS });

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

const eslintRunner = runnerModuleSchema.parse(eslintRunnerModule.runner);

describe("the allowed-form compilation over written-out forms, so it can fail", () => {
  it("reports reading an indexed element that may be missing and an optional property given undefined, under the compiler options CD-3 requires", () => {
    expect(
      typeErrorsOf({
        syntaxApi: defaultParsePort.syntaxApi,
        repoRoot: REPO_ROOT,
        blocks: [
          { name: "indexed", source: 'declare const rows: readonly { readonly id: string }[];\nexpect(rows[0].id).toBe("a");\n' },
          { name: "optional", source: "const options: { readonly limit?: number } = { limit: undefined };\nexpect(options).toEqual({});\n" },
        ],
      }).blocks,
    ).toEqual([
      { name: "indexed", errors: ["Object is possibly 'undefined'."] },
      { name: "optional", errors: [expect.any(String)] },
    ]);
  });

  it("keeps a diagnostic with no file, or in a file that is not a form, as unattributed", () => {
    expect(
      typeErrorsAmong({
        forms: [{ name: "first", path: "/repo/allowed-form-0.test.ts" }],
        diagnostics: [
          { fileName: undefined, message: "option 'strict' is invalid" },
          { fileName: "/repo/core/imported.ts", message: "broken through an import" },
        ],
      }),
    ).toEqual({ blocks: [{ name: "first", errors: [] }], unattributed: ["option 'strict' is invalid", "/repo/core/imported.ts: broken through an import"] });
  });
});

describe("the check items' Allowed forms in a test", () => {
  it("has as many sections as there are fixes a CD-27#test-body-logic finding names, each shown below on its check item", () => {
    expect(SECTIONS).toHaveLength(TEST_BODY_SECTIONS.length);
  });

  it.each(TEST_BODY_REMEDIES)("shows $section on $page, the check item its fix names", ({ page, section }) => {
    expect(SECTIONS).toContainEqual(expect.objectContaining({ page, section }));
  });

  it("holds the forms to every audit and ESLint clause, among them those that reach a test file", () => {
    expect(rowsNamed({ rows: AUDIT_ROWS, names: CLAUSES_THAT_REACH_TEST_FILES.audit })).toHaveLength(9);
    expect(rowsNamed({ rows: ESLINT_ROWS, names: CLAUSES_THAT_REACH_TEST_FILES.eslint })).toHaveLength(6);
  });

  it.each(SECTIONS)("shows under $heading a flagged form whose finding names that section", async ({ flagged, section }) => {
    const [secondEditionRow] = rowsNamed({ rows: AUDIT_ROWS, names: ["CD-27#test-body-logic edition 2"] });
    assert.isDefined(secondEditionRow);

    expect(await remedySectionsOf({ repoRoot: REPO_ROOT, parse: defaultParsePort, clause: secondEditionRow.clause, source: flagged })).toContain(section);
  });

  it.each(TYPE_ERRORS.blocks)("compiles $name under the compiler options CD-3 requires", ({ errors }) => {
    expect(errors).toEqual([]);
  });

  it("compiles with no diagnostic outside the forms, under the compiler options CD-3 requires", () => {
    expect(TYPE_ERRORS.unattributed).toEqual([]);
  });

  it.each(AUDIT_ROWS)("has no form to write instead that the audit runner flags under $name", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: ALLOW_CASES, runner: walkerRunner })).toEqual({ outcome: "ok", value: [] });
  });

  it.each(ESLINT_ROWS)("has no form to write instead that the ESLint runner flags under $name", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: ALLOW_CASES, runner: eslintRunner })).toEqual({ outcome: "ok", value: [] });
  });
});

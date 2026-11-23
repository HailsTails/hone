import { assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import {
  checkAddressOfNames,
  checkAddressTextOf,
  checkNamesOf,
} from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { EngineId } from "../../../../../domain/rule-set/identifier-types.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { defaultClauseSettings } from "../../../../../domain/settings/clause-settings/default-clause-settings.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../../../content-files/symptom-catalogues/bound-catalogue.ts";
import {
  createDefaultDirectoryPort,
  createDefaultEntryKindPort,
} from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { namedChecksRunner as eslintRunner } from "../../../eslint/runner/runner.ts";
import { readNamedPiece } from "../../../named-piece.ts";
import { namedCheckConformance } from "../../../protocol/conformance.ts";
import { createWalkerRunner } from "../../runner/create-walker-runner.ts";
import { namedChecksRunner as walkerRunner } from "../../runner/runner.ts";
import type {
  CompilerOptions,
  SyntaxApi,
  TypeScriptParsePort,
} from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../runner/toolchain/typescript-toolchain.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: {
        readonly base: string;
        readonly query: "?raw";
        readonly import: "default";
        readonly eager: true;
      },
    ) => Readonly<Record<string, string>>;
  }
}

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({
    installRoot: `${import.meta.dirname}/../../../../../..`,
    installForm: "source",
  }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);
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
  request.heading
    .toLowerCase()
    .replaceAll(/[^a-z0-9 -]/g, "")
    .trim()
    .replaceAll(" ", "-");

const partOf = (request: { readonly page: string }): string => {
  const start = request.page.indexOf(PART_HEADING);
  if (start === -1) return "";
  const afterHeading = request.page.slice(start + PART_HEADING.length);
  const nextPart = afterHeading.search(/^## /m);
  return nextPart === -1 ? afterHeading : afterHeading.slice(0, nextPart);
};

const blocksOf = (request: { readonly chunk: string }): readonly string[] =>
  [...request.chunk.matchAll(TYPESCRIPT_BLOCK)].flatMap((block) =>
    block[1] === undefined ? [] : [block[1]],
  );

const sectionOf = (request: { readonly chunk: string }): readonly AllowedFormSection[] => {
  const heading = request.chunk.slice(0, request.chunk.indexOf("\n")).trim();
  const [flagged, ...allowed] = blocksOf(request);
  return flagged === undefined
    ? []
    : [{ heading, section: sectionSlugOf({ heading }), flagged, allowed }];
};

const allowedFormSectionsOf = (request: { readonly page: string }): readonly AllowedFormSection[] =>
  partOf({ page: request.page.replaceAll("\r\n", "\n") })
    .split(/^### /m)
    .slice(1)
    .flatMap((chunk) => sectionOf({ chunk }));

const FORM_FILE = repoPathOf("allowed-form.test.ts");

const VITEST_PRELUDE = 'import { assert, expect, it, vi } from "vitest";\n';

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

const allowedBlocksOf = (request: {
  readonly sections: readonly AllowedFormSection[];
}): readonly AllowedBlock[] =>
  request.sections.flatMap((section) =>
    section.allowed.map((source, index) => ({ name: `${section.section} ${index + 1}`, source })),
  );

const allowCasesOf = (request: {
  readonly blocks: readonly AllowedBlock[];
}): readonly SourceCase[] =>
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

type TypeErrors = {
  readonly blocks: readonly BlockTypeErrors[];
  readonly unattributed: readonly string[];
};

const typeErrorsAmong = (request: {
  readonly forms: readonly { readonly name: string; readonly path: string }[];
  readonly diagnostics: readonly FormDiagnostic[];
}): TypeErrors => {
  const formPaths = request.forms.map((form) => form.path);
  return {
    blocks: request.forms.map((form) => ({
      name: form.name,
      errors: request.diagnostics
        .filter((diagnostic) => diagnostic.fileName === form.path)
        .map((diagnostic) => diagnostic.message),
    })),
    unattributed: request.diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.fileName === undefined || !formPaths.includes(diagnostic.fileName),
      )
      .map((diagnostic) =>
        diagnostic.fileName === undefined
          ? diagnostic.message
          : `${diagnostic.fileName}: ${diagnostic.message}`,
      ),
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
        return text === undefined
          ? getSourceFile(fileName, languageVersion)
          : syntaxApi.createSourceFile(fileName, text, languageVersion, true);
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
    exists: (probing) =>
      overlaid(probing.path) === undefined ? request.base.exists(probing) : "present",
  };
};

const remedySectionsOf = async (request: {
  readonly repoRoot: string;
  readonly parse: TypeScriptParsePort;
  readonly bindings: readonly CheckBinding[];
  readonly source: string;
}): Promise<readonly string[]> => {
  const path = createDefaultPathPort({});
  const repoRoot = absolutePathSchema.parse(request.repoRoot);
  const runner = createWalkerRunner({
    fileText: overlaidFileText({
      base: createDefaultFileTextPort({}),
      files: {
        [path.join({ segments: [repoRoot, FORM_FILE] })]: `${VITEST_PRELUDE}${request.source}`,
      },
    }),
    modules: createDefaultModuleLoaderPort({}),
    path,
    parse: request.parse,
    entryKind: createDefaultEntryKindPort({}),
  });
  const report = await runner.run({
    repoRoot,
    installRoot: repoRoot,
    files: [FORM_FILE],
    trackedPaths: [FORM_FILE],
    bindings: request.bindings,
    answered: [],
    declaredConfigRoots: [],
    declaredConfigLookup: undefined,
  });
  if (report.outcome === "failed") return [`run failed: ${report.error.kind}`];
  return report.value.hits.flatMap((hit) => (hit.remedy === undefined ? [] : [hit.remedy.section]));
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const REPO_ROOT = createDefaultPathPort({}).join({
  segments: [import.meta.dirname, "..", "..", "..", "..", "..", ".."],
});

const checkItemTextOf = (request: { readonly page: string }): string => {
  const read = createDefaultFileTextPort({}).read({
    path: createDefaultPathPort({}).join({
      segments: [REPO_ROOT, "rules", "typescript", "symptoms", request.page],
    }),
  });
  assert(read.outcome === "ok", `reads the check item ${request.page}`);
  return read.value;
};

const CHECK_ITEM_PAGES = [
  {
    page: "branch-in-a-test/test-body.md",
    sections: [
      "branching-with-if",
      "a-ternary",
      "a-short-circuit",
      "an-optional-chain-after-an-index",
      "an-optional-chain-on-a-mock-call",
      "an-optional-chain-on-a-mock-result",
      "an-optional-chain-on-a-property",
      "an-optional-call",
      "a-switch",
    ],
  },
  { page: "throw-or-catch-in-a-test/try-block.md", sections: ["a-try-block"] },
  { page: "rebinding/test-body.md", sections: ["a-let"] },
  {
    page: "computed-value-in-a-test/test-body.md",
    sections: [
      "a-method-that-picks-or-tests-an-element",
      "a-method-that-computes-a-value",
      "a-method-that-mutates",
      "merging-objects",
      "building-an-object-from-entries",
      "building-an-array-from-a-length",
      "a-math-call",
    ],
  },
  { page: "text-past-its-reader/test-body.md", sections: ["serialising-or-parsing-json"] },
  {
    page: "double-with-a-body/logic-in-a-passed-function.md",
    sections: ["logic-inside-a-function-the-test-passes-on"],
  },
];

const source = {
  installRoot: RULE_SET_ROOT,
  ruleSetRoot: RULE_SET_ROOT,
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
};
const catalogue = readBoundCatalogue({
  ruleSet: "hone",
  ...source,
  directory: createDefaultDirectoryPort({}),
});
assert(catalogue.outcome === "ok" && catalogue.value.held === "catalogue");
const CHECKS = catalogue.value.catalogue.checks;
const rowsFor = (mechanism: EngineId) =>
  CHECKS.filter(({ engines }) => engines.some(({ name }) => name === mechanism)).flatMap(
    (check) => {
      const address = checkAddressTextOf({ check });
      const names = checkNamesOf({ text: address });
      assert.isDefined(names);
      const held = readNamedPiece({ ...source, ...names, mechanism });
      assert(held.outcome === "ok");
      const { editions, settings, pieceRoot, anchor, declarations, forms } = held.value;
      return editions.declared.map((edition) => {
        const binding: CheckBinding = {
          address,
          ruleSet: "hone",
          engine: mechanism,
          edition,
          settings,
          pieceRoot,
          anchor,
          checkSettings: defaultClauseSettings({ declarations }),
          forms: Object.fromEntries(
            Object.entries(forms).map(([form, name]) => [form, checkAddressOfNames(name)]),
          ),
        };
        return { name: `${address} edition ${edition}`, binding };
      });
    },
  );

const WALKER_ROWS = rowsFor("walker");
const ESLINT_ROWS = rowsFor("eslint");

const CHECKS_THAT_REACH_TEST_FILES = {
  walker: [
    "claimed-type#cast-to-any edition 1",
    "claimed-type#unlisted-cast-site edition 1",
    "shorthand-name#identifier-names edition 1",
    "authored-class-or-this#class-keyword edition 1",
    "loop-keyword#loop-statement edition 1",
    "double-with-a-body#stub-implementation edition 1",
    "branch-in-a-test#test-body edition 1",
    "branch-in-a-test#test-body edition 2",
    "boolean-in-a-signature#boolean-annotation edition 1",
  ],
  eslint: [
    "untyped-value#explicit-any edition 1",
    "claimed-type#non-null-assertions edition 1",
    "thrown-non-error#throw-only-error edition 1",
    "authored-class-or-this#class-keyword edition 1",
    "positional-parameters#parameter-count edition 1",
    "long-function#function-length edition 1",
  ],
};

const checkItems = CHECK_ITEM_PAGES.map(({ page, sections }) => ({
  page,
  expected: sections,
  actual: allowedFormSectionsOf({ page: checkItemTextOf({ page }) }),
}));

const SECTIONS = checkItems.flatMap((checkItem) => checkItem.actual);

const orderedSections = checkItems.map(({ page, expected, actual }) => ({
  page,
  expected,
  actual: actual.map(({ section }) => section),
}));

const BLOCKS = allowedBlocksOf({ sections: SECTIONS });

const ALLOW_CASES = allowCasesOf({ blocks: BLOCKS });

const TYPE_ERRORS = typeErrorsOf({
  syntaxApi: defaultParsePort.syntaxApi,
  repoRoot: REPO_ROOT,
  blocks: BLOCKS,
});

describe("the allowed-form compilation over written-out forms, so it can fail", () => {
  it("reports reading an indexed element that may be missing and an optional property given undefined, under the compiler options CD-3 requires", () => {
    expect(
      typeErrorsOf({
        syntaxApi: defaultParsePort.syntaxApi,
        repoRoot: REPO_ROOT,
        blocks: [
          {
            name: "indexed",
            source:
              'declare const rows: readonly { readonly id: string }[];\nexpect(rows[0].id).toBe("a");\n',
          },
          {
            name: "optional",
            source:
              "const options: { readonly limit?: number } = { limit: undefined };\nexpect(options).toEqual({});\n",
          },
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
    ).toEqual({
      blocks: [{ name: "first", errors: [] }],
      unattributed: [
        "option 'strict' is invalid",
        "/repo/core/imported.ts: broken through an import",
      ],
    });
  });
});

describe("the check items' Allowed forms in a test", () => {
  it.each(orderedSections)("lists every allowed form on $page in order", ({ actual, expected }) => {
    expect(actual).toEqual(expected);
  });

  it("holds the forms to every Walker and ESLint check, among them those that reach a test file", () => {
    expect(
      rowsNamed({ rows: WALKER_ROWS, names: CHECKS_THAT_REACH_TEST_FILES.walker }),
    ).toHaveLength(9);
    expect(
      rowsNamed({ rows: ESLINT_ROWS, names: CHECKS_THAT_REACH_TEST_FILES.eslint }),
    ).toHaveLength(6);
  });

  it.each(SECTIONS)(
    "shows under $heading a flagged form whose finding names that section",
    async ({ flagged, section }) => {
      const bindings = WALKER_ROWS.map(({ binding }) => binding).filter(
        ({ edition, forms }) => edition === "2" && forms?.[section] !== undefined,
      );

      expect(
        await remedySectionsOf({
          repoRoot: REPO_ROOT,
          parse: defaultParsePort,
          bindings,
          source: flagged,
        }),
      ).toContain(section);
    },
  );

  it.each(TYPE_ERRORS.blocks)(
    "compiles $name under the compiler options CD-3 requires",
    ({ errors }) => {
      expect(errors).toEqual([]);
    },
  );

  it("compiles with no diagnostic outside the forms, under the compiler options CD-3 requires", () => {
    expect(TYPE_ERRORS.unattributed).toEqual([]);
  });

  it.each(WALKER_ROWS)(
    "has no form to write instead that the audit runner flags under $name",
    async (row) => {
      expect(
        await namedCheckConformance({
          binding: row.binding,
          cases: ALLOW_CASES,
          runner: walkerRunner,
        }),
      ).toEqual({ outcome: "ok", value: [] });
    },
  );

  it.each(ESLINT_ROWS)(
    "has no form to write instead that the ESLint runner flags under $name",
    async (row) => {
      expect(
        await namedCheckConformance({
          binding: row.binding,
          cases: ALLOW_CASES,
          runner: eslintRunner,
        }),
      ).toEqual({ outcome: "ok", value: [] });
    },
  );
});

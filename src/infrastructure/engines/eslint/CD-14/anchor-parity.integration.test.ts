import { describe, expect, it } from "vitest";
import type { RunnerClause } from "../../protocol/runner-module/runner-module-schema.ts";
import type { FileTextPort } from "../../../node/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import type { SourceCase } from "../../../content-files/rule-sets/rule-set-reader.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { check } from "../../audit/CD-14/class-syntax.ts";
import { createWalkerRunner } from "../../audit/runner/create-walker-runner.ts";
import { defaultParsePort } from "../../../../../tests/typescript-parse-port.ts";
import { defaultEslintPort } from "../../../../../tests/eslint-toolchains.ts";
import { eslintPluginModuleSchema } from "../runner/pieces/eslint-plugin-schema.ts";
import classAuthoringPlugin from "./cd14/cd14.eslint-plugin.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";
import { ABSENT_ENTRY_KIND } from "../../../../../tests/empty-walker-disk.ts";

const PIECE_ROOT = absolutePathSchema.parse(import.meta.dirname);

const keywordAfterNodeStartCases: readonly SourceCase[] = [
  {
    name: "decorator on the line before the class keyword",
    fileName: repoPathSchema.parse("decorated.ts"),
    source: "@sealed\nclass Alpha {}\n",
    expectedLines: [2],
  },
  {
    name: "decorated class expression",
    fileName: repoPathSchema.parse("decorated-expression.ts"),
    source: "export const Gamma = @sealed\nclass {};\n",
    expectedLines: [2],
  },
];

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const eslint = defaultEslintPort;

const noFileText: FileTextPort = {
  read: ({ path }) => ({ outcome: "failed", error: { kind: "unreadable", path, detail: "not used" } }),
  exists: () => "absent",
  write: () => ({ outcome: "ok", value: undefined }),
};

const loadingWalkerPiece: ModuleLoaderPort = {
  load: () => Promise.resolve({ outcome: "ok", value: { check } }),
};

const walkerRunner = createWalkerRunner({
  fileText: noFileText,
  modules: loadingWalkerPiece,
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
  parse: defaultParsePort,
  entryKind: ABSENT_ENTRY_KIND,
});

const WALKER_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "class-syntax.ts" },
};

describe("CD-14 class-syntax anchors in the audit and the ESLint piece", () => {
  it.each(
    keywordAfterNodeStartCases,
  )("anchors at the class keyword on the same line in both mechanisms for the case $name", async (anchorCase) => {
    expect({
      audit: await walkerRunner.conform({ clause: WALKER_CLAUSE, cases: [anchorCase] }),
      eslint: await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone",
        rule: "no-class-authoring",
        options: [],
        cases: [anchorCase],
      }),
    }).toEqual({
      audit: {
        outcome: "ok",
        value: [{ caseName: anchorCase.name, flaggedLines: anchorCase.expectedLines }],
      },
      eslint: {
        outcome: "ok",
        value: [{ caseName: anchorCase.name, flaggedLines: anchorCase.expectedLines }],
      },
    });
  });
});

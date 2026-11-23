import { assert, describe, expect, it } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { SourceCase } from "../../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { check } from "../../../walker/authored-class-or-this/class-keyword/class-syntax.ts";
import { createWalkerRunner } from "../../../walker/runner/create-walker-runner.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
} from "../../../walker/runner/toolchain/typescript-toolchain.ts";
import { eslintPluginModuleSchema } from "../../runner/pieces/eslint-plugin-schema.ts";
import { createEslintPort } from "../../runner/toolchain/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../runner/toolchain/eslint-toolchain.ts";
import classAuthoringPlugin from "./eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(import.meta.dirname);

const keywordAfterNodeStartCases: readonly SourceCase[] = [
  {
    name: "decorator on the line before the class keyword",
    fileName: repoPathOf("decorated.ts"),
    source: "@sealed\nclass Alpha {}\n",
    expectedLines: [2],
  },
  {
    name: "decorated class expression",
    fileName: repoPathOf("decorated-expression.ts"),
    source: "export const Gamma = @sealed\nclass {};\n",
    expectedLines: [2],
  },
];

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const DEVELOPMENT_INSTALL_ROOT = `${import.meta.dirname}/../../../../..`;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({
    installRoot: DEVELOPMENT_INSTALL_ROOT,
    installForm: "source",
  }),
});
assert(
  loadedToolchain.outcome === "ok",
  "the eslint-10 toolchain loads from the development install",
);
assert(
  /^10\./.test(loadedToolchain.value.eslintVersion),
  `the eslint-10 toolchain runs ESLint ${loadedToolchain.value.eslintVersion}`,
);

const eslint = createEslintPort({ toolchain: loadedToolchain.value });

const loadedParsePort = await loadParsePort({
  peers: defaultTypeScriptPeers({ installRoot: DEVELOPMENT_INSTALL_ROOT, installForm: "source" }),
});
assert(loadedParsePort.outcome === "ok", "the typescript line loads from the development install");
assert(
  /^6\./.test(loadedParsePort.value.syntaxApi.version),
  `the typescript line runs TypeScript ${loadedParsePort.value.syntaxApi.version}`,
);

const noFileText: FileTextPort = {
  read: ({ path }) => ({
    outcome: "failed",
    error: { kind: "unreadable", path, detail: "not used" },
  }),
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
  parse: loadedParsePort.value,
  entryKind: { kindOf: () => "absent" },
});

const WALKER_BINDING: CheckBinding = {
  address: "authored-class-or-this#class-keyword",
  engine: "walker",
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  checkSettings: {},
  edition: editionOf("1"),
  settings: { module: "class-syntax.ts" },
};

describe("CD-14 class-syntax anchors in the audit and the ESLint piece", () => {
  it.each(keywordAfterNodeStartCases)(
    "anchors at the class keyword on the same line in both mechanisms for the case $name",
    async (anchorCase) => {
      expect({
        audit: await walkerRunner.conform({ binding: WALKER_BINDING, cases: [anchorCase] }),
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
    },
  );
});

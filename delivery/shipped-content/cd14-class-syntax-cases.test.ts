import { assert, describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { readDisciplineFile } from "../../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import type { ClauseDefinition } from "../../src/domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { disciplineIdSchema } from "../../src/infrastructure/hone-config-file/identifiers.ts";
import discipline from "../../rules/CD-14/discipline.json" with { type: "json" };
import { createEslintPort } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { eslintPluginModuleSchema } from "../../src/infrastructure/engines/eslint/runner/pieces/eslint-plugin-schema.ts";
import classAuthoringPlugin from "../../src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../src/infrastructure/engines/eslint/CD-14`);

type MechanicalCases = Extract<ClauseDefinition, { readonly kind: "mechanical" }>["cases"];

const classSyntaxCases = (): MechanicalCases => {
  const loaded = readDisciplineFile({
    fileText: {
      read: () => ({ outcome: "ok", value: JSON.stringify(discipline) }),
      exists: () => "present",
      write: vi.fn<FileTextPort["write"]>(),
    },
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: absolutePathSchema.parse("/install"),
    discipline: disciplineIdSchema.parse("CD-14"),
  });
  assert(loaded.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
  const [classSyntax, libraryConstruction, staticOnlyClass, ...surplus] = loaded.value.clauses;
  assert(classSyntax?.id === "class-syntax", "CD-14 declares class-syntax as its first clause");
  assert(classSyntax.kind === "mechanical", "CD-14 declares class-syntax as a mechanical clause");
  assert(
    libraryConstruction?.id === "library-construction",
    "CD-14 declares the library-construction judgement clause second",
  );
  assert(staticOnlyClass?.id === "static-only-class", "CD-14 declares the static-only-class clause third");
  assert(surplus.length === 0, "CD-14 declares exactly three clauses");
  return classSyntax.cases;
};

const sharedCases = classSyntaxCases();

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../..`, installForm: "source" }),
});
assert(loadedToolchain.outcome === "ok", "the eslint-10 toolchain loads from the development install");
assert(/^10\./.test(loadedToolchain.value.eslintVersion), `the eslint-10 toolchain runs ESLint ${loadedToolchain.value.eslintVersion}`);

const eslint = createEslintPort({ toolchain: loadedToolchain.value });

describe("CD-14 no-class-authoring rule, over the shipped class-syntax cases, through the ESLint runner's lintSourceCases", () => {
  it.each([...sharedCases.flag, ...sharedCases.allow])("flags exactly the expected lines of the case $name", async (sharedCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "hone",
        rule: "no-class-authoring",
        options: [],
        cases: [sharedCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
    });
  });
});

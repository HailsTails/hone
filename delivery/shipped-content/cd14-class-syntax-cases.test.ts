import { assert, describe, expect, it } from "vitest";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { readDisciplineFile } from "../../src/infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { disciplineIdSchema } from "../../src/infrastructure/hone-config-file/identifiers.ts";
import { createEslintPort } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { eslintPluginModuleSchema } from "../../src/infrastructure/engines/eslint/runner/pieces/eslint-plugin-schema.ts";
import classAuthoringPlugin from "../../src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../src/infrastructure/engines/eslint/CD-14`);

const loadedDiscipline = readDisciplineFile({
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
  ruleSetRoot: absolutePathSchema.parse(`${import.meta.dirname}/../..`),
  discipline: disciplineIdSchema.parse("CD-14"),
});
assert(loadedDiscipline.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
const [classSyntax] = loadedDiscipline.value.clauses;
assert.isDefined(classSyntax, "CD-14 declares a first clause");
assert(classSyntax.kind === "mechanical", "CD-14 declares its first clause as a mechanical clause");
const sharedCases = classSyntax.cases;

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const loadedToolchain = await loadEslintToolchain({
  peers: defaultEslintToolchainPeers({ installRoot: `${import.meta.dirname}/../..`, installForm: "source" }),
});
assert(loadedToolchain.outcome === "ok", "the eslint-10 toolchain loads from the development install");
assert(/^10\./.test(loadedToolchain.value.eslintVersion), `the eslint-10 toolchain runs ESLint ${loadedToolchain.value.eslintVersion}`);

const eslint = createEslintPort({ toolchain: loadedToolchain.value });

describe("CD-14 shipped discipline.json, as the rule-set reader reads it", () => {
  it("declares exactly class-syntax, library-construction and static-only-class, in that order, with class-syntax mechanical", () => {
    expect(loadedDiscipline.value.clauses).toMatchObject([
      { id: "class-syntax", kind: "mechanical" },
      { id: "library-construction" },
      { id: "static-only-class" },
    ]);
  });
});

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
